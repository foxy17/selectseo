# AIO Score — actionable AI-SEO insights

Date: 2026-05-29
Status: validated, ready to implement (not committed)

## Problem

The "✨ AI Insights" tab scores AI-discoverability (AEO) but only shows a
status + descriptive message per check. It tells the user _what_ is wrong, never
_how to fix it_. Competitor AEO/GEO checkers (SEOShouts, AI Rank Lab, Conductor,
Jasper, Gauge) lead with **prioritized, actionable recommendations** per check.

## Research takeaways

- FAQPage schema → cited ~3.6× more in AI Overviews. Highest-leverage fix.
- TL;DR / direct-answer summary at top of page — AI lifts the answer block.
- Claims backed by data/quotes → 30–40% visibility lift.
- E-E-A-T / freshness: visible author + publish/update date.
- `llms.txt` + AI-bot access (GPTBot, ClaudeBot, PerplexityBot, etc.).

Sources: seoshouts.com/tools/geo-aeo-checker, airanklab.com, conductor.com,
frase.io GEO playbook, developers.google.com AI optimization guide,
localmighty.com AI SEO checklist.

## Decisions (from user)

- Suggestion engine: **hybrid** — rule-based fixes always shown + optional
  on-device AI custom action plan (Chrome Prompt API, graceful degrade).
- Scope: existing 5 checks **plus** 3 new high-value checks.
- Rename **both** the nav tab and the in-card heading to "AIO Score".

## Changes

### 1. `seoEngine.ts`

- `GenericAudit` gains optional `recommendation?: string` (the "how to fix",
  populated only when the check is not `ok`).
- `AIDiscoverabilityAudit` gains `directAnswer`, `authorDate`, `llmsTxt`.
- New heuristics (all client-side, reuse existing parsed `doc`/`schemas` + the
  proxy fetch helper):
  - **directAnswer**: TL;DR / summary marker in the lead text, or a concise
    lead paragraph (~40–360 chars) right after the H1.
  - **authorDate**: author signal (`meta[name=author]`, rel/itemprop author,
    JSON-LD `author`) AND a date signal (`<time>`,
    `article:published_time`/`modified_time`, JSON-LD `datePublished`).
  - **llmsTxt**: fetch `/llms.txt` through the proxy (same pattern as
    `robots.txt`); ok if present + non-empty.
- `AEO_PENALTIES` **exported** and rebalanced to sum 100:
  `targetSchema 18, robotsTxtAi 14, qaFormatting 14, directAnswer 12,
authorDate 12, scannability 12, semanticHtml 10, llmsTxt 8`.

### 2. `AIDiscoverabilityTab.svelte`

- Heading → "AIO Score". New `url` prop for AI-plan context.
- **Priority Fixes** card: failing checks sorted by point impact, each with its
  `+N pts` and recommendation. All-pass → success state.
- Audit cards rendered from a single `CHECKS` array (8 checks); each shows a
  "How to fix" block when not `ok`.
- **Hybrid AI**: "✨ Generate custom action plan" button — self-contained
  on-device Prompt API flow (availability detect like `AiChatTab`), seeds the
  prompt with failing checks, streams a plan via `marked` + `DOMPurify`.
  Non-Chrome / unavailable → hint pointing to the AI Chat tab (no duplicate
  model-download UI).

### 3. Parity

- `+page.svelte`: tab label `✨ AI Insights` → `✨ AIO Score`; pass `url`.
  Internal tab key `ai-discoverability` unchanged (avoids history/state ripple).
- `pdfExporter.ts`: add 3 new checks to the AEO list; "AI READINESS SCORE" →
  "AIO SCORE".
- `seoEngine.test.ts`: extend the `aiDiscoverability` fixture with the 3 new
  checks.

## Verification

`npm run check` stays green.
