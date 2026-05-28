<script lang="ts">
	import { onMount } from 'svelte';
	import SEO from '$lib/components/SEO.svelte';
	import ConsoleHud from '$lib/components/ConsoleHud.svelte';
	import AuditSettings from '$lib/components/AuditSettings.svelte';
	import { settings } from '$lib/settings.svelte';
	import { loadHistory, deleteHistoryItem as removeHistoryItem } from '$lib/crawlHistory';
	import type { CrawlHistoryItem } from '$lib/crawlHistory';
	import { appState } from '$lib/sharedState.svelte';
	import { goto } from '$app/navigation';

	const homeSchema = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'SelectSEO Auditor',
			url: 'https://selectseo.in/'
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'SelectSEO Auditor',
			url: 'https://selectseo.in/',
			description:
				'High-performance, developer-first SEO scanner and analysis panel running entirely in your browser.',
			applicationCategory: 'DeveloperApplication, SEOTool',
			operatingSystem: 'All',
			browserRequirements: 'Requires WebGL for visual effects, CORS proxy for scanning.',
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'USD'
			},
			creator: {
				'@type': 'Organization',
				name: 'SelectSEO',
				url: 'https://selectseo.in/'
			}
		}
	];

	// State using Svelte 5 Runes
	let targetUrl = $state('https://carnav.in');

	let scanLogs = $state<string[]>([]);

	// Reset layout shared state on landing page
	$effect(() => {
		appState.hasResults = false;
	});

	// Crawl History state & logic
	let crawlHistory = $state<CrawlHistoryItem[]>([]);

	function deleteHistoryItem(url: string, event: Event) {
		event.stopPropagation();
		crawlHistory = removeHistoryItem(url);
	}

	function log(message: string) {
		const timestamp = new Date().toLocaleTimeString();
		scanLogs = [...scanLogs, `[${timestamp}] ${message}`];
	}

	const initMessages = [
		'SYSTEM: Booting SelectSEO Neural Auditor...',
		'DATABASE: SQLite virtual schema mounted successfully.',
		'NETWORK: Proxy workers validation... ACTIVE (23ms)',
		'CONSOLE: Ready. Initializing user scanner interface...'
	];

	// Persistence using localstorage on mount
	onMount(() => {
		crawlHistory = loadHistory();
		settings.load();

		// Check if new-crawl event triggered to reset input fields
		const handleNewCrawl = () => {
			targetUrl = '';
		};
		window.addEventListener('new-crawl', handleNewCrawl);

		// Start typewriter effect for terminal.
		// `typingActive` is an onMount-local cancellation token: the typeChar loop
		// and the cleanup below both close over it, so the typewriter stops on unmount.
		let typingActive = true;
		let msgIdx = 0;
		let charIdx = 0;
		let currentLine = '';
		const timestamp = new Date().toLocaleTimeString();

		function typeChar() {
			if (!typingActive) return;
			if (msgIdx >= initMessages.length) return;

			const targetText = initMessages[msgIdx];
			if (charIdx < targetText.length) {
				currentLine += targetText[charIdx];
				const formattedLine = `[${timestamp}] ${currentLine}`;
				if (scanLogs.length <= msgIdx) {
					scanLogs = [...scanLogs, formattedLine];
				} else {
					scanLogs[msgIdx] = formattedLine;
					scanLogs = [...scanLogs];
				}
				charIdx++;
				setTimeout(typeChar, 10 + Math.random() * 15);
			} else {
				msgIdx++;
				if (msgIdx < initMessages.length) {
					charIdx = 0;
					currentLine = '';
					setTimeout(typeChar, 150);
				}
			}
		}

		setTimeout(typeChar, 200);

		return () => {
			typingActive = false;
			window.removeEventListener('new-crawl', handleNewCrawl);
		};
	});

	// Handle Scan Navigation Route
	function handleScan() {
		if (!targetUrl) return;

		let urlToScan = targetUrl.trim();
		if (!/^https?:\/\//i.test(urlToScan)) {
			urlToScan = 'https://' + urlToScan;
		}

		goto(`/crawl-detail/${urlToScan}`);
	}
</script>

<SEO path="" schema={homeSchema} />

