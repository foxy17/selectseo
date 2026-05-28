<script lang="ts">
  import type { PageSpeedMetric } from '$lib/seoEngine';
  import { lighthouseBand, lighthouseHex } from '$lib/scoreUtils';
  import VitalRangeBar from '$lib/components/VitalRangeBar.svelte';

  let {
    data,
    label,
    error,
    description,
    onExplain
  }: {
    /** The strategy's PageSpeed result (null when not yet loaded). */
    data: PageSpeedMetric | null;
    /** Strategy label ("Desktop" / "Mobile"). */
    label: string;
    /** Error message for this strategy's audit, if any. */
    error: string;
    /** Caption under the gauge (strategy-specific). */
    description: string;
    /** Opens the parent explainer drawer for a given vital metric key. */
    onExplain: (metric: string) => void;
  } = $props();

  // Gauge geometry: circumference of r=42 circle.
  const CIRCUMFERENCE = 263.89;

  // Parse string values (like "1.8 s" or "250 ms") into numbers for range bars
  function parseMetric(valStr: string): number {
    if (!valStr || valStr === 'N/A') return 0;
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  // Vitals threshold classifiers
  function getLcpStatus(valStr: string) {
    const val = parseMetric(valStr);
    if (val === 0) return { pct: 0, color: 'var(--color-muted)' };
    if (val <= 2.5) return { pct: (val / 2.5) * 33, color: 'var(--color-success)' };
    if (val <= 4.0) return { pct: 33 + ((val - 2.5) / 1.5) * 33, color: 'var(--color-warning)' };
    return { pct: 66 + Math.min(34, ((val - 4.0) / 4.0) * 34), color: 'var(--color-error)' };
  }

  function getTbtStatus(valStr: string) {
    const val = parseMetric(valStr);
    if (val === 0) return { pct: 0, color: 'var(--color-muted)' };
    if (val <= 200) return { pct: (val / 200) * 33, color: 'var(--color-success)' };
    if (val <= 600) return { pct: 33 + ((val - 200) / 400) * 33, color: 'var(--color-warning)' };
    return { pct: 66 + Math.min(34, ((val - 600) / 1000) * 34), color: 'var(--color-error)' };
  }

  function getClsStatus(valStr: string) {
    const val = parseFloat(valStr);
    if (isNaN(val)) return { pct: 0, color: 'var(--color-muted)' };
    if (val <= 0.1) return { pct: (val / 0.1) * 33, color: 'var(--color-success)' };
    if (val <= 0.25) return { pct: 33 + ((val - 0.1) / 0.15) * 33, color: 'var(--color-warning)' };
    return { pct: 66 + Math.min(34, ((val - 0.25) / 0.25) * 34), color: 'var(--color-error)' };
  }

  // The three Core Web Vital rows, driven from one array.
  const vitals = $derived.by(() => {
    if (!data) return [];
    return [
      {
        key: 'lcp',
        title: 'Largest Contentful Paint (LCP)',
        value: data.lcp,
        status: getLcpStatus(data.lcp),
        rangeLabels: ['0s (Good)', '2.5s', '4.0s (Poor)'] as [string, string, string]
      },
      {
        key: 'tbt',
        title: 'Total Blocking Time (TBT)',
        value: data.tbt,
        status: getTbtStatus(data.tbt),
        rangeLabels: ['0ms (Good)', '200ms', '600ms (Poor)'] as [string, string, string]
      },
      {
        key: 'cls',
        title: 'Cumulative Layout Shift (CLS)',
        value: data.cls,
        status: getClsStatus(data.cls),
        rangeLabels: ['0 (Good)', '0.10', '0.25 (Poor)'] as [string, string, string]
      }
    ];
  });
</script>

<div class="strategy-card card-dark">
  <div class="card-header-row">
    <h3 class="title-md">{label} Vitals</h3>
    {#if error}
      <span class="badge badge-error">API Error</span>
    {:else if data}
      <span class="badge badge-success">Google Verified</span>
    {/if}
  </div>

  {#if error}
    <p class="error-msg font-mono">{error}</p>
  {:else if data}
    {@const score = data.score}
    <div class="gauge-score-row mt-2">
      <div class="gauge-wrapper">
        <svg class="progress-gauge" width="100" height="100" viewBox="0 0 100 100">
          <circle class="gauge-bg" cx="50" cy="50" r="42" stroke="#222" stroke-width="8" fill="none" />
          <circle class="gauge-fill" cx="50" cy="50" r="42" stroke={lighthouseHex(score)} stroke-width="8" stroke-dasharray={CIRCUMFERENCE} stroke-dashoffset={CIRCUMFERENCE - (CIRCUMFERENCE * score) / 100} fill="none" stroke-linecap="round" />
        </svg>
        <span class="gauge-text" style="color: {lighthouseHex(score)}">{score}</span>
      </div>
      <div class="score-meta">
        <span class="score-grade font-mono" class:text-success={lighthouseBand(score) === 'success'} class:text-warning={lighthouseBand(score) === 'warning'} class:text-error={lighthouseBand(score) === 'error'}>
          {#if score >= 90}GOOD{:else if score >= 50}NEEDS IMPROVEMENT{:else}POOR{/if}
        </span>
        <p class="text-muted font-sans mt-1">{description}</p>
      </div>
    </div>

    <!-- Threshold range bars for vitals -->
    <div class="vitals-range-list mt-4 font-sans">
      {#each vitals as vital, i}
        <div class:mt-4={i > 0}>
          <VitalRangeBar
            title={vital.title}
            value={vital.value}
            pct={vital.status.pct}
            color={vital.status.color}
            rangeLabels={vital.rangeLabels}
            onActivate={() => onExplain(vital.key)}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Card header row: title + status badge, spaced apart on one line. */
  .card-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Error text (matches the error coloring used elsewhere in the app). */
  .error-msg {
    color: var(--color-error);
    font-size: 13px;
    margin-top: var(--spacing-sm);
    line-height: 1.5;
    word-break: break-word;
  }

  .mt-4 {
    margin-top: var(--spacing-lg);
  }
  .mt-2 {
    margin-top: var(--spacing-xs);
  }

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
</style>
