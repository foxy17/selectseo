<script lang="ts">
	import { onMount } from 'svelte';
	import SEO from '$lib/components/SEO.svelte';
	import InfoPageLayout from '$lib/components/InfoPageLayout.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import { copyToClipboard } from '$lib/exportUtils';
	import { getAiAvailability, downloadModel, type AiStatus } from '$lib/chromeAi';

	// Which copyable setup snippet was most recently copied, for transient "Copied" feedback.
	// chrome:// URLs can't be opened from a web page, so each setup link is copy-to-paste.
	let copiedKey = $state<string | null>(null);
	let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

	async function copySnippet(key: string, value: string) {
		const ok = await copyToClipboard(value);
		if (!ok) return;
		copiedKey = key;
		if (copyResetTimer) clearTimeout(copyResetTimer);
		copyResetTimer = setTimeout(() => {
			copiedKey = null;
		}, 1500);
	}

	// On-device model download state, driven directly from this guide so users
	// don't have to open DevTools to trigger the download.
	let aiStatus = $state<AiStatus>('unknown');
	let downloadProgress = $state<number | null>(null);

	async function triggerDownload() {
		try {
			aiStatus = 'downloading';
			downloadProgress = 0;
			await downloadModel((pct) => (downloadProgress = pct));
			downloadProgress = 100;
			aiStatus = await getAiAvailability();
		} catch (e) {
			console.error(e);
			aiStatus = await getAiAvailability();
		} finally {
			downloadProgress = null;
		}
	}

	onMount(async () => {
		aiStatus = await getAiAvailability();
	});

	const howToSchema = [
		{
			'@context': 'https://schema.org',
			'@type': 'WebPage',
			name: 'How To Use - SelectSEO Auditor',
			url: 'https://selectseo.in/how-to-use/',
			description: 'Step-by-step developer onboarding and usage guide for SelectSEO Auditor.',
			breadcrumb: {
				'@type': 'BreadcrumbList',
				itemListElement: [
					{
						'@type': 'ListItem',
						position: 1,
						name: 'Home',
						item: 'https://selectseo.in/'
					},
					{
						'@type': 'ListItem',
						position: 2,
						name: 'How To Use',
						item: 'https://selectseo.in/how-to-use/'
					}
				]
			}
		},
		{
			'@context': 'https://schema.org',
			'@type': 'HowTo',
			name: 'How to Use SelectSEO Auditor',
			description: 'Follow these quick steps to audit any site and query its dataset.',
			step: [
				{
					'@type': 'HowToStep',
					name: 'Configure the Proxy',
					text: 'Configure the CORS proxy worker URL (e.g. corsproxy.io) to allow the browser to crawl cross-origin target sites.'
				},
				{
					'@type': 'HowToStep',
					name: 'Scan a Target URL',
					text: 'Input a target domain (e.g., svelte.dev) and click Scan Target. Follow the live audit logs stream.'
				},
				{
					'@type': 'HowToStep',
					name: 'Analyze Audit Checklist',
					text: 'Review page layout structures, meta tags, and outbound hyperlink status codes.'
				},
				{
					'@type': 'HowToStep',
					name: 'Query via SQL Console',
					text: 'Scroll down to the SQL Console and write custom query statements to inspect results.'
				},
				{
					'@type': 'HowToStep',
					name: 'Use Chrome On-Device AI',
					text: "Enable Chrome's prompt API flags, download the local Gemma model, and use the built-in Copilot for offline content improvements."
				}
			]
		}
	];
</script>