<div class="dashboard-page">
	<!-- Hero / URL Input section -->
	<section class="hero-section">
		<div class="container hero-container">
			<div class="hero-left">
				<h1 class="display-md">High-Performance <span class="highlight-text">SEO Engine</span></h1>
				<p class="hero-sub">
					Analyze metadata, crawl link maps, run Core Web Vitals audits, and write client-side SQL
					queries to inspect results.
				</p>

				<!-- Search panel -->
				<div class="search-panel">
					<div class="search-box">
						<input
							type="text"
							class="search-input"
							placeholder="Enter website URL (e.g. svelte.dev)"
							bind:value={targetUrl}
							onkeydown={(e) => e.key === 'Enter' && handleScan()}
						/>
						<button class="btn btn-primary search-btn font-mono" onclick={handleScan}>
							Scan Target
						</button>
					</div>

					<!-- Quick settings disclosure -->
					<AuditSettings
						title="Audit Configurations"
						saveLabel="Save Settings"
						onsave={() => log('Settings updated and stored locally.')}
					/>
				</div>
			</div>

			<!-- Live logs console block -->
			<div class="hero-right">
				<ConsoleHud
					logs={scanLogs}
					title="AUDIT_LOG_STREAM // selectseo_auditor"
					emptyText="ready for input..."
				/>
			</div>
		</div>
	</section>

	<!-- Recent Audits History Section -->
	<section class="history-section animate-fade-in">
		<div class="container">
			<div class="history-header">
				<h2 class="title-md font-mono text-primary">// RECENT_AUDIT_HISTORY</h2>
				<p class="history-subtitle text-muted">
					Restore previously crawled domains instantly from your browser's local cache.
				</p>
			</div>

			{#if crawlHistory.length === 0}
				<!-- Empty State -->
				<div class="history-empty card-dark text-center font-mono">
					<div class="empty-icon text-primary">⚡</div>
					<h3 class="title-sm mt-2 text-ink">NO RECENT SCANS DETECTED</h3>
					<p class="text-muted text-xs mt-1">
						Ready for input. Enter a website URL above and click "Scan Target" to compile your first
						audit report.
					</p>
				</div>
			{:else}
				<!-- History Grid List -->
				<div class="history-grid">
					{#each crawlHistory as item (item.url)}
						<div class="history-item-card card-dark">
							<a class="history-item-link" href="/crawl-detail/{item.url}">
								<div class="card-left">
									<div
										class="score-badge"
										class:score-green={item.score >= 90}
										class:score-orange={item.score >= 70 && item.score < 90}
										class:score-red={item.score < 70}
									>
										<span class="score-num">{item.score}</span>
										<span class="score-grade">{item.grade}</span>
									</div>
									<div class="item-meta">
										<h3 class="item-url font-mono">{item.url}</h3>
										<span class="item-time text-muted"
											>Audited: {new Date(item.timestamp).toLocaleString()}</span
										>
									</div>
								</div>
								<div class="stats-pills">
									<span class="pill pill-error">{item.errorCount} Errors</span>
									<span class="pill pill-warning">{item.warningCount} Warnings</span>
								</div>
							</a>
							<button
								class="delete-history-btn"
								onclick={(e) => deleteHistoryItem(item.url, e)}
								title="Remove from history">×</button
							>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	.dashboard-page {
		padding-bottom: 80px;
	}

	.history-section {
		padding: 64px 0;
	}

	.history-header {
		margin-bottom: var(--spacing-xl);
	}

	.history-subtitle {
		margin-top: var(--spacing-xs);
		font-size: 14px;
	}

	.history-empty {
		padding: var(--spacing-xxl) var(--spacing-lg);
	}

	.empty-icon {
		font-size: 32px;
	}

	.history-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.history-item-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-md) var(--spacing-lg);
		border-radius: var(--rounded-lg);
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.history-item-card:hover {
		border-color: rgba(250, 255, 105, 0.35) !important;
		background-color: rgba(250, 255, 105, 0.02) !important;
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}

	/* The whole card (minus the delete button) is one navigation anchor. */
	.history-item-link {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-md);
		text-decoration: none;
		color: inherit;
		cursor: pointer;
	}

	.history-item-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 4px;
		border-radius: var(--rounded-md);
	}

	.card-left {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.score-badge {
		width: 50px;
		height: 50px;
		border-radius: var(--rounded-md);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		line-height: 1.1;
		border: 1px solid transparent;
		flex-shrink: 0;
	}

	.score-green {
		background-color: rgba(34, 197, 94, 0.1);
		border-color: rgba(34, 197, 94, 0.25);
		color: var(--color-success);
	}

	.score-orange {
		background-color: rgba(245, 158, 11, 0.1);
		border-color: rgba(245, 158, 11, 0.25);
		color: var(--color-warning);
	}

	.score-red {
		background-color: rgba(239, 68, 68, 0.1);
		border-color: rgba(239, 68, 68, 0.25);
		color: var(--color-error);
	}

	.score-num {
		font-size: 16px;
	}

	.score-grade {
		font-size: 9px;
		text-transform: uppercase;
		opacity: 0.8;
	}

	.item-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item-url {
		font-size: 15px;
		font-weight: 600;
		color: var(--color-on-dark);
		word-break: break-all;
		margin: 0;
	}

	.item-time {
		font-size: 12px;
		color: var(--color-muted);
	}

	.stats-pills {
		display: flex;
		gap: var(--spacing-xs);
	}

	.pill {
		font-size: 11px;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: var(--rounded-pill);
		font-family: var(--font-family-mono);
	}

	.pill-error {
		background-color: rgba(239, 68, 68, 0.08);
		color: var(--color-error);
		border: 1px solid rgba(239, 68, 68, 0.2);
	}

	.pill-warning {
		background-color: rgba(245, 158, 11, 0.08);
		color: var(--color-warning);
		border: 1px solid rgba(245, 158, 11, 0.2);
	}

	.delete-history-btn {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 22px;
		cursor: pointer;
		line-height: 1;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rounded-full);
		transition: all 0.15s ease;
	}

	.delete-history-btn:hover {
		color: var(--color-error);
		background-color: rgba(239, 68, 68, 0.1);
	}

	.hero-section {
		padding: 64px 0;
		border-bottom: 1px solid var(--color-hairline);
	}

	.hero-container {
		display: grid;
		grid-template-columns: 7fr 5fr;
		gap: var(--spacing-xxl);
		align-items: center;
	}

	.hero-left {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.highlight-text {
		color: var(--color-primary);
	}

	.hero-sub {
		font-size: 16px;
		color: var(--color-body);
		line-height: 1.6;
		max-width: 580px;
	}

	.search-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		margin-top: var(--spacing-md);
	}

	.search-box {
		display: flex;
		gap: var(--spacing-sm);
	}

	.search-input {
		flex: 1;
		background-color: var(--color-surface-card);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-md);
		padding: 12px 16px;
		font-size: 15px;
		color: var(--color-on-dark);
		outline: none;
		transition: border-color 0.15s ease;
	}

	.search-input:focus {
		border-color: var(--color-primary);
	}

	.search-btn {
		height: 48px;
		padding: 0 var(--spacing-lg);
	}

	@media (max-width: 1024px) {
		.hero-container {
			grid-template-columns: 1fr;
			gap: var(--spacing-xl);
		}
	}
</style>
