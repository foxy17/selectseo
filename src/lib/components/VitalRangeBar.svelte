<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let {
    title,
    value,
    pct,
    color,
    rangeLabels,
    onActivate
  }: {
    /** Vital name shown on the left (e.g. "Largest Contentful Paint (LCP)"). */
    title: string;
    /** Displayed metric value (e.g. "1.8 s"). */
    value: string;
    /** Fill percentage (0–100) for the progress bar. */
    pct: number;
    /** Fill + value text color (a CSS color, typically a design token var). */
    color: string;
    /** Three threshold captions: [good, mid, poor]. */
    rangeLabels: [string, string, string];
    /** Fires on click / Enter (drives the parent explainer drawer). */
    onActivate: () => void;
  } = $props();
</script>

<div
  class="vital-range-row clickable"
  onclick={onActivate}
  role="button"
  tabindex="0"
  onkeydown={(e) => e.key === 'Enter' && onActivate()}
>
  <div class="label-row">
    <span class="vital-title">{title}</span>
    <span class="vital-value" style="color: {color}">{value}</span>
  </div>
  <ProgressBar value={pct} {color} track="var(--color-hairline)" />
  <div class="range-labels font-mono text-muted">
    <span>{rangeLabels[0]}</span>
    <span class="text-center">{rangeLabels[1]}</span>
    <span class="text-right">{rangeLabels[2]}</span>
  </div>
</div>

<style>
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

  .text-center {
    text-align: center;
    flex: 1;
  }

  .text-right {
    text-align: right;
  }
</style>
