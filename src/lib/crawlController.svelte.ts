import {
  runSEOAudit,
  validateLinks,
  fetchPageSpeed,
  calculateGrade,
  summarizeAudit,
  recalculateOverallScore as computeOverallScore
} from './seoEngine';
import type { AuditResults } from './seoEngine';
import { settings } from './settings.svelte';
import { loadHistory, upsert } from './crawlHistory';
import type { CrawlHistoryItem } from './crawlHistory';

/**
 * Optional hooks the consuming page wires in. These keep page-only concerns
 * (the SQL console) decoupled from the crawl orchestration:
 *  - `onResultsReady` fires once fresh `auditResults` land (or a cache entry is
 *    loaded). The page uses it to reset + rebuild the in-memory SQL DB.
 *  - `onLinksComplete` fires after link validation finishes. The page uses it to
 *    re-run the SQL query once (only when the SQL tab is active).
 */
export interface CrawlControllerHooks {
  onResultsReady?: () => void;
  onLinksComplete?: () => void;
}

export interface CrawlController {
  readonly isScanning: boolean;
  readonly isValidatingLinks: boolean;
  readonly auditResults: AuditResults | null;
  readonly scanLogs: string[];
  readonly checkedLinksCount: number;
  readonly totalLinksCount: number;
  readonly isFetchingMobileSpeed: boolean;
  readonly isFetchingDesktopSpeed: boolean;
  readonly pageSpeedMobileError: string;
  readonly pageSpeedDesktopError: string;
  readonly error: string | null;
  log(message: string): void;
  start(url: string, opts?: { force?: boolean }): Promise<void>;
  recrawl(): void;
  triggerPageSpeedAudits(url: string): Promise<void>;
}

/**
 * Per-page crawl orchestration controller. Owns all reactive crawl state plus
 * the generation/abort bookkeeping that discards superseded async callbacks.
 *
 * A FACTORY (not a global singleton) is used because this state is per-page
 * instance: each crawl-detail mount gets fresh state, and the controller can be
 * garbage-collected with the page. `$state` works inside a factory in runes
 * mode — the returned getters preserve reactivity across the module boundary,
 * mirroring the `settings.svelte.ts` singleton getter pattern.
 */
