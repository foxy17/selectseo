<script lang="ts">
  import type { AuditResults } from '$lib/seoEngine';
  import StrategyCard from '$lib/components/StrategyCard.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';

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

  // Collapsible passed audits state
  let showPassedAudits = $state(false);

  function toggleExplainer(metric: string) {
    if (activeExplainer === metric) activeExplainer = null;
    else activeExplainer = metric;
  }

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
      <StrategyCard
        data={auditResults.pageSpeedDesktop}
        label="Desktop"
        error={pageSpeedDesktopError}
        description="Lighthouse Desktop simulation audit score."
        onExplain={toggleExplainer}
      />
      <StrategyCard
        data={auditResults.pageSpeedMobile}
        label="Mobile"
        error={pageSpeedMobileError}
        description="Lighthouse Mobile simulation (moto g4 throttle)."
        onExplain={toggleExplainer}
      />
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
            <Collapsible cardClass="rec-card card-dark collapsible-rec" headerClass="rec-header-btn" bodyClass="rec-body" arrowSpaced>
              {#snippet header()}
                <div class="rec-header-left">
                  <span class="badge badge-warning">SAVINGS</span>
                  <h4 class="title-sm inline-rec-title">{rec.title}</h4>
                </div>
              {/snippet}
              {#snippet badge()}
                <div class="rec-header-right">
                  {#if rec.displayValue}
                    <span class="text-error font-mono">{rec.displayValue}</span>
                  {/if}
                </div>
              {/snippet}
              <p class="rec-desc text-muted">{rec.description}</p>
              <p class="rec-learn-more mt-2"><a href="https://web.dev/fast/" target="_blank" rel="noreferrer">Learn how to audit this recommendation on Web.dev →</a></p>
            </Collapsible>
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

  /* .mt-4 / .mt-2 are provided globally in index.css (same token values). */

  .text-center { text-align: center; flex: 1; }

  /* Explainer panel drawer */
  .explainer-panel-box {
    padding: var(--spacing-sm);
    border-left: 3px solid var(--color-primary);
    background-color: rgb(var(--color-primary-rgb) / 0.02);
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

  /* Recommendations */
  .rec-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  /* The card wrapper, header button and body are rendered by the Collapsible child. */
  .rec-list :global(.collapsible-rec) {
    padding: 0 !important;
    overflow: hidden;
  }

  .rec-list :global(.rec-header-btn) {
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
    margin-right: auto;
  }

  .inline-rec-title {
    margin: 0;
    color: var(--color-on-dark);
  }

  .rec-header-right {
    display: flex;
    align-items: center;
  }

  .rec-list :global(.rec-body) {
    padding: 0 var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
    border-top: 1px solid var(--color-hairline);
    padding-top: var(--spacing-sm);
    margin-top: var(--spacing-xs);
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
    background-color: rgb(var(--color-success-rgb) / 0.02);
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    border: 1px solid rgb(var(--color-success-rgb) / 0.1);
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
