<script lang="ts">
  import type { AuditResults } from '$lib/seoEngine';
  import { lighthouseBand, lighthouseHex } from '$lib/scoreUtils';
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let { 
    auditResults, 
    isFetchingMobileSpeed, 
    isFetchingDesktopSpeed, 
    pageSpeedMobileError, 
    pageSpeedDesktopError,
    triggerPageSpeedAudits
  }: { 
    auditResults: AuditResults; 
    isFetchingMobileSpeed: boolean; 
    isFetchingDesktopSpeed: boolean; 
    pageSpeedMobileError: string; 
    pageSpeedDesktopError: string;
    triggerPageSpeedAudits: (url: string) => Promise<void>;
  } = $props();

  // Active explainer card
  let activeExplainer = $state<string | null>(null);

  // Expanded state for recommendation cards
  let expandedRecs = $state<Record<string, boolean>>({});

  // Collapsible passed audits state
  let showPassedAudits = $state(false);

  function toggleExplainer(metric: string) {
    if (activeExplainer === metric) activeExplainer = null;
    else activeExplainer = metric;
  }

  function toggleRec(recTitle: string) {
    expandedRecs[recTitle] = !expandedRecs[recTitle];
  }

  // Parse string values (like "1.8 s" or "250 ms") into numbers for range bars
  function parseMetric(valStr: string): number {
    if (!valStr || valStr === 'N/A') return 0;
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  // Vitals threshold classifiers
  const getLcpStatus = (valStr: string) => {
    const val = parseMetric(valStr);
    if (val === 0) return { pct: 0, color: 'var(--color-muted)', label: 'N/A' };
    if (val <= 2.5) return { pct: (val / 2.5) * 33, color: 'var(--color-success)', label: 'Good' };
    if (val <= 4.0) return { pct: 33 + ((val - 2.5) / 1.5) * 33, color: 'var(--color-warning)', label: 'Needs Improvement' };
    return { pct: 66 + Math.min(34, ((val - 4.0) / 4.0) * 34), color: 'var(--color-error)', label: 'Poor' };
  };

  const getTbtStatus = (valStr: string) => {
    const val = parseMetric(valStr);
    if (val === 0) return { pct: 0, color: 'var(--color-muted)', label: 'N/A' };
    if (val <= 200) return { pct: (val / 200) * 33, color: 'var(--color-success)', label: 'Good' };
    if (val <= 600) return { pct: 33 + ((val - 200) / 400) * 33, color: 'var(--color-warning)', label: 'Needs Improvement' };
    return { pct: 66 + Math.min(34, ((val - 600) / 1000) * 34), color: 'var(--color-error)', label: 'Poor' };
  };

  const getClsStatus = (valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return { pct: 0, color: 'var(--color-muted)', label: 'N/A' };
    if (val <= 0.1) return { pct: (val / 0.1) * 33, color: 'var(--color-success)', label: 'Good' };
    if (val <= 0.25) return { pct: 33 + ((val - 0.1) / 0.15) * 33, color: 'var(--color-warning)', label: 'Needs Improvement' };
    return { pct: 66 + Math.min(34, ((val - 0.25) / 0.25) * 34), color: 'var(--color-error)', label: 'Poor' };
  };

  // Compare mobile vs desktop differences
  const deltaMetrics = $derived.by(() => {
    if (!auditResults.pageSpeedMobile || !auditResults.pageSpeedDesktop) return null;
    
    const m = auditResults.pageSpeedMobile;
    const d = auditResults.pageSpeedDesktop;

    const parseVal = (str: string) => parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    
    const lcpDiff = parseVal(m.lcp) - parseVal(d.lcp);
    const clsDiff = parseVal(m.cls) - parseVal(d.cls);
    const tbtDiff = parseVal(m.tbt) - parseVal(d.tbt);

    return {
      score: m.score - d.score,
      lcp: lcpDiff,
      cls: clsDiff,
      tbt: tbtDiff
    };
  });
</script>

<div class="pagespeed-tab" id="pagespeed-section">
  
  <!-- Trigger audit panel if PageSpeed isn't loaded -->
  {#if !auditResults.pageSpeedMobile && !auditResults.pageSpeedDesktop && !isFetchingDesktopSpeed && !isFetchingMobileSpeed}
    <div class="trigger-audit-card card-dark text-center font-sans">
      <h3 class="title-md">Trigger Web Vitals Performance Audit</h3>
      <p class="mt-2 text-muted max-w-sm">Connects to the Google PageSpeed Insights API to pull comprehensive Lighthouse performance metrics, loading times, and diagnostics for Mobile & Desktop strategy views.</p>
      <button class="btn btn-primary mt-4" onclick={() => triggerPageSpeedAudits(auditResults.url)}>Run Performance Audit</button>
    </div>
  {/if}

  <!-- Loading states -->
  {#if isFetchingDesktopSpeed || isFetchingMobileSpeed}
    <div class="trigger-audit-card card-dark text-center font-mono border-warning">
      <div class="loader-spinner"></div>
      <h3 class="title-md text-warning mt-4">Connecting to Google PageSpeed APIs...</h3>
      <p class="text-muted mt-2">Running Lighthouse visual performance simulations. This may take up to 20-30 seconds.</p>
    </div>
  {/if}

  <!-- PageSpeed Dashboard Results -->
  {#if (auditResults.pageSpeedMobile || auditResults.pageSpeedDesktop) && !isFetchingDesktopSpeed && !isFetchingMobileSpeed}
    
    <!-- Strategy Overview cards with circular animated gauges -->
    <div class="pagespeed-grids grid grid-2">
      
      <!-- Desktop panel -->
      <div class="strategy-card card-dark">
        <div class="card-header-row">
          <h3 class="title-md">Desktop Vitals</h3>
          {#if pageSpeedDesktopError}
            <span class="badge badge-error">API Error</span>
          {:else if auditResults.pageSpeedDesktop}
            <span class="badge badge-success">Google Verified</span>
          {/if}
        </div>

        {#if pageSpeedDesktopError}
          <p class="error-msg font-mono">{pageSpeedDesktopError}</p>
        {:else if auditResults.pageSpeedDesktop}
          {@const score = auditResults.pageSpeedDesktop.score}
          <div class="gauge-score-row mt-2">
            <div class="gauge-wrapper">
              <svg class="progress-gauge" width="100" height="100" viewBox="0 0 100 100">
                <circle class="gauge-bg" cx="50" cy="50" r="42" stroke="#222" stroke-width="8" fill="none" />
                <circle class="gauge-fill" cx="50" cy="50" r="42" stroke={lighthouseHex(score)} stroke-width="8" stroke-dasharray="263.89" stroke-dashoffset={263.89 - (263.89 * score) / 100} fill="none" stroke-linecap="round" />
              </svg>
              <span class="gauge-text" style="color: {lighthouseHex(score)}">{score}</span>
            </div>
            <div class="score-meta">
              <span class="score-grade font-mono" class:text-success={lighthouseBand(score) === 'success'} class:text-warning={lighthouseBand(score) === 'warning'} class:text-error={lighthouseBand(score) === 'error'}>
                {#if score >= 90}GOOD{:else if score >= 50}NEEDS IMPROVEMENT{:else}POOR{/if}
              </span>
              <p class="text-muted font-sans mt-1">Lighthouse Desktop simulation audit score.</p>
            </div>
          </div>

          <!-- Threshold range bars for vitals -->
          <div class="vitals-range-list mt-4 font-sans">
            <!-- LCP -->
            <div class="vital-range-row clickable" onclick={() => toggleExplainer('lcp')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('lcp')}>
              <div class="label-row">
                <span class="vital-title">Largest Contentful Paint (LCP)</span>
                <span class="vital-value" style="color: {getLcpStatus(auditResults.pageSpeedDesktop.lcp).color}">{auditResults.pageSpeedDesktop.lcp}</span>
              </div>
              <ProgressBar value={getLcpStatus(auditResults.pageSpeedDesktop.lcp).pct} color={getLcpStatus(auditResults.pageSpeedDesktop.lcp).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0s (Good)</span>
                <span class="text-center">2.5s</span>
                <span class="text-right">4.0s (Poor)</span>
              </div>
            </div>

            <!-- TBT -->
            <div class="vital-range-row mt-4 clickable" onclick={() => toggleExplainer('tbt')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('tbt')}>
              <div class="label-row">
                <span class="vital-title">Total Blocking Time (TBT)</span>
                <span class="vital-value" style="color: {getTbtStatus(auditResults.pageSpeedDesktop.tbt).color}">{auditResults.pageSpeedDesktop.tbt}</span>
              </div>
              <ProgressBar value={getTbtStatus(auditResults.pageSpeedDesktop.tbt).pct} color={getTbtStatus(auditResults.pageSpeedDesktop.tbt).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0ms (Good)</span>
                <span class="text-center">200ms</span>
                <span class="text-right">600ms (Poor)</span>
              </div>
            </div>

            <!-- CLS -->
            <div class="vital-range-row mt-4 clickable" onclick={() => toggleExplainer('cls')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('cls')}>
              <div class="label-row">
                <span class="vital-title">Cumulative Layout Shift (CLS)</span>
                <span class="vital-value" style="color: {getClsStatus(auditResults.pageSpeedDesktop.cls).color}">{auditResults.pageSpeedDesktop.cls}</span>
              </div>
              <ProgressBar value={getClsStatus(auditResults.pageSpeedDesktop.cls).pct} color={getClsStatus(auditResults.pageSpeedDesktop.cls).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0 (Good)</span>
                <span class="text-center">0.10</span>
                <span class="text-right">0.25 (Poor)</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Mobile panel -->
      <div class="strategy-card card-dark">
        <div class="card-header-row">
          <h3 class="title-md">Mobile Vitals</h3>
          {#if pageSpeedMobileError}
            <span class="badge badge-error">API Error</span>
          {:else if auditResults.pageSpeedMobile}
            <span class="badge badge-success">Google Verified</span>
          {/if}
        </div>

        {#if pageSpeedMobileError}
          <p class="error-msg font-mono">{pageSpeedMobileError}</p>
        {:else if auditResults.pageSpeedMobile}
          {@const score = auditResults.pageSpeedMobile.score}
          <div class="gauge-score-row mt-2">
            <div class="gauge-wrapper">
              <svg class="progress-gauge" width="100" height="100" viewBox="0 0 100 100">
                <circle class="gauge-bg" cx="50" cy="50" r="42" stroke="#222" stroke-width="8" fill="none" />
                <circle class="gauge-fill" cx="50" cy="50" r="42" stroke={lighthouseHex(score)} stroke-width="8" stroke-dasharray="263.89" stroke-dashoffset={263.89 - (263.89 * score) / 100} fill="none" stroke-linecap="round" />
              </svg>
              <span class="gauge-text" style="color: {lighthouseHex(score)}">{score}</span>
            </div>
            <div class="score-meta">
              <span class="score-grade font-mono" class:text-success={lighthouseBand(score) === 'success'} class:text-warning={lighthouseBand(score) === 'warning'} class:text-error={lighthouseBand(score) === 'error'}>
                {#if score >= 90}GOOD{:else if score >= 50}NEEDS IMPROVEMENT{:else}POOR{/if}
              </span>
              <p class="text-muted font-sans mt-1">Lighthouse Mobile simulation (moto g4 throttle).</p>
            </div>
          </div>

          <!-- Threshold range bars for vitals -->
          <div class="vitals-range-list mt-4 font-sans">
            <!-- LCP -->
            <div class="vital-range-row clickable" onclick={() => toggleExplainer('lcp')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('lcp')}>
              <div class="label-row">
                <span class="vital-title">Largest Contentful Paint (LCP)</span>
                <span class="vital-value" style="color: {getLcpStatus(auditResults.pageSpeedMobile.lcp).color}">{auditResults.pageSpeedMobile.lcp}</span>
              </div>
              <ProgressBar value={getLcpStatus(auditResults.pageSpeedMobile.lcp).pct} color={getLcpStatus(auditResults.pageSpeedMobile.lcp).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0s (Good)</span>
                <span class="text-center">2.5s</span>
                <span class="text-right">4.0s (Poor)</span>
              </div>
            </div>

            <!-- TBT -->
            <div class="vital-range-row mt-4 clickable" onclick={() => toggleExplainer('tbt')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('tbt')}>
              <div class="label-row">
                <span class="vital-title">Total Blocking Time (TBT)</span>
                <span class="vital-value" style="color: {getTbtStatus(auditResults.pageSpeedMobile.tbt).color}">{auditResults.pageSpeedMobile.tbt}</span>
              </div>
              <ProgressBar value={getTbtStatus(auditResults.pageSpeedMobile.tbt).pct} color={getTbtStatus(auditResults.pageSpeedMobile.tbt).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0ms (Good)</span>
                <span class="text-center">200ms</span>
                <span class="text-right">600ms (Poor)</span>
              </div>
            </div>

            <!-- CLS -->
            <div class="vital-range-row mt-4 clickable" onclick={() => toggleExplainer('cls')} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExplainer('cls')}>
              <div class="label-row">
                <span class="vital-title">Cumulative Layout Shift (CLS)</span>
                <span class="vital-value" style="color: {getClsStatus(auditResults.pageSpeedMobile.cls).color}">{auditResults.pageSpeedMobile.cls}</span>
              </div>
              <ProgressBar value={getClsStatus(auditResults.pageSpeedMobile.cls).pct} color={getClsStatus(auditResults.pageSpeedMobile.cls).color} track="var(--color-hairline)" />
              <div class="range-labels font-mono text-muted">
                <span>0 (Good)</span>
                <span class="text-center">0.10</span>
                <span class="text-right">0.25 (Poor)</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

    </div>

    <!-- Explainer Drawer Panel -->
    {#if activeExplainer}
      <div class="explainer-panel-box card-dark border-primary mt-4 font-sans">
        {#if activeExplainer === 'lcp'}
          <h4 class="title-sm text-primary">Largest Contentful Paint (LCP)</h4>
          <p class="mt-1 text-muted">LCP measures when the largest content element (typically a hero image, video banner, or large heading block) is rendered onto the viewport screen. To optimize LCP: compression of images, preloading LCP resources, and removing render-blocking styles/scripts.</p>
        {:else if activeExplainer === 'tbt'}
          <h4 class="title-sm text-primary">Total Blocking Time (TBT)</h4>
          <p class="mt-1 text-muted">TBT calculates the total milliseconds of duration where client browser responsiveness is blocked by long-executing scripts (blocking main-thread tasks exceeding 50ms). Optimize TBT by splitting JS tasks, reducing bundle sizes, and deferring non-essential scripts.</p>
        {:else if activeExplainer === 'cls'}
          <h4 class="title-sm text-primary">Cumulative Layout Shift (CLS)</h4>
          <p class="mt-1 text-muted">CLS measures how much elements visually jump around on the screen during the loading cycle. Optimize CLS by ensuring all images/media have explicit width/height dimensions, using CSS aspect-ratio, and avoiding loading dynamic layouts above the fold.</p>
        {/if}
      </div>
    {/if}

    <!-- Mobile vs Desktop Delta strip -->
    {#if deltaMetrics}
      <div class="delta-comparison-strip card-dark mt-4 font-mono">
        <span class="strip-title">MOBILE VS DESKTOP DIFFERENTIAL:</span>
        <div class="delta-grid">
          <div class="delta-item">
            <span>Score:</span>
            <span class={deltaMetrics.score >= 0 ? 'text-success' : 'text-error'}>
              {deltaMetrics.score >= 0 ? '+' : ''}{deltaMetrics.score} points
            </span>
          </div>
          <div class="delta-item">
            <span>LCP delta:</span>
            <span class={deltaMetrics.lcp <= 0 ? 'text-success' : 'text-error'}>
              {deltaMetrics.lcp >= 0 ? '+' : ''}{deltaMetrics.lcp.toFixed(2)}s
            </span>
          </div>
          <div class="delta-item">
            <span>TBT delta:</span>
            <span class={deltaMetrics.tbt <= 0 ? 'text-success' : 'text-error'}>
              {deltaMetrics.tbt >= 0 ? '+' : ''}{deltaMetrics.tbt.toFixed(0)}ms
            </span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Performance Recommendations list (Sorted by impact) -->
    <div class="recommendations-container mt-4 font-sans">
      <h3 class="title-md">Performance Optimization Opportunities</h3>
      
      {#if auditResults.pageSpeedMobile?.recommendations && auditResults.pageSpeedMobile.recommendations.length > 0}
        <div class="rec-list mt-2">
          {#each auditResults.pageSpeedMobile.recommendations as rec}
            <div class="rec-card card-dark collapsible-rec">
              <button class="rec-header-btn" onclick={() => toggleRec(rec.title)}>
                <div class="rec-header-left">
                  <span class="badge badge-warning">SAVINGS</span>
                  <h4 class="title-sm inline-rec-title">{rec.title}</h4>
                </div>
                <div class="rec-header-right">
                  {#if rec.displayValue}
                    <span class="text-error font-mono">{rec.displayValue}</span>
                  {/if}
                  <span class="expand-arrow ml-2">{expandedRecs[rec.title] ? '▲' : '▼'}</span>
                </div>
              </button>

              {#if expandedRecs[rec.title]}
                <div class="rec-body mt-2">
                  <p class="rec-desc text-muted">{rec.description}</p>
                  <p class="rec-learn-more mt-2"><a href="https://web.dev/fast/" target="_blank" rel="noreferrer">Learn how to audit this recommendation on Web.dev →</a></p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <p class="empty-state text-success mt-2">All performance optimization criteria have passed. Perfect!</p>
      {/if}
    </div>

    <!-- Collapsible Passed Audits section -->
    {#if auditResults.pageSpeedMobile?.passedAudits && auditResults.pageSpeedMobile.passedAudits.length > 0}
      <div class="passed-audits-section mt-4 font-sans">
        <button class="passed-header-btn font-mono" onclick={() => showPassedAudits = !showPassedAudits}>
          <span>✓ PASSED AUDITS ({auditResults.pageSpeedMobile.passedAudits.length})</span>
          <span>{showPassedAudits ? 'Hide' : 'Show'}</span>
        </button>

        {#if showPassedAudits}
          <div class="passed-grid mt-2 font-mono">
            {#each auditResults.pageSpeedMobile.passedAudits as audit}
              <div class="passed-item text-success">✓ {audit}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

  {/if}

</div>

<style>
  .pagespeed-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .trigger-audit-card {
    padding: var(--spacing-xxl) !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .max-w-sm { max-width: 480px; }
  .max-w-sm p { line-height: 1.6; }

  /* Loader spinner */
  .loader-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-hairline);
    border-top: 4px solid var(--color-primary);
    border-radius: var(--rounded-full);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .mt-4 { margin-top: var(--spacing-lg); }
  .mt-2 { margin-top: var(--spacing-xs); }
  .ml-2 { margin-left: var(--spacing-xs); }

  /* Gauges */
  .gauge-score-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .gauge-wrapper {
    position: relative;
    width: 100px;
    height: 100px;
  }

  .progress-gauge {
    transform: rotate(-90deg);
  }

  .gauge-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-family-mono);
  }

  .score-meta {
    display: flex;
    flex-direction: column;
  }

  .score-grade {
    font-size: 14px;
    font-weight: 700;
  }

  /* Range Bars */
  .vital-range-row {
    background-color: var(--color-surface-soft);
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
    transition: border-color 0.15s ease;
  }

  .vital-range-row:hover {
    border-color: var(--color-primary-active);
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
    margin-bottom: 6px;
    color: var(--color-body-strong);
  }

  .vital-title {
    font-weight: 600;
  }

  .range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    margin-top: 4px;
  }

  .text-center { text-align: center; flex: 1; }
  .text-right { text-align: right; }

  /* Explainer panel drawer */
  .explainer-panel-box {
    padding: var(--spacing-sm);
    border-left: 3px solid var(--color-primary);
    background-color: rgba(250, 255, 105, 0.02);
  }

  /* Delta comparison strip */
  .delta-comparison-strip {
    padding: var(--spacing-sm) !important;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    font-size: 13px;
    border: 1px dashed var(--color-hairline-strong) !important;
  }

  .strip-title {
    font-weight: 600;
    color: var(--color-muted);
  }

  .delta-grid {
    display: flex;
    gap: var(--spacing-md);
  }

  .delta-item {
    display: inline-flex;
    gap: 4px;
  }

  .font-semibold { font-weight: 600; }

  /* Recommendations */
  .rec-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .collapsible-rec {
    padding: 0 !important;
    overflow: hidden;
  }

  .rec-header-btn {
    width: 100%;
    background: none;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    cursor: pointer;
    text-align: left;
    outline: none;
  }

  .rec-header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .inline-rec-title {
    margin: 0;
    color: var(--color-on-dark);
  }

  .rec-header-right {
    display: flex;
    align-items: center;
  }

  .rec-body {
    padding: 0 var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
    border-top: 1px solid var(--color-hairline);
    padding-top: var(--spacing-sm);
  }

  .rec-desc {
    font-size: 13px;
    line-height: 1.5;
  }

  .rec-learn-more a {
    font-size: 12px;
    font-weight: 600;
  }

  /* Passed Audits Collapsible button */
  .passed-audits-section {
    border-top: 1px solid var(--color-hairline);
    padding-top: var(--spacing-md);
  }

  .passed-header-btn {
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    color: var(--color-success);
    font-weight: 600;
    font-size: 13px;
    outline: none;
  }

  .passed-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xs);
    background-color: rgba(34, 197, 94, 0.02);
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    border: 1px solid rgba(34, 197, 94, 0.1);
  }

  .passed-item {
    font-size: 12px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .passed-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