export function createCrawlController(hooks: CrawlControllerHooks = {}): CrawlController {
  let isScanning = $state(false);
  let isValidatingLinks = $state(false);
  let auditResults = $state<AuditResults | null>(null);
  let scanLogs = $state<string[]>([]);
  let checkedLinksCount = $state(0);
  let totalLinksCount = $state(0);

  // PageSpeed states
  let isFetchingMobileSpeed = $state(false);
  let isFetchingDesktopSpeed = $state(false);
  let pageSpeedMobileError = $state('');
  let pageSpeedDesktopError = $state('');

  // Last error surfaced from a crawl (consumed by the error UI, task 4.2).
  let error = $state<string | null>(null);

  // Crawl cancellation token: identifies the latest in-flight crawl so that
  // async callbacks from a superseded crawl can be discarded. Plain
  // (non-reactive) internals.
  let crawlGeneration = 0;
  let currentAbort: AbortController | null = null;
  let lastCrawledUrl = '';

  // Log message logger
  function log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    scanLogs = [...scanLogs, `[${timestamp}] ${message}`];
  }

  // Caching & History logic
  function saveCrawlToHistory() {
    const results = auditResults;
    if (!results) return;

    // Single source of truth for counts (shared with the on-screen metrics).
    const summary = summarizeAudit(results);

    const historyItem: CrawlHistoryItem = {
      url: results.url,
      timestamp: results.timestamp || new Date().toISOString(),
      score: results.score,
      grade: results.grade,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      results: $state.snapshot(results)
    };

    upsert(historyItem);
  }

  // Score recalculations. The math lives in the (pure) engine fn; the mutation
  // of reactive state stays here.
  function recalculateOverallScore() {
    if (!auditResults) return;
    auditResults.score = computeOverallScore(auditResults);
    auditResults.grade = calculateGrade(auditResults.score);
  }

  // Single crawl entry point. Cache-hit loads from history; otherwise runs a
  // fresh scan. Same-url guard (de-bounces redundant effect re-triggers) lives
  // here so the page's $effect can stay trivial.
  async function start(url: string, opts: { force?: boolean } = {}): Promise<void> {
    const forceRecrawl = opts.force ?? false;
    if (!forceRecrawl && lastCrawledUrl === url) return;
    lastCrawledUrl = url;

    // Begin a new crawl: bump generation and abort any prior in-flight work
    // so superseded async callbacks can be discarded.
    const myGen = ++crawlGeneration;
    currentAbort?.abort();
    currentAbort = new AbortController();

    isScanning = true;
    auditResults = null;
    scanLogs = [];
    error = null;
    checkedLinksCount = 0;
    totalLinksCount = 0;

    const history = loadHistory();
    const cachedItem = history.find((item) => item.url === url);

    if (cachedItem && !forceRecrawl) {
      log(`Cache hit: loading cached crawl report for ${url}`);
      // Deep clone to ensure reactivity binds cleanly
      auditResults = JSON.parse(JSON.stringify(cachedItem.results));
      hooks.onResultsReady?.();
      isScanning = false;

      // Auto query Core Web Vitals in background if they are missing
      if (auditResults && !auditResults.pageSpeedMobile && !auditResults.pageSpeedDesktop) {
        triggerPageSpeedAudits(url, myGen);
      }
      return;
    }

    log(`Cache miss. Executing new audit crawl for target: ${url}`);
    await runFreshScan(url, myGen);
  }

  // Force a fresh re-scan of the current url.
  function recrawl() {
    if (lastCrawledUrl) void start(lastCrawledUrl, { force: true });
  }

  // Primary Crawling Execution
  async function runFreshScan(urlToScan: string, myGen: number) {
    // start() always creates a fresh controller before delegating here.
    const abortSignal = currentAbort?.signal;
    try {
      // 1. Crawl & Run On-Page Audit
      const results = await runSEOAudit(urlToScan, settings.effectiveProxyUrl, (msg) => log(msg));
      if (myGen !== crawlGeneration) return; // superseded by a newer crawl
      auditResults = results;

      // Notify the page so it can (re)build the in-memory SQL DB.
      hooks.onResultsReady?.();
      saveCrawlToHistory();

      // 2. Validate Hyperlinks Asynchronously
      totalLinksCount = results.links.length;
      if (totalLinksCount > 0) {
        log(`Found ${totalLinksCount} unique links to check. Starting validation...`);
        isValidatingLinks = true;

        validateLinks(
          results.links,
          settings.effectiveProxyUrl,
          (updatedLink) => {
            if (myGen !== crawlGeneration) return; // discard stale link result
            if (auditResults) {
              const idx = auditResults.links.findIndex((l) => l.id === updatedLink.id);
              if (idx !== -1) {
                auditResults.links[idx] = updatedLink;
              }
              checkedLinksCount = auditResults.links.filter(
                (l) => l.statusState !== 'pending' && l.statusState !== 'checking'
              ).length;
            }
          },
          () => {
            if (myGen !== crawlGeneration) return; // crawl superseded; ignore
            isValidatingLinks = false;
            log('Link checking completed.');
            recalculateOverallScore();
            saveCrawlToHistory();
            // Debounced SQL re-query: the page rebuilds the in-memory DB once,
            // after all link results are in, instead of on every per-link update.
            hooks.onLinksComplete?.();
          },
          abortSignal
        );
      } else {
        log('No links found to validate.');
      }

      // 3. PageSpeed Audits (Automatically run in background)
      triggerPageSpeedAudits(urlToScan, myGen);

      log('SEO core analysis complete.');
    } catch (err: any) {
      if (myGen !== crawlGeneration) return; // superseded; suppress stale error
      error = err.message || String(err);
      log(`[ERROR] Audit aborted: ${err.message}`);
      console.error(err);
    } finally {
      if (myGen === crawlGeneration) isScanning = false;
    }
  }

  // PageSpeed background updates.
  // `myGen` ties this run to a specific crawl; stale results are discarded.
  // Defaults to the current generation for direct (manual) invocations from
  // the PageSpeed tab.
  async function triggerPageSpeedAudits(url: string, myGen: number = crawlGeneration) {
    isFetchingDesktopSpeed = true;
    pageSpeedDesktopError = '';
    log('Requesting Google PageSpeed Desktop report...');
    try {
      const desktopStats = await fetchPageSpeed(url, 'desktop', settings.apiKey);
      if (myGen !== crawlGeneration) return; // superseded; discard stale result
      if (auditResults) {
        auditResults.pageSpeedDesktop = desktopStats;
        log(`PageSpeed Desktop completed: Score ${desktopStats.score}/100`);
      }
    } catch (err: any) {
      if (myGen !== crawlGeneration) return;
      pageSpeedDesktopError = err.message || 'Failed';
      log(`[WARN] PageSpeed Desktop audit failed: ${pageSpeedDesktopError}`);
    } finally {
      if (myGen === crawlGeneration) {
        isFetchingDesktopSpeed = false;
        saveCrawlToHistory();
      }
    }

    if (myGen !== crawlGeneration) return; // crawl superseded between phases

    isFetchingMobileSpeed = true;
    pageSpeedMobileError = '';
    log('Requesting Google PageSpeed Mobile report...');
    try {
      const mobileStats = await fetchPageSpeed(url, 'mobile', settings.apiKey);
      if (myGen !== crawlGeneration) return; // superseded; discard stale result
      if (auditResults) {
        auditResults.pageSpeedMobile = mobileStats;
        log(`PageSpeed Mobile completed: Score ${mobileStats.score}/100`);
      }
    } catch (err: any) {
      if (myGen !== crawlGeneration) return;
      pageSpeedMobileError = err.message || 'Failed';
      log(`[WARN] PageSpeed Mobile audit failed: ${pageSpeedMobileError}`);
    } finally {
      if (myGen === crawlGeneration) {
        isFetchingMobileSpeed = false;
        saveCrawlToHistory();
      }
    }

    if (myGen !== crawlGeneration) return;
    recalculateOverallScore();
    saveCrawlToHistory();
  }

  return {
    get isScanning() {
      return isScanning;
    },
    get isValidatingLinks() {
      return isValidatingLinks;
    },
    get auditResults() {
      return auditResults;
    },
    get scanLogs() {
      return scanLogs;
    },
    get checkedLinksCount() {
      return checkedLinksCount;
    },
    get totalLinksCount() {
      return totalLinksCount;
    },
    get isFetchingMobileSpeed() {
      return isFetchingMobileSpeed;
    },
    get isFetchingDesktopSpeed() {
      return isFetchingDesktopSpeed;
    },
    get pageSpeedMobileError() {
      return pageSpeedMobileError;
    },
    get pageSpeedDesktopError() {
      return pageSpeedDesktopError;
    },
    get error() {
      return error;
    },
    log,
    start,
    recrawl,
    // Public form keeps the single-arg signature the PageSpeed tab calls with;
    // the generation defaults to the current generation internally.
    triggerPageSpeedAudits: (url: string) => triggerPageSpeedAudits(url)
  };
}