{#snippet copyField(key: string, value: string)}
	<div class="copy-field">
		<code class="copy-code">{value}</code>
		<button
			class="copy-btn"
			class:copied={copiedKey === key}
			onclick={() => copySnippet(key, value)}
			title="Copy to clipboard"
		>
			{copiedKey === key ? '✓ Copied' : 'Copy'}
		</button>
	</div>
{/snippet}

<SEO
	title="How To Use - SelectSEO Auditor"
	description="Step-by-step developer onboarding and usage guide for SelectSEO Auditor."
	path="/how-to-use/"
	schema={howToSchema}
/>

<InfoPageLayout
	title="How To Use"
	subtitle="Follow these quick steps to audit any site and query its dataset."
>
	<div class="steps-container">
		<div class="step-item">
			<div class="step-number">01</div>
			<div class="step-content">
				<h4>Configure the Proxy</h4>
				<p>
					Make sure to configure the CORS proxy worker URL (e.g., using corsproxy.io or a custom
					Cloudflare worker) to allow the browser to crawl cross-origin target sites.
				</p>
			</div>
		</div>
		<div class="step-item">
			<div class="step-number">02</div>
			<div class="step-content">
				<h4>Scan a Target URL</h4>
				<p>
					Input a target domain (e.g., <code>svelte.dev</code>) and click
					<strong>Scan Target</strong>. Follow the live audit logs stream on the console panel.
				</p>
			</div>
		</div>
		<div class="step-item">
			<div class="step-number">03</div>
			<div class="step-content">
				<h4>Analyze Audit Checklist</h4>
				<p>
					Review page layout structures, meta tags, and outbound hyperlink status codes on the
					generated results dashboard.
				</p>
			</div>
		</div>
		<div class="step-item">
			<div class="step-number">04</div>
			<div class="step-content">
				<h4>Query via SQL Console</h4>
				<p>
					Scroll down to the SQL Console and write custom query statements. Example: <code
						>SELECT url, anchor_text FROM links WHERE status_code = 404</code
					>.
				</p>
			</div>
		</div>
		<div class="step-item">
			<div class="step-number">05</div>
			<div class="step-content">
				<h4>Consult the AI Copilot</h4>
				<p>
					Switch to the <strong>✨ AI Chat</strong> tab (the second tab) to generate CTR-optimized metadata
					pairs, map keyword strategies, and fix headings readability.
				</p>
			</div>
		</div>
	</div>

	<!-- Chrome Built-in AI Copilot Guide Section -->
	<section id="chrome-ai-guide" class="info-section mt-5 border-t pt-5">
		<h2 class="section-title"><span class="highlight-text">Chrome</span> Built-in AI Copilot</h2>
		<p class="section-subtitle">
			SelectSEO Auditor integrates Chrome's experimental Prompt API to run optimization suggestions
			locally on your PC using Google's <strong>Gemini Nano</strong> model.
		</p>

		<div class="ai-config-grid">
			<div class="ai-config-info card-dark">
				<h3 class="title-sm text-primary mb-2">// WHY_LOCAL_AI?</h3>
				<p class="text-xs leading-relaxed text-muted">
					Unlike traditional cloud AI assistants, SelectSEO does not transmit page crawl payloads to
					external servers or require subscription-based API keys. All title improvements, keyword
					extractions, and readability edits are processed locally on your hardware.
				</p>
				<div class="space-warning-box mt-3 text-xs p-2 rounded">
					<span class="text-warning">⚠️ Storage Alert:</span> Downloading Chrome's native
					optimization component requires downloading a ~4GB <code>weights.bin</code> file. If you
					ever need to delete this file to reclaim disk space, set the
					<strong>#optimization-guide-on-device-model</strong> flag back to 'Disabled' and restart Chrome.
				</div>
			</div>

			<div class="ai-config-steps card-dark font-mono text-xs">
				<h3 class="title-sm text-warning mb-2">// LOCAL_LLM_ENABLE_PROCEDURE</h3>
				<p class="paste-hint">
					Chrome blocks <code class="inline-code">chrome://</code> links, so each one below has a
					<strong class="text-primary">Copy</strong> button — paste it into the address bar of a new
					tab.
				</p>
				<ol class="setup-list">
					<li>
						Enable the Prompt API: copy this link, open it in a new tab, and set the flag to
						<strong>Enabled</strong>.
						{@render copyField('prompt-flag', 'chrome://flags/#prompt-api-for-gemini-nano')}
					</li>
					<li>
						Enable the on-device model: copy this link, open it, and set the flag to
						<strong>Enabled BypassPrefRequirement</strong>.
						{@render copyField('model-flag', 'chrome://flags/#optimization-guide-on-device-model')}
						<span class="text-warning"
							>*'BypassPrefRequirement' is crucial to prevent silent hardware capability rejects.</span
						>
					</li>
					<li>
						Relaunch Chrome completely. (A second relaunch is sometimes needed to enforce flag
						updates).
					</li>
					<li>
						<strong>Download the model:</strong> after relaunching, reload this page and click the button
						below. It registers Chrome's on-device component and begins the download — keep this tab open
						while it runs.
						<div class="download-action">
							{#if aiStatus === 'downloading'}
								<div class="download-progress">
									<ProgressBar
										value={downloadProgress ?? 0}
										indeterminate={!downloadProgress}
										color="primary"
										height="8px"
										border
									/>
									<span class="download-pct">{downloadProgress ? `${downloadProgress}%` : '…'}</span>
								</div>
								<span class="downloading-note text-xs text-muted"
									>Downloading… this can take several minutes on first run. Keep this tab open.</span
								>
							{:else if aiStatus === 'available'}
								<span class="model-ready text-success">✓ Model downloaded and ready.</span>
							{:else if aiStatus === 'unsupported'}
								<span class="text-warning"
									>Prompt API not detected yet — finish steps 1–3, relaunch Chrome, then reload this
									page.</span
								>
							{:else}
								<button class="btn btn-primary btn-download" onclick={triggerDownload}
									>⬇ Download Model</button
								>
							{/if}
						</div>
					</li>
					<li>
						Check progress: copy this link and open it, then click the
						<strong>"Model Status"</strong> tab. The status should change from
						<em>"No On-device Feature Used"</em> to <em>"Downloading"</em>.
						{@render copyField('internals', 'chrome://on-device-internals')}
					</li>
					<li>
						Once download completes, scan any target site, switch to the dedicated <strong
							>✨ AI Chat</strong
						> tab, and click any quick audit action card to begin!
					</li>
				</ol>
			</div>
		</div>
	</section>
</InfoPageLayout>

<style>
	/* Steps styling for How To Use */
	.steps-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-lg);
	}

	.step-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.step-number {
		font-family: var(--font-family-mono);
		font-size: 32px;
		font-weight: 700;
		color: var(--color-primary);
		opacity: 0.85;
		border-bottom: 2px solid var(--color-primary-disabled);
		padding-bottom: var(--spacing-xxs);
		width: max-content;
	}

	.step-content h4 {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-ink);
		margin-bottom: 6px;
	}

	.step-content p {
		font-size: 14px;
		line-height: 1.6;
		color: var(--color-body);
	}

	/* Responsive collapses for steps */
	@media (max-width: 1024px) {
		.steps-container {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.steps-container {
			grid-template-columns: 1fr;
		}
	}

	/* Chrome AI Section classes */
	.mt-5 {
		margin-top: 48px;
	}
	.pt-5 {
		padding-top: 48px;
	}
	.border-t {
		border-top: 1px solid var(--color-hairline);
	}
	.mb-2 {
		margin-bottom: var(--spacing-xs);
	}
	.mt-3 {
		margin-top: var(--spacing-sm);
	}
	.p-2 {
		padding: var(--spacing-sm);
	}

	.ai-config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-lg);
	}

	.ai-config-info,
	.ai-config-steps {
		padding: var(--spacing-xl);
		border-radius: var(--rounded-lg);
	}

	.space-warning-box {
		background-color: rgba(245, 158, 11, 0.05);
		border: 1px solid rgba(245, 158, 11, 0.15);
		line-height: 1.5;
	}

	.setup-list {
		margin-left: 20px;
		line-height: 1.6;
	}

	.setup-list li {
		margin-top: var(--spacing-xs);
	}

	.paste-hint {
		font-family: var(--font-family-sans);
		line-height: 1.5;
		color: var(--color-muted);
		margin-bottom: var(--spacing-sm);
	}

	.inline-code {
		font-family: var(--font-family-mono);
		background-color: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: var(--rounded-xs);
		padding: 1px 5px;
		color: var(--color-body-strong);
	}

	/* Copy-to-paste field: a monospace snippet with a one-click Copy button. */
	.copy-field {
		display: flex;
		align-items: stretch;
		gap: var(--spacing-xs);
		margin: 6px 0;
		width: 100%;
	}

	.copy-code {
		flex: 1;
		min-width: 0;
		font-family: var(--font-family-mono);
		color: var(--color-body-strong);
		background-color: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--rounded-xs);
		padding: 7px 10px;
		overflow-x: auto;
		white-space: nowrap;
		user-select: all;
	}

	.copy-btn {
		flex-shrink: 0;
		padding: 0 14px;
		font-family: var(--font-family-mono);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.08);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-radius: var(--rounded-xs);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.copy-btn:hover {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		border-color: var(--color-primary);
	}

	.copy-btn.copied {
		color: var(--color-success);
		background-color: rgb(var(--color-success-rgb) / 0.1);
		border-color: rgb(var(--color-success-rgb) / 0.35);
	}

	/* In-guide model download control */
	.download-action {
		margin-top: var(--spacing-sm);
	}

	.btn-download {
		height: 36px;
		padding: 0 var(--spacing-md);
		font-size: 13px;
	}

	.download-progress {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.download-progress :global(.pb-track) {
		flex: 1;
	}

	.download-pct {
		min-width: 3ch;
		text-align: right;
		font-family: var(--font-family-mono);
		color: var(--color-body-strong);
	}

	.model-ready {
		font-weight: 600;
	}

	.downloading-note {
		display: block;
		margin-top: var(--spacing-xs);
		font-family: var(--font-family-sans);
		line-height: 1.5;
	}

	@media (max-width: 768px) {
		.ai-config-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
