# SelectSEO Cleanup & Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix security holes, correctness bugs, and the heavy duplication left by vibecoding, then decompose the god-components — without changing what the app does for the user.

**Architecture:** Pull shared logic out of route/component files into typed `src/lib/*` modules (settings store, crawl history, crawl controller, score utils, export utils), extract repeated markup into small Svelte 5 (runes) components, and centralize the design tokens. Harden the stateless Cloudflare proxy. Add a lint + type-check + minimal test gate so future regressions are caught.

**Tech Stack:** SvelteKit 2, Svelte 5 (forced runes mode), TypeScript strict, Vite 8, adapter-static (GitHub Pages), sql.js (WASM), jsPDF, marked + DOMPurify, Cloudflare Worker (proxy).

---

## How this plan was produced

Four read-only audit agents reviewed independent slices of the repo (core libs; tab components; routes/shell; config/CSS/infra). Their findings were de-duplicated and the highest-impact claims spot-verified by hand (`calculateGrade` duplicated, `initShader` duplicated in both pages, `{@html}` JSON-LD injection, two identical-size `*.wasm` files, missing `CNAME`, Apache-2.0/MIT license contradiction — all confirmed).

## Conventions for every task

- **Svelte 5 forced runes mode**: only `$state` / `$derived` / `$effect` / `$props`. Never `export let`, `$:`, `on:`, or stores. (Audit confirmed components are currently clean here — keep them clean.)
- **Design tokens**: reference CSS custom properties from `src/index.css` (`--color-*`, `--spacing-*`, `--rounded-*`). Never hardcode hex/spacing. Consult `DESIGN.md` before any visual change.
- **Verification per task** (in order):
  1. `npm run check` — must stay green (this is the project's only built-in correctness gate).
  2. For pure-logic modules: the Vitest test added in Phase 0.
  3. For visual/behavioral changes: `npm run dev` and smoke-test the affected screen in the browser.
- **Commit after each task** with a conventional-commit message. Keep commits small.
- **Behavior preservation**: this is cleanup. If a task would change user-visible behavior, that change is called out explicitly; otherwise output must be identical.

---

## Phase 0 — Safety net (do this first)

> Rationale: there is currently **no linter, no formatter, no test runner**, and `node_modules` isn't installed. Refactoring ~10k lines without a net is how regressions ship. Establish a baseline and a gate before touching anything else.

### Task 0.1: Install deps and capture the baseline

**Steps:**
1. Run `npm ci` (lockfile is committed). If `engine-strict` rejects the local Node, switch to Node 20 (see Task 7.3).
2. Run `npm run check`. Record the exact pass/fail output in the PR description — this is the baseline; every later task must not regress it.
3. Commit nothing (read-only baseline).

**Expected:** `svelte-check` completes. Note any pre-existing errors so they aren't blamed on later tasks.

### Task 0.2: Add Vitest for pure-logic modules

**Files:**
- Modify: `package.json` (devDeps + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/seoEngine.test.ts` (placeholder importing one exported fn)

**Steps:**
1. Add devDeps: `vitest`, `jsdom` (for `DOMParser` in tests). Add script `"test": "vitest run"` and `"test:watch": "vitest"`.
2. Create `vitest.config.ts` with `environment: 'jsdom'` and SvelteKit `$lib` alias resolution (reuse the alias from `.svelte-kit/tsconfig.json` or add `resolve.alias` for `$lib` → `src/lib`).
3. Write a trivial test: `import { calculateGrade } from './seoEngine'; expect(calculateGrade(95)).toBe('A')` (adjust to actual return).
4. Run `npm test` → PASS. Commit: `test: add vitest harness for pure-logic modules`.

**Why:** Phases 2–4 extract pure functions (`buildProxyFetchUrl`, scoring, `summarizeAudit`, SSRF guard). TDD them here.

### Task 0.3: Add ESLint + Prettier (Svelte-aware)

**Files:** Modify `package.json`; Create `eslint.config.js`, `.prettierrc`, `.prettierignore`.

**Steps:**
1. Add devDeps: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-svelte`, `svelte-eslint-parser`, `prettier`, `prettier-plugin-svelte`.
2. Flat config (`eslint.config.js`) extending recommended + svelte recommended; parserOptions point at `tsconfig.json`.
3. Add scripts: `"lint": "eslint ."`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`.
4. Run `npm run lint`. Triage: fix trivially, or record a baseline ignore list. Don't fix logic here — that's later phases. Commit: `chore: add eslint + prettier`.

### Task 0.4: Gate the deploy workflow

**Files:** Modify `.github/workflows/deploy.yml` (around lines 36–41, before `npm run build`).

**Steps:**
1. Add steps after `npm ci`: `npm run check`, `npm run lint`, `npm test`. Fail the deploy on any error.
2. Commit: `ci: run check/lint/test before build`.

**Expected:** A type/lint/test regression now blocks the GitHub Pages deploy instead of shipping silently.

---

## Phase 1 — Security (highest priority)

### Task 1.1: Lock down the Cloudflare proxy (origin allowlist + SSRF block + header sanitize)

**Files:** Modify `cloudflare-worker/index.js`.

**Problem:** Currently an **open CORS proxy** — `Access-Control-Allow-Origin: '*'` (lines 9–14, 48–58), unauthenticated `?url=` fetch with only an `http(s)` protocol check (lines 39–48), and the post-redirect `targetResponse.url` written verbatim into `X-Final-Url` (line 70). This lets anyone route arbitrary traffic through the Worker, reach `169.254.169.254`/loopback/RFC1918 hosts (SSRF), and inject untrusted data into a trusted header.

**Step 1: Add an origin allowlist.** Define `const ALLOWED_ORIGINS = ['https://selectseo.in', 'http://localhost:5173', 'http://localhost:4173'];`. Read `request.headers.get('Origin')`. If present and not allowed → `403`. Echo the specific origin back in `Access-Control-Allow-Origin` (not `*`) so the response stays credential-safe and tied to the front-end. Update the CORS preflight (OPTIONS) branch to match.

**Step 2: Add an SSRF guard.** After parsing the target URL, reject if the hostname is `localhost`, an IP literal in private/loopback/link-local/metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`), or the bare metadata IP `169.254.169.254`. Return `400`. Implement as a pure helper `isBlockedHost(hostname): boolean` so it can be unit-tested.

**Step 3: Sanitize `X-Final-Url`.** Before setting it: cap length (e.g. 2048), strip control chars / CR-LF, `encodeURI()`. Wrap the whole response-header construction in try/catch so a malformed value returns a clean error instead of a 500.

**Step 4: (Recommended) rate limit.** Add a Cloudflare Rate Limiting rule, or a KV/Durable-Object per-IP counter. Document it in the worker README if a rule is used instead of code.

**Verification:** This is deployed separately from the static site. Test locally with `wrangler dev`: a request with a disallowed `Origin` → 403; `?url=http://169.254.169.254/` → 400; a normal `selectseo.in` origin fetching a public URL → 200 with the specific origin echoed. Add a Vitest unit test for `isBlockedHost`.

**Commit:** `security: lock down cors proxy (origin allowlist, ssrf block, header sanitize)`.

### Task 1.2: Escape JSON-LD before `{@html}` injection in SEO.svelte

**Files:** Modify `src/lib/components/SEO.svelte:63,66`.

**Problem:** `{@html `<script type="application/ld+json">${JSON.stringify(s)}</script>`}` — `JSON.stringify` does not escape `</script>`, so any schema value containing `</script><script>…` breaks out and executes.

**Step 1 (test):** Add a Vitest test for a small `serializeJsonLd(obj): string` helper asserting that an object whose string value contains `</script>` produces output with `</script>` and no literal `</script>`.

**Step 2 (impl):** Add `function serializeJsonLd(obj: unknown) { return JSON.stringify(obj).replace(/</g, '\\u003c'); }` and use it in both `{@html}` sites: `{@html `<script type="application/ld+json">${serializeJsonLd(s)}</script>`}`.

**Step 3:** `npm test` PASS; `npm run check` green; `npm run dev` → view-source on a page, confirm valid JSON-LD still parses (paste into a JSON-LD validator).

**Commit:** `security: escape angle brackets in json-ld output`.

---

## Phase 2 — Correctness bugs

### Task 2.1: Add a crawl generation guard + abort (fixes stale-callback corruption)

**Files:** Modify `src/routes/crawl-detail/[...url]/+page.svelte:328–464` (will move into the controller in Phase 4; do the guard now since it's a live data-corruption bug).

**Problem:** Navigating to a new target URL while `validateLinks` (concurrency 4) and the two `fetchPageSpeed` calls are in flight lets the old async callbacks keep mutating `auditResults` and calling `saveCrawlToHistory()` for the **previous** URL. No cancellation token exists.

**Steps:**
1. Add `let crawlId = 0;` (plain module-scope counter is fine — it's not reactive state).
2. At the start of each crawl: `const myCrawlId = ++crawlId;`.
3. In every async callback (`validateLinks` onProgress/onComplete, `triggerPageSpeedAudits`, the `.then`/`.catch` of `runFreshScan`): early-return `if (myCrawlId !== crawlId) return;` before any state mutation or `saveCrawlToHistory()`.
4. Thread an `AbortController` into `validateLinks` and `fetchPageSpeed` (see Task 2.3 which adds the signal plumbing) and abort the previous controller when a new crawl starts.

**Verification:** `npm run dev`; start a crawl on a slow URL, immediately navigate to another `/crawl-detail/...`; confirm history and on-screen results match the **second** URL only. Check `localStorage.seo_crawl_history`.

**Commit:** `fix: guard crawl callbacks with generation id to prevent stale writes`.

### Task 2.2: Make `currentUrl` derived, not effect-mutated state

**Files:** Modify `src/routes/crawl-detail/[...url]/+page.svelte:21–22, 336–337`.

**Problem:** `rawUrl` is `$derived` (good) but `currentUrl` (normalized) is separate `$state` mutated inside the crawl `$effect` — deriving state via an effect, the documented anti-pattern.

**Steps:**
1. Replace the `currentUrl` `$state` + in-effect assignment with `const currentUrl = $derived.by(() => normalizeUrl(rawUrl));` where `normalizeUrl` prepends `https://` when missing.
2. The crawl `$effect` now reads only `currentUrl` and calls `untrack(() => checkCacheAndCrawl(currentUrl))` (import `untrack` from `svelte`) so unrelated reactive reads don't retrigger the scan.

**Verification:** `npm run check`; crawl still triggers exactly once per URL change (add a temporary `console.count` if unsure, then remove).

**Commit:** `refactor: derive normalized crawl url instead of effect-writing state`.

### Task 2.3: Add fetch timeouts everywhere; stop reporting unreachable links as HTTP 500

**Files:** Modify `src/lib/seoEngine.ts` (fetches at ~245, 264, 730, 746, 788; link status at 729–763; worker pool 711–772).

**Problem:** No `fetch` has a timeout — a hung proxy/target can leave link validation permanently "checking" because `onComplete()` never fires. Separately, when both HEAD and GET throw, the link is assigned `status = 500` (a real HTTP code), so "unreachable" is indistinguishable from "server error" in the UI/SQL/PDF.

**Step 1 (test):** Vitest test for a `fetchWithTimeout(url, opts, ms)` helper: resolves on a fast mock, rejects with an abort error past the timeout.

**Step 2 (impl):**
- Add `fetchWithTimeout` using `AbortController` + `setTimeout` (clear it in `finally`). Replace every bare `fetch` with it (crawl 10s, robots 5s, each link 8s, PageSpeed 60s).
- In `validateLinks`, when both HEAD and GET fail (or abort): set `status = null` (type already allows `number | null`), `statusState = 'broken'`, `statusText = 'Unreachable'`. Do **not** use 500.
- Use `parseInt(x, 10)` (or `Number`) with an `isNaN` fallback to `response.status` at lines 735/749.

**Step 3:** `npm test`; `npm run dev` → crawl a page with a known-dead link and a slow link; confirm dead link shows "Unreachable" and the slow link resolves/times out without hanging the whole audit.

**Commit:** `fix: add fetch timeouts; mark unreachable links as unreachable not 500`.

### Task 2.4: Harden the link-validation worker pool completion

**Files:** Modify `src/lib/seoEngine.ts:711–772`.

**Problem:** The recursive `processNext()` pool signals `onComplete()` based on `running === 0 && queue.length === 0` checked across `running--; processNext()` ordering — timing-dependent; `onComplete` can fire while fetches are still resolving.

**Step 1 (test):** Vitest: feed `validateLinks` a list of N links with a stubbed `fetchWithTimeout` (mix of fast/slow/throwing); assert `onComplete` is called exactly once and only after all N have a terminal `statusState` (no `'checking'` left).

**Step 2 (impl):** Rewrite as N worker promises: `await Promise.all(Array.from({length: CONCURRENCY}, () => worker()))` where each `worker()` loops `while (queue.length) { const link = queue.shift(); ... }`. Call `onComplete()` once after the `Promise.all`. This removes the manual `running` bookkeeping entirely.

**Step 3:** `npm test` PASS; smoke-test in browser — link counts settle correctly, no permanent "checking".

**Commit:** `refactor: rewrite link validation pool with promise workers`.

### Task 2.5: Guard and type the PageSpeed/Lighthouse response

**Files:** Modify `src/lib/seoEngine.ts:487, 757, 808–848`.

**Problem:** `await res.json()` is `any`; `data.lighthouseResult`, `lighthouse.categories.performance`, `audit.details?.type` are dereferenced with no shape check — a changed/empty/error response throws a raw `TypeError`. Audit classification also keys on fragile `id.includes('minify'|'optimize'|…)` substrings.

**Steps:**
1. Define minimal interfaces for the subset read: `LighthouseResult`, `LighthouseCategory`, `LighthouseAudit` (id, title, score, scoreDisplayMode, details?.type).
2. Guard: `const lighthouse = data?.lighthouseResult; if (!lighthouse?.categories?.performance) throw new Error('PageSpeed returned no Lighthouse performance data.');`
3. Replace substring `id.includes(...)` classification with `details?.type === 'opportunity'` + `scoreDisplayMode`. Keep an explicit allowlist constant only if needed.
4. Type `catch (err: unknown)` and narrow before reading `.message`.

**Verification:** `npm run check`; crawl with a PageSpeed API key configured; also test the no-key path and a deliberately bad key (should surface the thrown message in the UI, not crash).

**Commit:** `fix: validate and type pagespeed response, drop fragile id matching`.

### Task 2.6: Debounce SQL re-query during link validation

**Files:** Modify `src/routes/crawl-detail/[...url]/+page.svelte:397`.

**Problem:** Inside the per-link `validateLinks` callback, `if (activeTab === 'sql') runSQLQuery()` rebuilds the in-memory SQLite DB and re-queries on **every** individual link result (hundreds of times).

**Step:** Only re-run in the `onComplete` callback (links are terminal then), or debounce to ~300ms. Prefer `onComplete`.

**Verification:** `npm run dev`; open SQL tab during a crawl of a link-heavy page; confirm one rebuild at the end, UI no longer janks.

**Commit:** `perf: rebuild sql db once on link-validation complete`.

### Task 2.7: Reconcile the mislabeled FID/TBT metric

**Files:** `src/lib/seoEngine.ts:856` (and interface comment ~131); `src/lib/pdfExporter.ts:303`; `src/lib/components/PageSpeedTab.svelte:94,184,268`.

**Problem:** `PageSpeedMetric.fid` is populated with Total Blocking Time and rendered/labeled "TBT" everywhere. The field name lies about its contents (FID is deprecated anyway).

**Steps:** Rename the field `fid` → `tbt` in the interface and at the assignment in `fetchPageSpeed`, then update the three PageSpeedTab references and the PDF. Pure rename, no behavior change.

**Verification:** `npm run check` (compiler catches missed references); browser shows the same TBT values.

**Commit:** `refactor: rename mislabeled fid field to tbt`.

---

## Phase 3 — De-duplication (the core "vibecoded" cleanup)

> This phase removes the largest volume of copy-paste. Order matters: build the shared modules/components first, then delete the duplicates.

### Task 3.1: Single source for `calculateGrade`

**Files:** Modify `src/lib/components/DashboardTab.svelte:18–30` (delete local copy), import from `$lib/seoEngine`.

**Step:** Delete the byte-for-byte duplicate `calculateGrade` in DashboardTab; add `import { calculateGrade } from '$lib/seoEngine';`.

**Verification:** `npm run check`; Dashboard grade letter unchanged.

**Commit:** `refactor: dedupe calculateGrade, import from seoEngine`.

### Task 3.2: Shared score-band helper (resolve the disagreeing thresholds)

**Files:** Create `src/lib/scoreUtils.ts`; modify `DashboardTab.svelte` (222–273), `PageSpeedTab.svelte` (39–49,155–156,239–240, delete dead `getScoreColorClass`), `AIDiscoverabilityTab.svelte:11`.

**Problem:** "score → success/warning/error band" is reimplemented ≥4× with **conflicting** cutoffs (Dashboard 90/70, PageSpeed 90/50, AIDiscoverability 90/80/70).

**Step 1 (DECIDED):** Keep PageSpeed's Lighthouse bands (90/50) **only** for the PageSpeed gauges (`lighthouseBand`); use a single app band ≥90 success / ≥70 warning / else error (`scoreBand`) everywhere else. Document this in the file header so it's intentional, not accidental drift.

**Step 2 (test):** Vitest for `scoreBand(score): 'success'|'warning'|'error'` and `lighthouseBand(score)` covering the boundaries.

**Step 3 (impl):** Implement both in `scoreUtils.ts`, returning the token class name. Replace the inline `class:text-*` ternary chains and the per-file helpers. Delete `getScoreColorClass` (dead) in PageSpeedTab.

**Verification:** `npm test`; visually compare each screen's colors before/after (intentional changes only where thresholds were wrong).

**Commit:** `refactor: centralize score-band coloring, fix divergent thresholds`.

### Task 3.3: Extract the WebGL console HUD (shader + log list) into one component

**Files:** Create `src/lib/consoleShader.ts` and `src/lib/components/ConsoleHud.svelte`; modify `src/routes/+page.svelte` (101–265 shader, 54–63/95–98/421–443 log+scroll+css) and `src/routes/crawl-detail/[...url]/+page.svelte` (126–290 shader, 42–51/67–70/624–645).

**Problem:** ~165 lines of `initShader` are duplicated byte-for-byte across both pages, plus the console-log markup, the `log()` fn, the auto-scroll `$effect`, and ~120 lines of identical `.console-*` CSS + `@keyframes`.

**Steps:**
1. Move shader source + compile/link/render/cleanup into `consoleShader.ts` exporting `initShader(canvas: HTMLCanvasElement): (() => void) | null`.
2. Create `<ConsoleHud {logs} />` (`logs: string[]` via `$props`) that owns the `<canvas>`, the log list, the auto-scroll `$effect` (use `tick()` instead of `setTimeout(0)` — Task 5.x), and all `.console-*` styles. It calls `initShader` in `onMount` and runs the returned cleanup in the teardown.
3. Replace both pages' inline blocks with `<ConsoleHud logs={scanLogs} />`. Keep each page's own `scanLogs` `$state` and `log()` helper (or move `log` into the parent and pass logs down — parent keeps ownership).

**Verification:** `npm run dev`; both the landing page and crawl-detail show the animated console identically; no WebGL context errors in console; cleanup runs on navigate (no leaked rAF).

**Commit:** `refactor: extract ConsoleHud component, dedupe webgl shader`.

### Task 3.4: Central settings store + storage-key constants + `<AuditSettings>`

**Files:** Create `src/lib/settings.svelte.ts` and `src/lib/storageKeys.ts` and `src/lib/components/AuditSettings.svelte`; modify both pages' duplicated settings blocks (`+page.svelte:38–47,285–300,345–349`; `crawl-detail:25–33,309–324,498–502`).

**Problem:** The proxy/key load+save+reverse-map block is duplicated across both pages, with 6+ hardcoded copies of `'https://corsproxy.io/?url='`, and the three localStorage keys appear as 12 bare string literals.

**Steps:**
1. `storageKeys.ts`: `export const STORAGE_KEYS = { history: 'seo_crawl_history', proxy: 'seo_proxy_url', pagespeedKey: 'seo_pagespeed_key' } as const;`
2. `settings.svelte.ts`: rune-backed module exporting `proxyUrl`, `apiKey`, `selectedProxy` (`$state`), a `PROXY_PRESETS` constant (the option values, one source), `load()` and `save()`. Compute the effective proxy with `$derived` (custom branch binds a separate `customProxy`), removing the effect-driven sync.
3. `<AuditSettings>`: the proxy/key form markup, bound to the store.
4. Replace both pages' settings UI/logic with the component + store.

**Verification:** `npm run check`; set a custom proxy + key, reload → values persist; preset dropdown still maps correctly; `localStorage` keys unchanged.

**Commit:** `refactor: central settings store, proxy presets, storage-key constants`.

### Task 3.5: Typed crawl-history module

**Files:** Create `src/lib/crawlHistory.ts`; modify `+page.svelte:71–93` and `crawl-detail:73–123`.

**Problem:** Both pages parse/write `seo_crawl_history` independently with `$state<any[]>`, no shared type, and divergent logic (landing `deleteHistoryItem` skips the 6-item cap and try/catch; orchestrator has them).

**Steps:**
1. Define and export `interface CrawlHistoryItem { url; timestamp; score; grade; errorCount; warningCount; results: AuditResults; }` and `export const MAX_HISTORY = 6;`.
2. Export `loadHistory()`, `saveHistory(items)`, `upsert(item)`, `deleteHistoryItem(url)` — all using `STORAGE_KEYS.history`, the cap, and try/catch.
3. Both pages use `$state<CrawlHistoryItem[]>` and call these.

**Verification:** `npm run check`; create >6 crawls → capped at 6; delete works from both pages; re-scanning a cached URL still loads from history.

**Commit:** `refactor: typed shared crawlHistory module`.

### Task 3.6: Move audit summarization & score recalculation into seoEngine

**Files:** Modify `src/lib/seoEngine.ts` (add helpers); `crawl-detail/[...url]/+page.svelte:85–123, 467–495, 582–597`.

**Problem:** Error/warning/passed counting is written twice in the orchestrator (`saveCrawlToHistory` vs the `$derived`) and can drift; `recalculateOverallScore` mutates `auditResults.score` inline while grade logic lives in the engine.

**Steps:**
1. Add pure `summarizeAudit(results): { errorCount; warningCount; passedCount }` to `seoEngine.ts` (Vitest-tested).
2. Add `recalculateOverallScore(results): number` (pure — returns the score; caller assigns) or keep mutation but move it to the engine.
3. Replace both orchestrator counting sites with `summarizeAudit`; the `$derived` and `saveCrawlToHistory` now share one source.

**Verification:** `npm test`; counts on the dashboard match the saved-history badge counts exactly.

**Commit:** `refactor: move audit summary + score recalc into seoEngine`.

### Task 3.7: Shared clipboard / download utilities (drop blocking `alert()`)

**Files:** Create `src/lib/exportUtils.ts`; modify `LinksTab.svelte:108–144` and `crawl-detail/[...url]/+page.svelte:539–558` (`exportQueryToCSV`).

**Problem:** `navigator.clipboard.writeText` called with no `await`/`.catch` then a blocking `alert('Copied…')`; CSV download dance and escaping reimplemented per place.

**Steps:**
1. `exportUtils.ts`: `async copyToClipboard(text): Promise<boolean>` (try/catch, returns success) and `downloadFile(name, mime, content)`. Optional `toCsv(rows, headers)` with proper escaping.
2. Replace the LinksTab and SQL-console export logic with these. Replace `alert()` with a small non-blocking toast (reuse existing notification pattern if any; otherwise a minimal inline status message). Note: dropping `alert()` is an intentional UX change.

**Verification:** `npm run dev`; copy broken links, export CSV, copy-as-markdown, export SQL CSV — all work; no `alert` popups.

**Commit:** `refactor: shared clipboard/download utils, remove blocking alerts`.

### Task 3.8: Extract PageSpeed `<StrategyCard>` + `<VitalRangeBar>`

**Files:** Create `src/lib/components/StrategyCard.svelte`, `src/lib/components/VitalRangeBar.svelte`; modify `PageSpeedTab.svelte:131–297`.

**Problem:** Desktop (131–213) and Mobile (216–297) panels are ~70 lines of duplicated markup each, and the LCP/TBT/CLS range row is itself triplicated within each panel (~6 near-identical blocks total). This is the bulk of the 656-line file.

**Steps:**
1. `<VitalRangeBar title pct color labels />` renders one vital's track+fill+labels (reuses the `ProgressBar` from Task 3.9 if landed first).
2. `<StrategyCard strategy={data} error={err} label="Desktop" />` renders the gauge + a `{#each [lcp,tbt,cls]}` of `<VitalRangeBar>`.
3. Replace both panels with `<StrategyCard label="Desktop" .../>` and `<StrategyCard label="Mobile" .../>`.
4. Fix the dead/undefined `.card-header-row` and `.error-msg` classes used here (lines 133/217/143/227) — they have no scoped style; promote `.card-header-row` to the `index.css` utility from Task 3.11.

**Verification:** `npm run dev`; both strategy cards render identically to before; ~160 lines → ~40.

**Commit:** `refactor: extract StrategyCard + VitalRangeBar in PageSpeedTab`.

### Task 3.9: Shared `<ProgressBar>` + track/fill classes

**Files:** Create `src/lib/components/ProgressBar.svelte`; modify `DashboardTab.svelte:392–407`, `LinksTab.svelte:413–430,786–797`, `OnPageTab.svelte:611–627`, `PageSpeedTab.svelte:500–511`.

**Problem:** The "rounded pill track + width-driven colored fill" widget is built 4× with 4 class-name schemes (`fill-*`, `gauge-*`, `segment-*`, `range-fill`).

**Steps:** `<ProgressBar value={0..100} band />` using the `scoreBand` helper (Task 3.2) for the fill color; one set of `.track`/`.track-fill` rules (in the component, scoped). Replace the four duplicates. Removes ~50 duplicated CSS lines.

**Verification:** `npm run dev`; every bar (dashboard, links distribution, on-page gauge, pagespeed ranges) renders with correct width/color.

**Commit:** `refactor: shared ProgressBar component`.

### Task 3.10: Collapse repeated `{#each}` blocks (headings, schema, nudges) + add a `<Collapsible>`

**Files:** Modify `OnPageTab.svelte:200–261 (H1–H6), 357–393 (schema)`; `AiChatTab.svelte:303–315,347–355 (nudges)`; create `src/lib/components/Collapsible.svelte` and refactor `OnPageTab` schema (357–391) + `PageSpeedTab` recs (351–372).

**Steps:**
1. Headings: iterate `[1,2,3,4,5,6]`, compute `depth-{n}`/`h{n}-badge` dynamically; keep the H1-empty special case. Six blocks → one.
2. Schema panel: normalize `schemas ?? schemaTypes.map(...)` into one list, single `{#each}`.
3. Nudges: give each nudge `{ icon, label, subtitle, prompt }` structured fields (stop `title.split(' ')[0]` emoji-munging); render the two treatments from the structured data.
4. `<Collapsible title>` (slot body, owns its open state) replaces the duplicated header-button + arrow + `Record<…,boolean>` toggle maps in OnPageTab (schema) and PageSpeedTab (recs).

**Verification:** `npm run dev`; headings outline, schema cards, recommendation accordions, and chat nudges all behave as before.

**Commit:** `refactor: dedupe heading/schema/nudge loops, add Collapsible`.

### Task 3.11: Centralize CSS — utilities + RGB-channel tokens; purge hardcoded values

**Files:** Modify `src/index.css`; sweep `DashboardTab`, `OnPageTab`, `LinksTab`, `PageSpeedTab`, `AiChatTab`, `AIDiscoverabilityTab`.

**Problem:** `display:flex;justify-content:space-between;align-items:center` re-declared in ~8 places under different names; `.mt-*`/`.ml-*` redefined in 3 components (and conflicting values across marketing pages); ~20+ hand-typed `rgba(250,255,105,…)`/`rgba(239,68,68,…)`/`rgba(34,197,94,…)` literals; many hardcoded hexes that equal existing tokens (`#3b82f6`=`--color-accent-blue`, etc.).

**Steps:**
1. Add to `index.css`: `.row-between` utility; `.mt-2/.mt-4/.ml-2/.pt-5` margin utilities (one canonical value each); `--color-*-rgb` channel tokens (e.g. `--color-primary-rgb: 250 255 105;`) so tints become `rgb(var(--color-primary-rgb) / 0.08)`.
2. Sweep components: replace token-equivalent hexes with `var(--color-*)`; replace literal `rgba()` with the channel-token form; delete the per-component `.mt-*`/`.ml-*` redefinitions. **Exception:** SERP/social preview brand colors (Google `#1a0dab`/`#dadce0`, Facebook `#3b5998`, Twitter, white) legitimately mimic external UIs — keep them but move to clearly-named local constants with a comment.
3. Delete dead CSS: `.status-err` (AIDiscoverabilityTab:133), `.font-semibold` (PageSpeedTab:556), unused `--color-accent-rose`/`--spacing-section`/`.display-sm`/`.card-yellow` in index.css (or keep deliberately and comment as design-system-only).

**Verification:** `npm run dev`; pixel-compare key screens; run `npm run lint` for unused-CSS warnings if the svelte plugin reports them.

**Commit:** `style: centralize utilities + rgb tokens, purge hardcoded colors`.

### Task 3.12: Marketing pages → `<InfoPageLayout>` + data-driven FAQ

**Files:** Create `src/lib/components/InfoPageLayout.svelte`; modify `faq/+page.svelte`, `how-to-use/+page.svelte`, `what-this-does/+page.svelte`.

**Problem:** All three info pages redeclare identical `.info-page/.info-section/.section-title/.section-subtitle/.highlight-text` CSS + the same responsive collapse; FAQ content is duplicated between the JSON-LD `faqSchema` and the rendered cards (and the two copies have already drifted, line 70 vs 110); `how-to-use` has literal `**markdown**` asterisks that render as plain text (line 142).

**Steps:**
1. `<InfoPageLayout title subtitle>` (slot content) carrying the shared shell + styles.
2. Convert each page to use it. Move `how-to-use`'s `**...**` to `<strong>`.
3. FAQ: single `const faqs = [{ q, a }]` array feeding **both** the `FAQPage` JSON-LD and the rendered cards.

**Verification:** `npm run dev`; three pages look identical; FAQ schema and visible answers now match (validate JSON-LD); markdown asterisks gone.

**Commit:** `refactor: InfoPageLayout + data-driven FAQ (schema/markup single source)`.

### Task 3.13: `<SegmentedToggle>` for the repeated toggle/filter groups

**Files:** Create `src/lib/components/SegmentedToggle.svelte`; modify `OnPageTab.svelte:64–67,110–113` and `LinksTab.svelte:227–243`.

**Step:** `<SegmentedToggle options bind:value />` replacing the SERP/social toggles and the Links filter group (and the near-identical `.toggle-buttons`/`.filter-buttons` CSS).

**Verification:** `npm run dev`; SERP/social preview switching and link filtering behave as before.

**Commit:** `refactor: shared SegmentedToggle component`.

---

## Phase 4 — Decompose the crawl-detail god component

> Do this **after** Phase 3 so the controller consumes the already-extracted modules. Target: 1265 lines → a few hundred.

### Task 4.1: Extract `createCrawlController` (rune-based)

**Files:** Create `src/lib/crawlController.svelte.ts`; modify `src/routes/crawl-detail/[...url]/+page.svelte`.

**Steps:**
1. Move into the controller: `isScanning`, `auditResults`, `scanLogs`, link-validation progress, PageSpeed states, and the `crawlId` generation counter (from Task 2.1). Expose `start(url, { proxyUrl, apiKey })` and `recrawl()`. Every async callback checks `crawlId` and respects the `AbortController`.
2. The page becomes a thin consumer: one minimal `$effect` reading only `currentUrl` (now `$derived`, Task 2.2) calling `controller.start(currentUrl, settings)`. It renders the grade/stats banner + tab components + `<ConsoleHud>` + `<AuditSettings>`.
3. Remove the now-dead inline `recalculateOverallScore`, `saveCrawlToHistory` counting (use Task 3.6 helpers), `exportQueryToCSV` (Task 3.7), shader (Task 3.3), settings (Task 3.4), history (Task 3.5).

**Verification:** `npm run check`; full crawl flow works end-to-end identically; line count of the page drops substantially.

**Commit:** `refactor: extract crawl controller, slim crawl-detail page`.

### Task 4.2: Add the missing error / empty UI state

**Files:** Modify `crawl-detail/[...url]/+page.svelte` template (`418–423, 612–833`).

**Problem:** On a failed crawl the catch only logs and sets `isScanning=false`; with neither `isScanning` nor `auditResults` truthy, the user sees a **blank page** and the error logs are unmounted with the scanning view.

**Steps:** Add an `error` state on the controller; add an `{:else}` branch rendering the failure message, the captured `scanLogs`, and a "Recrawl" button calling `controller.recrawl()`.

**Verification:** `npm run dev`; point at an unreachable URL → see an error + logs + working retry, not a blank page.

**Commit:** `feat: error/empty state with retry on failed crawl`.

---

## Phase 5 — Polish, accessibility, dead code, config drift

> Independent small tasks. Can be parallelized. Each is its own commit.

### Task 5.1: Accessibility fixes
- `LinksTab.svelte:270–287` sortable `<th onclick>` → `<button>` (or `role="columnheader" aria-sort`), add `tabindex`/`onkeydown`; row toggle (297) keyboard-focusable.
- `+page.svelte:466` history card: make it an `<a href="/crawl-detail/{url}">` with the delete `<button>` as a **sibling**, not nested inside a `role="button"` (invalid ARIA today).
- `OnPageTab.svelte:120,135` OG/Twitter `<img>`: add `loading="lazy"` + `onerror` fallback to the existing placeholder.
- Commit: `a11y: keyboard-accessible link table, valid history card semantics, img fallbacks`.

### Task 5.2: Remove dead code
- `DashboardTab.svelte` unused props `isValidatingLinks`/`checkedLinksCount`/`totalLinksCount` (6–8,12–14) + remove from parent call site.
- `+page.svelte:3` unused `import { initSqlEngine }`.
- `src/lib/index.ts` — populate as a real `$lib` barrel (`export * from './seoEngine'` etc.) or delete.
- `app.d.ts` — leave (standard SvelteKit stub).
- Commit: `chore: remove dead props/imports`.

### Task 5.3: Fix misleading/placeholder UI strings
- `+layout.svelte:51–54` "Proxy Online" badge: it's hardcoded and misleads when the proxy is down. Either remove it or reflect the last crawl's proxy result. (Recommend: remove the "Online" assertion.)
- `+layout.svelte:100–101` footer "GitHub"/"Documentation" both point to bare `https://github.com` — point at the real repo/docs or remove.
- License contradiction: footer says **Apache-2.0** (`+layout.svelte:114`), `what-this-does` says **MIT** (72, 109). **DECIDED: MIT.** Change the footer to MIT; source from a single constant.
- Commit: `fix: correct misleading proxy badge, placeholder links, license string`.

### Task 5.4: Idiomatic auto-scroll + non-reactive flag cleanup
- Replace `setTimeout(0)` + bare `scanLogs;` dependency-touch with `tick().then(...)` in the `<ConsoleHud>` auto-scroll effect (now centralized in Task 3.3).
- `+page.svelte:267,339` `let typingActive` — scope the cancellation flag inside `onMount`.
- Commit: `refactor: idiomatic tick-based autoscroll, scoped typing flag`.

### Task 5.5: Add `{#each}` keys
- Add stable keys to lists currently unkeyed: `DashboardTab:312 (issue.id)`, `OnPageTab` heading/schema loops, `PageSpeedTab:350,389`, `AiChatTab:303,321,347` (messages especially, since `expandedSchemas[idx]` index-keying can mis-associate state on reorder).
- Commit: `fix: add stable each-block keys`.

### Task 5.6: Config / build hardening
- `package.json`: remove redundant `@types/dompurify` + `@types/marked` (both libs ship their own types); run `npm run check` to confirm. Add `"engines": { "node": ">=20 <21" }` (makes the existing `engine-strict=true` meaningful).
- Create `.nvmrc` with `20`.
- `typescript: ^6.0.2` — confirm it resolves and `svelte-check` passes against it under `npm ci`; if it breaks, pin to the last known-good (`~5.x`). (TS 6 is an early/transitional major — verify, don't assume.)
- Consider tilde ranges for build-critical majors (`vite`, `@sveltejs/vite-plugin-svelte`) so caret bumps can't break local installs.
- Commit: `chore: trim redundant @types, pin node engine, add .nvmrc`.

### Task 5.7: GitHub Pages / static-asset hygiene
- `static/sql-wasm-browser.wasm` and `static/sql-wasm.wasm` are identical size (659730 B) and only the latter is referenced. Confirm no runtime reference to `-browser`, then delete it (~640 KB off the deploy).
- Add `static/CNAME` containing `selectseo.in` so the custom apex domain is reasserted on every Pages deploy (none exists today).
- Commit: `chore: drop unused wasm, add CNAME for custom domain`.

### Task 5.8: DESIGN.md ↔ index.css token reconciliation
- `--rounded-full: 50%` vs DESIGN's `9999px` — align one to the other (decide: `full` = circle for avatars, or `9999px` pill) and update whichever is wrong.
- `.title-md`/`.title-sm` missing `letter-spacing: 0` per spec; `.badge-yellow` uses `11px`/`1px` vs spec `12px`/`1.5px`. Add a `--tracking-*` token set if letter-spacing recurs.
- Collapse duplicate token pairs (`--color-accent-rose`==`--color-error`, `--color-accent-emerald`==`--color-success`) into aliases.
- Commit: `style: reconcile design tokens with DESIGN.md`.

### Task 5.9: Minor seoEngine robustness (low)
- `buildProxyFetchUrl` (166–181): replace the brittle regex+`includes('url=')` heuristic with one documented contract (require a `{url}` placeholder OR always append `?url=<encoded>`). The current `includes('url=')` branch can return the proxy root without the target. Vitest-test it.
- `estimateReadingLevel` (219–224): make suffix syllable handling mutually exclusive (check `-es`/`-ed` before `-e`); add a "rough heuristic" comment.
- `contentRatio` (450): guard `htmlSize > 0` explicitly; treat empty crawl body as an error upstream.
- Schema parsing (481–508): recurse into `@graph` within array items; handle `@type` as an array; optionally surface a count of unparseable blocks instead of silent empty `catch`.
- `prepareDatabase` cache (sqlEngine:38): key on `results.url + results.timestamp` instead of reference equality so post-link-validation rebuilds aren't stale.
- Type sql.js with `import type { Database, SqlJsStatic } from 'sql.js'` (remove `SQL: any`/`activeDb: any`).
- Hoist magic numbers (title/desc thresholds, AEO weights, score deductions) into named `const` config objects at module top.
- Commit (split as sensible): `fix: seoEngine robustness (proxy url, syllables, schema graph, sql cache, typing, magic numbers)`.

---

## Suggested execution order & grouping

1. **Phase 0** (net) → **Phase 1** (security) — do not defer these.
2. **Phase 2** (correctness) — user-visible data bugs.
3. **Phase 3** (dedup) — biggest line reduction; build shared modules before deleting duplicates. Within Phase 3, land 3.2 (scoreUtils) and 3.9 (ProgressBar) before 3.8 (StrategyCard uses both).
4. **Phase 4** (decompose) — depends on Phase 3 modules.
5. **Phase 5** — polish; parallelizable.

## Rough impact

- **Security**: open proxy + SSRF + JSON-LD injection closed.
- **Correctness**: stale-callback corruption, hung-audit, false-500 links, unguarded PageSpeed all fixed.
- **Size**: ~330 lines of duplicated shader, ~120 lines duplicated console CSS, ~160 lines duplicated PageSpeed panels, ~60 lines duplicated heading loops, the duplicated settings/history/score logic, and ~50 lines of duplicated bar widgets removed; the 1265-line orchestrator drops to a few hundred. Estimated 1.5–2.5k lines net removed.
- **Maintainability**: one source each for grade/score-band, settings, history, storage keys, export, design tokens; a real lint+test+check gate on deploy.

## Resolved decisions

- **Canonical score thresholds** (Task 3.2): ✅ Lighthouse 90/50 for PageSpeed only; app-wide 90/70 elsewhere.
- **License** (Task 5.3): ✅ **MIT** everywhere.

## Still open (confirm during execution)

- **Proxy rate-limiting** (Task 1.1 step 4): Cloudflare dashboard rule vs in-Worker counter.
- **TypeScript 6** (Task 5.6): keep and verify, or pin to 5.x — resolve based on whether `npm run check` passes.
