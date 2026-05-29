<script lang="ts">
	import { onMount } from 'svelte';
	import { AEO_PENALTIES, type AIDiscoverabilityAudit } from '$lib/seoEngine';
	import { aioPlan, getLanguageModel, type AioPlanContext } from '$lib/aioPlanState.svelte';
	import AioPlanModal from '$lib/components/AioPlanModal.svelte';

	let { audit, url }: { audit: AIDiscoverabilityAudit; url: string } = $props();

	type CheckKey = keyof typeof AEO_PENALTIES;

	// Checks render as a single hairline-separated list, ordered by point impact.
	const CHECKS: { key: CheckKey; label: string }[] = [
		{ key: 'targetSchema', label: 'High-Value AI Schema Depth' },
		{ key: 'qaFormatting', label: 'Fact-First Q&A Formatting' },
		{ key: 'directAnswer', label: 'Direct-Answer / TL;DR Summary' },
		{ key: 'authorDate', label: 'Author & Freshness (E-E-A-T)' },
		{ key: 'scannability', label: 'Content Scannability (Lists & Tables)' },
		{ key: 'semanticHtml', label: 'Semantic HTML Structure' },
		{ key: 'robotsTxtAi', label: 'AI Crawler Permissions (robots.txt)' },
		{ key: 'llmsTxt', label: 'llms.txt — AI Content Map' }
	];

	// Failing checks, highest point-impact first — drives the Priority Fixes list.
	const failing = $derived(
		CHECKS.filter((c) => audit[c.key].status !== 'ok').sort(
			(a, b) => AEO_PENALTIES[b.key] - AEO_PENALTIES[a.key]
		)
	);

	let showAllFixes = $state(false);
	let modalOpen = $state(false);

	// On-device AI availability — gates the action-plan UI and the enable hint.
	let aiStatus = $state<'unknown' | 'available' | 'unavailable'>('unknown');

	onMount(async () => {
		const lm = getLanguageModel();
		if (!lm) {
			aiStatus = 'unavailable';
			return;
		}
		try {
			const availability = await lm.availability();
			aiStatus = availability === 'available' ? 'available' : 'unavailable';
		} catch (e) {
			console.error('AIO Score: failed to query on-device AI availability', e);
			aiStatus = 'unavailable';
		}
	});

	// Context handed to the shared plan engine so it can (re)generate on demand.
	const planContext = $derived<AioPlanContext>({
		url,
		score: audit.score,
		grade: audit.grade,
		issues:
			failing
				.map(
					(c, i) =>
						`${i + 1}. ${c.label} (worth ${AEO_PENALTIES[c.key]} points) — ${audit[c.key].message} Suggested fix: ${audit[c.key].recommendation ?? ''}`
				)
				.join('\n') ||
			'None — every AEO check passes. Suggest advanced GEO tactics to defend and extend this score.'
	});

	// The shared plan is only relevant if it belongs to the URL on screen.
	const planActive = $derived(aioPlan.forUrl === url);
	const planGenerating = $derived(planActive && aioPlan.status === 'generating');
	const planReady = $derived(
		planActive && aioPlan.status === 'ready' && aioPlan.messages.length > 0
	);
	const planErrored = $derived(planActive && aioPlan.status === 'error');

	function startPlan() {
		aioPlan.start(planContext);
		modalOpen = true;
	}
</script>

