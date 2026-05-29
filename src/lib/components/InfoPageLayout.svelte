<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		children: Snippet;
	}

	let { title, subtitle, children }: Props = $props();

	// The info pages highlight the first word of the page title in the accent
	// color (e.g. "What This Does" -> "What" is highlighted). Split it out so the
	// string `title` prop preserves the existing visual treatment.
	const firstSpace = $derived(title.indexOf(' '));
	const highlightWord = $derived(firstSpace === -1 ? title : title.slice(0, firstSpace));
	const restTitle = $derived(firstSpace === -1 ? '' : title.slice(firstSpace));
</script>

<div class="info-page container">
	<section class="info-section">
		<h1 class="section-title"><span class="highlight-text">{highlightWord}</span>{restTitle}</h1>
		{#if subtitle}
			<p class="section-subtitle">{subtitle}</p>
		{/if}
		{@render children()}
	</section>
</div>

<style>
	.info-page {
		padding: 64px var(--spacing-lg);
	}

	/* Section title/subtitle and highlight rules are shared with body content
     rendered via the `children` snippet (parent style scope), so they must be
     :global to keep that content styled identically. */
	:global(.info-page .info-section) {
		padding: var(--spacing-xl) 0;
	}

	:global(.info-page .section-title) {
		font-size: 32px;
		font-weight: 700;
		margin-bottom: var(--spacing-xs);
		letter-spacing: -0.5px;
	}

	:global(.info-page .section-subtitle) {
		color: var(--color-muted);
		font-size: 16px;
		margin-bottom: var(--spacing-xl);
		max-width: 720px;
		line-height: 1.6;
	}

	:global(.info-page .highlight-text) {
		color: var(--color-primary);
	}
</style>
