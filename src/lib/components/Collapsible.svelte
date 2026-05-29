<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';

	let {
		title,
		header,
		badge,
		children,
		open = false,
		cardClass = '',
		headerClass = '',
		bodyClass = '',
		arrowSpaced = false
	}: {
		/** Plain-text header label. Ignored when a `header` snippet is supplied. */
		title?: string;
		/** Custom left-side header content (overrides `title`). */
		header?: Snippet;
		/** Optional right-side content rendered before the arrow (e.g. a badge). */
		badge?: Snippet;
		/** The collapsible body content. */
		children: Snippet;
		/** Initial open state. */
		open?: boolean;
		/** Class for the outer wrapper element. */
		cardClass?: string;
		/** Class for the full-width header button. */
		headerClass?: string;
		/** Class for the body container (only present when open). */
		bodyClass?: string;
		/** Adds left margin to the arrow (matches the old `ml-2` spacing). */
		arrowSpaced?: boolean;
	} = $props();

	// `open` is only an initial value; the component owns its own state thereafter.
	let isOpen = $state(untrack(() => open));

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class={cardClass}>
	<button class={headerClass} onclick={toggle} aria-expanded={isOpen}>
		{#if header}
			{@render header()}
		{:else}
			<span>{title}</span>
		{/if}
		{#if badge}
			{@render badge()}
		{/if}
		<span class="expand-arrow" class:arrow-spaced={arrowSpaced}>{isOpen ? '▲' : '▼'}</span>
	</button>

	{#if isOpen}
		<div class={bodyClass}>
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.expand-arrow {
		color: var(--color-muted);
		font-size: 12px;
		transition: transform 0.2s ease;
	}

	.arrow-spaced {
		margin-left: var(--spacing-xs);
	}
</style>
