<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { runSEOAudit, validateLinks, fetchPageSpeed, calculateGrade } from '$lib/seoEngine';
  import type { AuditResults, LinkItem, PageSpeedMetric } from '$lib/seoEngine';
  import { executeSQLQuery, initSqlEngine } from '$lib/sqlEngine';
  import type { SQLQueryResult } from '$lib/sqlEngine';
  import { exportSEOReport } from '$lib/pdfExporter';
  import SEO from '$lib/components/SEO.svelte';
  import DashboardTab from '$lib/components/DashboardTab.svelte';
  import OnPageTab from '$lib/components/OnPageTab.svelte';
  import LinksTab from '$lib/components/LinksTab.svelte';
  import PageSpeedTab from '$lib/components/PageSpeedTab.svelte';
  import SqlConsoleTab from '$lib/components/SqlConsoleTab.svelte';
  import AiChatTab from '$lib/components/AiChatTab.svelte';
  import AIDiscoverabilityTab from '$lib/components/AIDiscoverabilityTab.svelte';
  import ConsoleHud from '$lib/components/ConsoleHud.svelte';
  import { appState } from '$lib/sharedState.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  // Get raw target URL from params + query search
  const rawUrl = $derived(page.params.url + page.url.search + page.url.hash);

  // Pure normalization: trim and ensure a protocol is present.
  function normalizeUrl(u: string): string {
    let normalized = u.trim();
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = 'https://' + normalized;
    }
    return normalized;
  }

  // Derived normalized target URL (no state mutation inside effects).
  const currentUrl = $derived(rawUrl ? normalizeUrl(rawUrl) : '');

  // Local state for scan & settings
  let proxyUrl = $state('https://corsproxy.io/?url=');
  let selectedProxy = $state('https://corsproxy.io/?url=');
  let apiKey = $state('');
  
  $effect(() => {
    if (selectedProxy !== 'custom') {
      proxyUrl = selectedProxy;
    }
  });

  let isScanning = $state(false);
  let scanLogs = $state<string[]>([]);
  let auditResults = $state<AuditResults | null>(null);

  // Crawl cancellation token: identifies the latest in-flight crawl so that
  // async callbacks from a superseded crawl can be discarded.
  let crawlGeneration = 0;
  let currentAbort: AbortController | null = null;

  // Link checking state
  let isValidatingLinks = $state(false);
  let checkedLinksCount = $state(0);
  let totalLinksCount = $state(0);

  // Tabs state
  let activeTab = $state('overview'); // overview, ai-discoverability, ai-chat, onpage, links, pagespeed, sql

  // Update layout shared state reactively
  $effect(() => {
    appState.hasResults = !!auditResults;
  });

  // Log message logger
  function log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    scanLogs = [...scanLogs, `[${timestamp}] ${message}`];
  }

  // Caching & History logic
  function loadCrawlHistory(): any[] {
    const saved = localStorage.getItem('seo_crawl_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse crawl history:', e);
      }
    }
    return [];
  }

  function saveCrawlToHistory() {
    const results = auditResults;
    if (!results) return;
    
    let historyList = loadCrawlHistory();
    
    // Count errors and warnings
    const errCount = (results.onPage.title.status === 'missing' ? 1 : 0) +
      (results.onPage.description.status === 'missing' ? 1 : 0) +
      (results.onPage.headings.status === 'error' ? 1 : 0) +
      (results.onPage.imageAlts.status === 'error' ? 1 : 0) +
      results.links.filter(l => l.statusState === 'broken').length;

    const warnCount = (results.onPage.title.status === 'warning' ? 1 : 0) +
      (results.onPage.description.status === 'warning' ? 1 : 0) +
      (results.onPage.headings.status === 'warning' ? 1 : 0) +
      (results.onPage.imageAlts.status === 'warning' ? 1 : 0) +
      (results.onPage.canonical.status === 'missing' ? 1 : 0) +
      (results.onPage.openGraph.status === 'missing' ? 1 : 0);

    const historyItem = {
      url: results.url,
      timestamp: results.timestamp || new Date().toISOString(),
      score: results.score,
      grade: results.grade,
      errorCount: errCount,
      warningCount: warnCount,
      results: $state.snapshot(results)
    };
    
    historyList = historyList.filter(item => item.url !== results.url);
    historyList = [historyItem, ...historyList].slice(0, 6);
    
    try {
      localStorage.setItem('seo_crawl_history', JSON.stringify(historyList));
    } catch (e) {
      console.warn('Failed to save crawl to history:', e);
    }
  }

  // Settings & Crawl Initialization
  onMount(() => {
    initSqlEngine().catch(err => {
      console.error('Failed to load SQL engine:', err);
      log(`[ERROR] SQL Engine failure: ${err.message || err}`);
    });

    const savedProxy = localStorage.getItem('seo_proxy_url');
    const savedKey = localStorage.getItem('seo_pagespeed_key');
    
    if (savedProxy) {
      proxyUrl = savedProxy;
    }
    
    if (proxyUrl === 'https://corsproxy.io/?url=') {
      selectedProxy = 'https://corsproxy.io/?url=';
    } else if (proxyUrl === 'https://api.allorigins.win/raw?url=') {
      selectedProxy = 'https://api.allorigins.win/raw?url=';
    } else {
      selectedProxy = 'custom';
    }
    
    if (savedKey) apiKey = savedKey;
  });

  // Reactive crawl trigger when the normalized target URL changes.
  // Only `currentUrl` is tracked; the crawl itself runs untracked so that
  // reactive reads inside checkCacheAndCrawl/runFreshScan don't re-trigger it.
  let lastCrawledUrl = '';
  $effect(() => {
    const url = currentUrl;
    if (!url) return;
    untrack(() => {
      if (lastCrawledUrl === url) return;
      lastCrawledUrl = url;
      void checkCacheAndCrawl(url);
    });
  });

  async function checkCacheAndCrawl(url: string, forceRecrawl = false) {
    // Begin a new crawl: bump generation and abort any prior in-flight work
    // so superseded async callbacks can be discarded.
    const myGen = ++crawlGeneration;
    currentAbort?.abort();
    currentAbort = new AbortController();

    isScanning = true;
    auditResults = null;
    scanLogs = [];
    sqlResult = null;
    sqlError = '';
    checkedLinksCount = 0;
    totalLinksCount = 0;

    const history = loadCrawlHistory();
    const cachedItem = history.find(item => item.url === url);

    if (cachedItem && !forceRecrawl) {
      log(`Cache hit: loading cached crawl report for ${url}`);
      // Deep clone to ensure reactivity binds cleanly
      auditResults = JSON.parse(JSON.stringify(cachedItem.results));
      runSQLQuery();
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

  // Primary Crawling Execution
  async function runFreshScan(urlToScan: string, myGen: number) {
    // checkCacheAndCrawl always creates a fresh controller before delegating here.
    const abortSignal = currentAbort?.signal;
    try {
      // 1. Crawl & Run On-Page Audit
      const results = await runSEOAudit(urlToScan, proxyUrl, (msg) => log(msg));
      if (myGen !== crawlGeneration) return; // superseded by a newer crawl
      auditResults = results;

      // Auto query default SQL console values
      runSQLQuery();
      saveCrawlToHistory();

      // 2. Validate Hyperlinks Asynchronously
      totalLinksCount = results.links.length;
      if (totalLinksCount > 0) {
        log(`Found ${totalLinksCount} unique links to check. Starting validation...`);
        isValidatingLinks = true;

        validateLinks(
          results.links,
          proxyUrl,
          (updatedLink) => {
            if (myGen !== crawlGeneration) return; // discard stale link result
            if (auditResults) {
              const idx = auditResults.links.findIndex(l => l.id === updatedLink.id);
              if (idx !== -1) {
                auditResults.links[idx] = updatedLink;
              }
              checkedLinksCount = auditResults.links.filter(l => l.statusState !== 'pending' && l.statusState !== 'checking').length;
            }
          },
          () => {
            if (myGen !== crawlGeneration) return; // crawl superseded; ignore
            isValidatingLinks = false;
            log('Link checking completed.');
            recalculateOverallScore();
            saveCrawlToHistory();
            // Debounced SQL re-query: rebuild the in-memory DB once, after all
            // link results are in, instead of on every per-link update.
            if (activeTab === 'sql') runSQLQuery();
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
      const desktopStats = await fetchPageSpeed(url, 'desktop', apiKey);
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
      const mobileStats = await fetchPageSpeed(url, 'mobile', apiKey);
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

  // Score recalculations
  function recalculateOverallScore() {
    if (!auditResults) return;
    
    let baseScore = auditResults.score;
    
    const brokenLinks = auditResults.links.filter(l => l.statusState === 'broken').length;
    if (brokenLinks > 0) {
      baseScore -= Math.min(15, brokenLinks * 2);
    }

    let performanceSum = 0;
    let perfCounts = 0;
    if (auditResults.pageSpeedDesktop) {
      performanceSum += auditResults.pageSpeedDesktop.score;
      perfCounts++;
    }
    if (auditResults.pageSpeedMobile) {
      performanceSum += auditResults.pageSpeedMobile.score;
      perfCounts++;
    }

    if (perfCounts > 0) {
      const avgPerformance = performanceSum / perfCounts;
      baseScore = Math.round((baseScore * 0.6) + (avgPerformance * 0.4));
    }

    auditResults.score = Math.max(0, Math.min(100, baseScore));
    auditResults.grade = calculateGrade(auditResults.score);
  }

  // Settings controls
  function saveSettings() {
    localStorage.setItem('seo_proxy_url', proxyUrl);
    localStorage.setItem('seo_pagespeed_key', apiKey);
    log('Settings updated and stored locally.');
  }

  // PageSpeed states
  let isFetchingMobileSpeed = $state(false);
  let isFetchingDesktopSpeed = $state(false);
  let pageSpeedMobileError = $state('');
  let pageSpeedDesktopError = $state('');

  // SQL Console state
  let sqlQuery = $state('SELECT href, text, type FROM links WHERE status != 200');
  let sqlResult = $state<SQLQueryResult | null>(null);
  let sqlError = $state('');

  let sampleQueries = [
    { name: 'Broken Links', query: "SELECT href, text, status_state FROM links WHERE status_state = 'broken'" },
    { name: 'Images Missing Alt', query: "SELECT src, alt FROM images WHERE is_missing = 1" },
    { name: 'H1 & H2 Headings', query: "SELECT tag, text FROM headings WHERE tag = 'h1' OR tag = 'h2'" },
    { name: 'Meta Warning Issues', query: "SELECT name, content, status FROM meta WHERE status = 'warning' OR status = 'missing'" }
  ];

  function runSQLQuery() {
    if (!auditResults) return;
    sqlError = '';
    const res = executeSQLQuery(sqlQuery, auditResults);
    if (res.error) {
      sqlError = res.error;
      sqlResult = null;
    } else {
      sqlResult = res;
    }
  }

  function setSampleQuery(queryText: string) {
    sqlQuery = queryText;
    runSQLQuery();
  }

  function exportQueryToCSV() {
    if (!sqlResult || sqlResult.rows.length === 0) return;
    
    const headers = sqlResult.columns.join(',');
    const rows = sqlResult.rows.map(row => 
      sqlResult!.columns.map(col => {
        const val = row[col] === null ? 'NULL' : row[col];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sql-query-results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePDFExport() {
    if (!auditResults) return;
    log('Generating branded PDF report...');
    exportSEOReport(auditResults);
    log('PDF Report downloaded.');
  }

  function jumpToSection(tabName: string, elementSelector?: string) {
    activeTab = tabName;
    if (elementSelector) {
      setTimeout(() => {
        const el = document.querySelector(elementSelector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('jump-highlight');
          setTimeout(() => el.classList.remove('jump-highlight'), 2000);
        }
      }, 60);
    }
  }

  // derived metrics values
  const errorCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'missing' ? 1 : 0) +
      (auditResults.onPage.description.status === 'missing' ? 1 : 0) +
      (auditResults.onPage.headings.status === 'error' ? 1 : 0) +
      (auditResults.onPage.imageAlts.status === 'error' ? 1 : 0) +
      auditResults.links.filter(l => l.statusState === 'broken').length
  : 0);

  const warningCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'warning' ? 1 : 0) +
      (auditResults.onPage.description.status === 'warning' ? 1 : 0) +
      (auditResults.onPage.headings.status === 'warning' ? 1 : 0) +
      (auditResults.onPage.imageAlts.status === 'warning' ? 1 : 0) +
      (auditResults.onPage.canonical.status === 'missing' ? 1 : 0) +
      (auditResults.onPage.openGraph.status === 'missing' ? 1 : 0)
  : 0);

  const passedCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'ok' ? 1 : 0) +
      (auditResults.onPage.description.status === 'ok' ? 1 : 0) +
      (auditResults.onPage.headings.status === 'ok' ? 1 : 0) +
      (auditResults.onPage.imageAlts.status === 'ok' ? 1 : 0) +
      (auditResults.onPage.canonical.status === 'ok' ? 1 : 0) +
      (auditResults.onPage.openGraph.status === 'ok' ? 1 : 0) +
      auditResults.links.filter(l => l.statusState === 'ok').length
  : 0);
</script>

<SEO path="crawl-detail" title={currentUrl ? `Audit: ${currentUrl}` : 'Crawling Detail'} />

<div class="dashboard-page">
  {#if isScanning}
    <!-- Scanning HUD Display -->
    <section class="scanning-wrapper container mt-4">
      <div class="scanning-header font-mono text-center">
        <h2 class="title-md text-primary">// TARGET_CRAWL_IN_PROGRESS</h2>
        <p class="text-muted text-xs mt-1">Analyzing client-side DOM structure, checking robots schema, and parsing outbound hyper-references.</p>
        <p class="monotext text-ink text-sm mt-2">{currentUrl}</p>
      </div>

      <div class="hud-scanning-grid mt-4">
        <!-- Live HUD Canvas & Logs Console -->
        <ConsoleHud
          logs={scanLogs}
          title="AUDIT_LOG_STREAM // {currentUrl}"
          emptyText="initializing neural crawl engine..."
          viewportHeight={280}
        />

        <!-- Audit Configurations inside crawl screen -->
        <div class="settings-drawer card-dark mt-4">
          <h3 class="title-sm">Crawl Configurations (Active)</h3>
          <p class="text-muted text-xs mb-3">Adjust configurations below if you need to rerun or modify the proxy parameters.</p>
          <div class="settings-grid">
            <div class="field proxy-field-group">
              <div class="proxy-select-wrap">
                <label for="proxy-select">CORS Proxy Choice</label>
                <select id="proxy-select" class="text-input select-input" bind:value={selectedProxy}>
                  <option value="https://corsproxy.io/?url=">CORSProxy.io (Recommended)</option>
                  <option value="https://api.allorigins.win/raw?url=">AllOrigins (Raw)</option>
                  <option value="custom">Custom Proxy...</option>
                </select>
              </div>
              {#if selectedProxy === 'custom'}
                <div class="proxy-input-wrap animate-fade-in mt-1">
                  <label for="proxy-input">Custom Proxy URL</label>
                  <input id="proxy-input" type="text" class="text-input" bind:value={proxyUrl} placeholder="e.g. https://myproxy.com/?url=" />
                </div>
              {/if}
            </div>
            <div class="field">
              <label for="pagespeed-input">PageSpeed API Key (Optional)</label>
              <input id="pagespeed-input" type="password" class="text-input" bind:value={apiKey} placeholder="Google Cloud API Key" />
            </div>
            <button class="btn btn-secondary save-btn font-mono" onclick={saveSettings}>Update settings</button>
          </div>
        </div>
      </div>
    </section>
  {:else if auditResults}
    <!-- Results Dashboard -->
    <section class="results-section" id="overview">
      <div class="container">
        <!-- Executive Dashboard Banner -->
        <div class="stats-row">
          <!-- Grade Circle Ring -->
          <div class="card-dark grade-card">
            <div class="grade-ring-container">
              <svg class="progress-ring" width="120" height="120">
                <circle class="progress-ring-bg" stroke="#1f1f1f" stroke-width="8" fill="transparent" r="50" cx="60" cy="60" />
                <circle 
                  class="progress-ring-fill" 
                  stroke="var(--color-primary)" 
                  stroke-width="8" 
                  stroke-dasharray="314.16"
                  stroke-dashoffset={314.16 - (314.16 * auditResults.score) / 100}
                  fill="transparent" 
                  r="50" 
                  cx="60" 
                  cy="60" 
                />
              </svg>
              <div class="grade-text-overlay">
                <span class="grade-letter">{auditResults.grade}</span>
                <span class="grade-score">{auditResults.score}/100</span>
              </div>
            </div>
            <div class="grade-info">
              <h2 class="title-lg">Crawl Summary</h2>
              <p>Target: <span class="monotext">{auditResults.url}</span></p>
              <div class="flex-row mt-1">
                <span class="scan-time">Checked: {new Date(auditResults.timestamp).toLocaleTimeString()}</span>
                <button class="btn-recrawl font-mono" onclick={() => checkCacheAndCrawl(currentUrl, true)}>
                  🔄 Recrawl
                </button>
              </div>
            </div>
          </div>

          <!-- Quick Metrics widgets -->
          <div class="quick-metrics-grid">
            <div class="metric-card card-dark">
              <span class="metric-num text-error">{errorCount}</span>
              <span class="metric-label">CRITICAL ERRORS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-warning">{warningCount}</span>
              <span class="metric-label">WARNINGS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-success">{passedCount}</span>
              <span class="metric-label">PASSED AUDITS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-blue">{auditResults.links.length}</span>
              <span class="metric-label">TOTAL LINKS</span>
            </div>
          </div>
        </div>

        <!-- Floating PDF Export Trigger -->
        <div class="action-banner card-dark">
          <div class="banner-text">
            <h3 class="title-md">SEO Audit Report Completed</h3>
            <p>Generate a technical PDF report containing all heading outlines, broken link details, and PageSpeed metrics.</p>
          </div>
          <button class="btn btn-primary" onclick={handlePDFExport}>Export PDF Report</button>
        </div>

        <!-- Primary Tabs navigation -->
        <div class="tabs-nav">
          <button class="tab-btn" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>Overview</button>
          <button class="tab-btn" class:active={activeTab === 'ai-discoverability'} onclick={() => activeTab = 'ai-discoverability'}>✨ AI Insights</button>
          <button class="tab-btn" class:active={activeTab === 'ai-chat'} onclick={() => activeTab = 'ai-chat'}>✨ AI Chat</button>
          <button class="tab-btn" class:active={activeTab === 'onpage'} onclick={() => activeTab = 'onpage'}>On-Page SEO</button>
          <button class="tab-btn" class:active={activeTab === 'links'} onclick={() => activeTab = 'links'}>Links Auditor</button>
          <button class="tab-btn" class:active={activeTab === 'pagespeed'} onclick={() => activeTab = 'pagespeed'}>PageSpeed</button>
          <button class="tab-btn sql-tab-btn" class:active={activeTab === 'sql'} onclick={() => activeTab = 'sql'}>SQL Console</button>
        </div>

        <!-- TAB CONTENT: OVERVIEW -->
        {#if activeTab === 'overview'}
          <div class="tab-content" id="overview-content">
            <DashboardTab 
              {auditResults} 
              {isValidatingLinks} 
              {checkedLinksCount} 
              {totalLinksCount} 
              jumpToSection={jumpToSection}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: AI DISCOVERABILITY -->
        {#if activeTab === 'ai-discoverability'}
          <div class="tab-content" id="ai-discoverability-content">
            <AIDiscoverabilityTab audit={auditResults.aiDiscoverability} />
          </div>
        {/if}

        <!-- TAB CONTENT: ON-PAGE DETAIL -->
        {#if activeTab === 'onpage'}
          <div class="tab-content" id="onpage-content">
            <OnPageTab {auditResults} />
          </div>
        {/if}

        <!-- TAB CONTENT: LINKS MAP -->
        {#if activeTab === 'links'}
          <div class="tab-content" id="links-content">
            <LinksTab 
              {auditResults} 
              {isValidatingLinks} 
              {checkedLinksCount} 
              {totalLinksCount}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: PAGESPEED -->
        {#if activeTab === 'pagespeed'}
          <div class="tab-content" id="pagespeed-content">
            <PageSpeedTab 
              {auditResults}
              {isFetchingMobileSpeed}
              {isFetchingDesktopSpeed}
              {pageSpeedMobileError}
              {pageSpeedDesktopError}
              {triggerPageSpeedAudits}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: SQL CLIENT CONSOLE -->
        {#if activeTab === 'sql'}
          <div class="tab-content" id="sql-content">
            <SqlConsoleTab 
              {auditResults}
              bind:sqlQuery
              {sqlResult}
              {sqlError}
              runSQLQuery={runSQLQuery}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: AI CHAT PANEL -->
        {#if activeTab === 'ai-chat'}
          <div class="tab-content" id="ai-chat-content">
            <AiChatTab {auditResults} />
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .dashboard-page {
    padding-bottom: 80px;
  }

  .scanning-wrapper {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--spacing-xl) 0;
  }

  .scanning-header h2 {
    font-size: 18px;
    letter-spacing: 0.5px;
  }

  .hud-scanning-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .flex-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .btn-recrawl {
    background-color: var(--color-surface-soft);
    border: 1px solid var(--color-hairline);
    color: var(--color-muted);
    border-radius: var(--rounded-md);
    font-size: 11px;
    height: 24px;
    padding: 0 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-recrawl:hover {
    color: var(--color-primary);
    border-color: var(--color-primary);
    background-color: rgba(250, 255, 105, 0.05);
  }

  .settings-drawer {
    padding: var(--spacing-md);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-top: var(--spacing-xs);
  }

  .settings-grid label {
    font-size: 12px;
    color: var(--color-muted);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: var(--spacing-xxs);
    display: block;
  }

  .text-input {
    background-color: var(--color-surface-soft);
    border: 1px solid var(--color-hairline);
    border-radius: var(--rounded-sm);
    color: var(--color-on-dark);
    padding: 8px 12px;
    outline: none;
    width: 100%;
    font-size: 14px;
  }

  .text-input:focus {
    border-color: var(--color-primary);
  }

  .save-btn {
    height: 38px;
  }

  /* Results dashboard layout */
  .results-section {
    padding: 64px 0;
  }

  .stats-row {
    display: grid;
    grid-template-columns: 5fr 7fr;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  /* Grade summary scorecard */
  .grade-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
  }

  .grade-ring-container {
    position: relative;
    width: 120px;
    height: 120px;
    flex-shrink: 0;
  }

  .progress-ring {
    transform: rotate(-90deg);
  }

  .progress-ring-fill {
    transition: stroke-dashoffset 0.35s;
    transform-origin: 50% 50%;
  }

  .grade-text-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .grade-letter {
    font-size: 38px;
    font-weight: 800;
    color: var(--color-on-dark);
    letter-spacing: -1px;
  }

  .grade-score {
    font-size: 11px;
    color: var(--color-muted);
    font-family: var(--font-family-mono);
    margin-top: 2px;
  }

  .grade-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .grade-info p {
    font-size: 13px;
    color: var(--color-muted);
  }

  .grade-info .scan-time {
    font-size: 11px;
    color: var(--color-muted-soft);
  }

  /* Quick Metrics Grid */
  .quick-metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-md);
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-lg);
    text-align: center;
  }

  .metric-num {
    font-size: 32px;
    font-weight: 700;
    font-family: var(--font-family-mono);
    line-height: 1.1;
  }

  .metric-label {
    font-size: 10px;
    color: var(--color-muted);
    font-weight: 700;
    letter-spacing: 0.5px;
    margin-top: var(--spacing-xs);
  }

  /* Branded Action Banner */
  .action-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg) var(--spacing-xl);
    margin-bottom: var(--spacing-xl);
  }

  .banner-text p {
    font-size: 14px;
    color: var(--color-muted);
    margin-top: 4px;
  }

  /* Tab Navigation bar */
  .tabs-nav {
    display: flex;
    gap: var(--spacing-xs);
    border-bottom: 1px solid var(--color-hairline);
    margin-bottom: var(--spacing-xl);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs-nav::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    padding: var(--spacing-md) var(--spacing-lg);
    cursor: pointer;
    position: relative;
    transition: color 0.15s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: var(--color-ink);
  }

  .tab-btn.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .tab-btn.active::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background-color: var(--color-primary);
  }

  .sql-tab-btn.active {
    color: var(--color-accent-blue);
  }

  .sql-tab-btn.active::after {
    background-color: var(--color-accent-blue);
  }

  .tab-content {
    animation: tab-switch 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes tab-switch {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Mobile responsiveness adaptations */
  @media (max-width: 1024px) {
    .stats-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .quick-metrics-grid {
      grid-template-columns: 1fr 1fr;
    }
    .action-banner {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-md);
    }
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