<div class="ai-discoverability-tab">
	<div class="score-card card-dark">
		<div class="row-between">
			<div class="score-head">
				<h3 class="title-md">AIO Score</h3>
				<span class="score-sub font-mono">AI Optimization · AEO / GEO readiness</span>
			</div>
			<div
				class="score-badge font-mono"
				class:grade-a={audit.score >= 90}
				class:grade-b={audit.score >= 80 && audit.score < 90}
				class:grade-c={audit.score >= 70 && audit.score < 80}
				class:grade-f={audit.score < 70}
			>
				{audit.score}/100 ({audit.grade})
			</div>
		</div>
		<p class="section-desc mt-1">
			How well your content is structured for AI engines like ChatGPT, Gemini, and Perplexity to
			read, extract, and cite.
		</p>
	</div>

	<!-- AI Action Plan strip — survives tab switches; opens the chat modal. -->
	{#if aiStatus === 'available'}
		{#if planGenerating}
			<div class="plan-strip card-dark gen">
				<button class="strip-main" onclick={() => (modalOpen = true)}>
					<span class="spark pulse">✨</span>
					<span class="strip-text">
						<span class="strip-title">Generating action plan…</span>
						<span class="strip-sub">Click to watch it stream</span>
					</span>
					<span class="strip-open font-mono">WATCH →</span>
				</button>
				<button class="strip-stop font-mono" onclick={() => aioPlan.stop()}>STOP</button>
			</div>
		{:else if planReady}
			<div class="plan-strip card-dark ready">
				<button class="strip-main" onclick={() => (modalOpen = true)}>
					<span class="spark">✨</span>
					<span class="strip-text">
						<span class="strip-title">AI action plan ready</span>
						<span class="strip-sub">Open to read it and ask follow-ups</span>
					</span>
					<span class="strip-open font-mono">OPEN →</span>
				</button>
				<button class="strip-regen font-mono" onclick={startPlan} title="Clear and regenerate">
					↻ REGEN
				</button>
			</div>
		{:else if planErrored}
			<div class="plan-strip card-dark err">
				<div class="strip-main static">
					<span class="spark err">⚠</span>
					<span class="strip-text">
						<span class="strip-title">Plan generation failed</span>
						<span class="strip-sub">{aioPlan.error}</span>
					</span>
				</div>
				<button class="strip-cta font-mono" onclick={startPlan}>RETRY</button>
			</div>
		{:else}
			<div class="plan-strip card-dark">
				<div class="strip-main static">
					<span class="spark">✨</span>
					<span class="strip-text">
						<span class="strip-title">Get a custom AI action plan</span>
						<span class="strip-sub">On-device · private · keeps running across tabs</span>
					</span>
				</div>
				<button class="strip-cta font-mono" onclick={startPlan}>GENERATE</button>
			</div>
		{/if}
	{:else if aiStatus === 'unavailable'}
		<p class="ai-hint card-dark">
			✨ Want a tailored, prioritized action plan you can chat with? Enable Chrome's on-device AI
			from the <strong>AI Chat</strong> tab — it runs locally and privately, then come back here.
		</p>
	{/if}

	{#if failing.length > 0}
		<div class="priority-card card-dark">
			<div class="row-between">
				<h4 class="title-sm">⚡ Priority Fixes</h4>
				<span class="priority-count font-mono">{failing.length} to improve</span>
			</div>
			<ol class="priority-list">
				{#each showAllFixes ? failing : failing.slice(0, 1) as c (c.key)}
					<li class="priority-item">
						<div class="priority-item-head">
							<span class="priority-label">{c.label}</span>
							<span class="priority-impact font-mono">+{AEO_PENALTIES[c.key]} pts</span>
						</div>
						<p class="priority-rec">{audit[c.key].recommendation ?? audit[c.key].message}</p>
					</li>
				{/each}
			</ol>
			{#if failing.length > 1}
				<button class="show-more font-mono" onclick={() => (showAllFixes = !showAllFixes)}>
					{showAllFixes ? '− Show less' : `+ Show ${failing.length - 1} more`}
				</button>
			{/if}
		</div>
	{:else}
		<div class="all-pass card-dark">
			<span class="all-pass-icon">✓</span>
			<div>
				<h4 class="title-sm">All AEO checks passing</h4>
				<p class="audit-msg mt-1">
					Your page is well-structured for AI engines to read and cite. Keep content fresh, expand
					coverage, and re-audit as AEO best-practices evolve.
				</p>
			</div>
		</div>
	{/if}

	<div class="checks-card card-dark">
		<h4 class="title-sm checks-title">All Checks</h4>
		<ul class="checks">
			{#each CHECKS as c (c.key)}
				<li class="check-row">
					<div class="check-head">
						<span class="check-label">{c.label}</span>
						<span
							class="status-badge"
							class:status-ok={audit[c.key].status === 'ok'}
							class:status-warn={audit[c.key].status !== 'ok'}
						>
							{audit[c.key].status.toUpperCase()}
						</span>
					</div>
					<p class="check-msg">{audit[c.key].message}</p>
				</li>
			{/each}
		</ul>
	</div>
</div>

{#if modalOpen}
	<AioPlanModal ctx={planContext} onClose={() => (modalOpen = false)} />
{/if}

<style>
	.ai-discoverability-tab {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
	}

	.score-card {
		padding: var(--spacing-lg);
	}

	.score-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.score-sub {
		font-size: 11px;
		letter-spacing: 0.5px;
		color: var(--color-muted);
		text-transform: uppercase;
	}

	.score-badge {
		padding: 8px 16px;
		border-radius: var(--rounded-md);
		font-weight: 700;
		font-size: 18px;
		background-color: var(--color-surface-soft);
		white-space: nowrap;
	}

	.grade-a {
		color: var(--color-success);
		border: 1px solid var(--color-success);
	}
	.grade-b {
		color: var(--color-accent-blue);
		border: 1px solid var(--color-accent-blue);
	}
	.grade-c {
		color: var(--color-warning);
		border: 1px solid var(--color-warning);
	}
	.grade-f {
		color: var(--color-error);
		border: 1px solid var(--color-error);
	}

	/* AI Action Plan strip */
	.plan-strip {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
	}
	.plan-strip.ready {
		box-shadow:
			0 0 0 1px rgb(var(--color-primary-rgb) / 0.15),
			inset 0 0 24px rgb(var(--color-primary-rgb) / 0.06);
	}
	.plan-strip.err {
		border-color: rgb(var(--color-error-rgb) / 0.35);
	}

	.strip-main {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-xs) var(--spacing-xs);
		background: transparent;
		border: none;
		text-align: left;
		cursor: pointer;
		color: inherit;
		border-radius: var(--rounded-sm);
		transition: background-color 0.15s ease;
	}
	.strip-main:not(.static):hover {
		background-color: rgb(var(--color-primary-rgb) / 0.05);
	}
	.strip-main.static {
		cursor: default;
	}

	.spark {
		font-size: 18px;
		flex-shrink: 0;
	}
	.spark.err {
		color: var(--color-error);
	}
	.spark.pulse {
		animation: spark-pulse 1.4s infinite;
	}
	@keyframes spark-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}

	.strip-text {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
	}
	.strip-title {
		font-size: 14px;
		font-weight: 700;
		color: var(--color-ink);
	}
	.strip-sub {
		font-size: 12px;
		color: var(--color-muted);
	}
	.strip-open {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-primary);
		white-space: nowrap;
	}

	.strip-cta,
	.strip-regen,
	.strip-stop {
		align-self: center;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		padding: 8px 16px;
		border-radius: var(--rounded-sm);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
	}
	.strip-cta {
		color: var(--color-on-primary);
		background-color: var(--color-primary);
		border: none;
		box-shadow: 0 4px 12px rgb(var(--color-primary-rgb) / 0.15);
	}
	.strip-cta:hover {
		background-color: var(--color-primary-active);
		transform: translateY(-1px);
	}
	.strip-regen {
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.08);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
	}
	.strip-regen:hover {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
	}
	.strip-stop {
		color: var(--color-error);
		background-color: rgb(var(--color-error-rgb) / 0.1);
		border: 1px solid rgb(var(--color-error-rgb) / 0.3);
	}
	.strip-stop:hover {
		background-color: rgb(var(--color-error-rgb) / 0.2);
	}

	.ai-hint {
		padding: var(--spacing-md) var(--spacing-lg);
		font-size: 12.5px;
		line-height: 1.6;
		color: var(--color-muted);
	}
	.ai-hint strong {
		color: var(--color-primary);
	}

	/* Priority Fixes */
	.priority-card {
		padding: var(--spacing-lg);
		border: 1px solid var(--color-hairline);
	}

	.priority-count {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.priority-list {
		list-style: none;
		counter-reset: fix;
		margin: var(--spacing-md) 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.priority-item {
		counter-increment: fix;
		position: relative;
		padding: var(--spacing-sm) var(--spacing-md) var(--spacing-sm) 44px;
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
	}

	.priority-item::before {
		content: counter(fix);
		position: absolute;
		left: 12px;
		top: 12px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-family-mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.08);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-radius: var(--rounded-xs);
	}

	.priority-item-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.priority-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-ink);
	}

	.priority-impact {
		font-size: 11px;
		font-weight: 700;
		color: var(--color-primary);
		white-space: nowrap;
	}

	.priority-rec {
		font-size: 13px;
		color: var(--color-body);
		line-height: 1.55;
		margin-top: 4px;
	}

	.show-more {
		margin-top: var(--spacing-md);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		padding: 6px 14px;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.06);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.2);
		border-radius: var(--rounded-pill);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.show-more:hover {
		background-color: rgb(var(--color-primary-rgb) / 0.12);
		border-color: var(--color-primary);
	}

	/* All-pass state */
	.all-pass {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-lg);
		border: 1px solid rgb(var(--color-success-rgb, 34 197 94) / 0.3);
	}
	.all-pass-icon {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		color: var(--color-success);
		background-color: rgb(var(--color-success-rgb, 34 197 94) / 0.12);
		border: 1px solid rgb(var(--color-success-rgb, 34 197 94) / 0.3);
		border-radius: 50%;
	}

	/* All checks — single surface, hairline-separated rows */
	.checks-card {
		padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
	}
	.checks-title {
		padding: var(--spacing-sm) 0;
	}
	.checks {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.check-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--spacing-md) 0;
		border-top: 1px solid var(--color-hairline);
	}
	.check-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-sm);
	}
	.check-label {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-ink);
	}
	.check-msg {
		font-size: 13px;
		color: var(--color-muted);
		line-height: 1.5;
	}

	.status-badge {
		font-size: 10px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: var(--rounded-xs);
		font-family: var(--font-family-mono);
	}

	/* #10b981 (emerald-600) is intentionally distinct from --color-success (#22c55e). */
	.status-ok {
		background-color: rgba(16, 185, 129, 0.15);
		color: #10b981;
	}
	.status-warn {
		background-color: rgb(var(--color-warning-rgb) / 0.15);
		color: var(--color-warning);
	}

	.audit-msg {
		font-size: 14px;
		color: var(--color-muted);
		line-height: 1.5;
	}
</style>
