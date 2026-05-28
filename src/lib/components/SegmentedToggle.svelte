<script lang="ts">
  // A shared segmented-control / filter button group.
  // The button whose `option.value === value` is the active one.
  // `value` is $bindable so the parent's $state stays the source of truth.
  type Option = {
    label: string;
    value: string;
    // Optional count/superscript badge (used by the links filter variant).
    sup?: string | number;
    supClass?: string;
  };

  let {
    options,
    value = $bindable<string>(),
    ariaLabel,
    variant = 'compact'
  }: {
    options: Option[];
    value: string;
    ariaLabel?: string;
    variant?: 'compact' | 'filter';
  } = $props();
</script>

<div class="segmented" class:filter={variant === 'filter'} role="group" aria-label={ariaLabel}>
  {#each options as option (option.value)}
    <button
      type="button"
      class="seg-btn"
      class:active={option.value === value}
      aria-pressed={option.value === value}
      onclick={() => (value = option.value)}
    >
      {option.label}
      {#if option.sup !== undefined}
        <span class="sup {option.supClass ?? ''}">{option.sup}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    background-color: var(--color-surface-soft);
    padding: 2px;
    border-radius: var(--rounded-sm);
    border: 1px solid var(--color-hairline);
  }

  .seg-btn {
    background: none;
    border: none;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted);
    cursor: pointer;
    border-radius: var(--rounded-xs);
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .seg-btn.active {
    background-color: var(--color-surface-card);
    color: var(--color-primary);
  }

  /* Filter variant: roomier buttons, wrapping group, inline count badge. */
  .segmented.filter {
    border-radius: var(--rounded-md);
    flex-wrap: wrap;
  }

  .segmented.filter .seg-btn {
    padding: 6px 12px;
    font-size: 13px;
    border-radius: var(--rounded-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .segmented.filter .sup {
    font-size: 10px;
    font-weight: 700;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: var(--rounded-xs);
  }
</style>
