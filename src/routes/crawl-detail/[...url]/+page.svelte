<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { summarizeAudit } from '$lib/seoEngine';
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
  import AuditSettings from '$lib/components/AuditSettings.svelte';
  import { settings } from '$lib/settings.svelte';
  import { createCrawlController } from '$lib/crawlController.svelte';
  import { downloadFile, toCsv } from '$lib/exportUtils';
  import { appState } from '$lib/sharedState.svelte';
  import { page } from '$app/state';

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

  // Crawl orchestration lives in a reusable, per-page controller. The page is a
  // thin consumer: it reads reactive crawl state via `crawl.*` getters and wires
  // in two page-only hooks for the SQL console (which the controller doesn't own):
  //  - onResultsReady: rebuild the in-memory SQL DB once fresh/cached results land
  //  - onLinksComplete: re-run the SQL query once after link validation, when the
  //    SQL tab is active (preserving the original debounced behavior).
  const crawl = createCrawlController({
    onResultsReady: () => {
      sqlResult = null;
      sqlError = '';
      runSQLQuery();
    },
    onLinksComplete: () => {
      if (activeTab === 'sql') runSQLQuery();
    }
  });

  // Tabs state
  let activeTab = $state('overview'); // overview, ai-discoverability, ai-chat, onpage, links, pagespeed, sql

  // Local reactive aliases over the controller's state. These keep the template
  // identical to before (and let Svelte narrow `auditResults` inside the
  // `{:else if auditResults}` branch). They are read-only mirrors of `crawl.*`.
  const auditResults = $derived(crawl.auditResults);
  const isScanning = $derived(crawl.isScanning);
  const crawlError = $derived(crawl.error);
  const isValidatingLinks = $derived(crawl.isValidatingLinks);
  const scanLogs = $derived(crawl.scanLogs);
  const checkedLinksCount = $derived(crawl.checkedLinksCount);
  const totalLinksCount = $derived(crawl.totalLinksCount);
  const isFetchingMobileSpeed = $derived(crawl.isFetchingMobileSpeed);
  const isFetchingDesktopSpeed = $derived(crawl.isFetchingDesktopSpeed);
  const pageSpeedMobileError = $derived(crawl.pageSpeedMobileError);
  const pageSpeedDesktopError = $derived(crawl.pageSpeedDesktopError);

  // Update layout shared state reactively
  $effect(() => {
    appState.hasResults = !!auditResults;
  });

  // Settings & Crawl Initialization
  onMount(() => {
    initSqlEngine().catch(err => {
      console.error('Failed to load SQL engine:', err);
      crawl.log(`[ERROR] SQL Engine failure: ${err.message || err}`);
    });

    settings.load();
  });

  // Reactive crawl trigger when the normalized target URL changes.
  // Only `currentUrl` is tracked; the crawl itself runs untracked so that
  // reactive reads inside the controller don't re-trigger it. The same-url
  // de-bounce guard now lives inside `crawl.start`.
  $effect(() => {
    const url = currentUrl;
    if (!url) return;
    untrack(() => crawl.start(url));
  });

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
    const results = crawl.auditResults;
    if (!results) return;
    sqlError = '';
    const res = executeSQLQuery(sqlQuery, results);
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

    const { columns } = sqlResult;
    const rows = sqlResult.rows.map(row =>
      columns.map(col => (row[col] === null ? 'NULL' : row[col]))
    );

    const csvContent = toCsv([columns, ...rows]);
    downloadFile('sql-query-results.csv', 'text/csv;charset=utf-8', csvContent);
  }

  function handlePDFExport() {
    const results = crawl.auditResults;
    if (!results) return;
    crawl.log('Generating branded PDF report...');
    exportSEOReport(results);
    crawl.log('PDF Report downloaded.');
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

  // Derived metric values from the single shared summary fn.
  const summary = $derived(
    auditResults
      ? summarizeAudit(auditResults)
      : { errorCount: 0, warningCount: 0, passedCount: 0 }
  );
  const errorCount = $derived(summary.errorCount);
  const warningCount = $derived(summary.warningCount);
  const passedCount = $derived(summary.passedCount);
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
        <div class="mt-4">
          <AuditSettings
            title="Crawl Configurations (Active)"
            intro="Adjust configurations below if you need to rerun or modify the proxy parameters."
            saveLabel="Update settings"
            onsave={() => crawl.log('Settings updated and stored locally.')}
          />
        </div>
      </div>
    </section>
  {:else if crawlError && !auditResults}
    <!-- Crawl Failure State: surfaces the error + captured logs so the user is
         never left on a blank page, with a one-click retry. -->
    <section class="error-wrapper container mt-4">
      <div class="error-header font-mono text-center">
        <h2 class="title-md text-error">// TARGET_CRAWL_FAILED</h2>
        <p class="text-muted text-xs mt-1">The audit could not be completed. Review the error and the captured log stream below, then retry.</p>
        <p class="monotext text-ink text-sm mt-2">{currentUrl}</p>
      </div>

      <div class="error-grid mt-4">
        <div class="card-dark error-card">
          <span class="error-card-label font-mono">ERROR</span>
          <p class="error-message monotext">{crawlError}</p>
          <button class="btn-recrawl font-mono mt-2" onclick={() => crawl.recrawl()}>
            🔄 Try Again
          </button>
        </div>

        <!-- Persist the captured logs so the failure context survives. -->
        <ConsoleHud
          logs={scanLogs}
          title="AUDIT_LOG_STREAM // {currentUrl}"
          emptyText="no log output captured."
          viewportHeight={280}
        />
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
                <button class="btn-recrawl font-mono" onclick={() => crawl.recrawl()}>
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
              triggerPageSpeedAudits={crawl.triggerPageSpeedAudits}
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

  /* Crawl failure state */
  .error-wrapper {
    max-width: 900px;
    margin: 0 auto;
    padding: var(--spacing-xl) 0;
  }

  .error-header h2 {
    font-size: 18px;
    letter-spacing: 0.5px;
  }

  .error-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .error-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-lg);
    border: 1px solid var(--color-error);
  }

  .error-card-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--color-error);
  }

  .error-message {
    font-size: 13px;
    color: var(--color-ink);
    word-break: break-word;
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
  }
</style>
