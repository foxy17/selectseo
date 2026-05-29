<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { AuditResults } from '$lib/seoEngine';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import ProgressBar from '$lib/components/ProgressBar.svelte';

	let { auditResults }: { auditResults: AuditResults } = $props();

	let aiStatus = $state<
		'unknown' | 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'
	>('unknown');
	let isChrome = $state(false);
	let overrideBrowserCheck = $state(false);
	// Model download progress (0–100) while the on-device model is downloading; null otherwise.
	let downloadProgress = $state<number | null>(null);

	// Wires Chrome's `downloadprogress` events into `downloadProgress`. Per the Prompt API
	// spec `e.loaded` is already a 0–1 fraction (no `total`); older builds report bytes with
	// a `total`, so we handle both.
	function attachDownloadMonitor(m: EventTarget) {
		m.addEventListener('downloadprogress', (ev: Event) => {
			const e = ev as ProgressEvent;
			const frac = e.total ? e.loaded / e.total : e.loaded;
			downloadProgress = Math.min(100, Math.max(0, Math.round((frac || 0) * 100)));
		});
	}

	type Message = { role: 'user' | 'assistant'; text: string };
	let messages = $state<Message[]>([]);
	let currentInput = $state('');
	let isGenerating = $state(false);
	let chatBoxEl = $state<HTMLDivElement | null>(null);

	// The active session and abort controller
	let session = $state<any>(null);
	let abortController = $state<AbortController | null>(null);

	const nudges = $derived([
		{
			id: 'optimize_meta',
			icon: '✨',
			label: 'Title & Meta Optimizer',
			subtitle: 'Generate high-CTR, length-optimized metadata pairs',
			prompt: `Based on the page crawl results, please optimize the page title and meta description.
Current Title: "${auditResults.onPage.title.text || 'None'}"
Current Description: "${auditResults.onPage.description.text || 'None'}"
Headings (H1): "${auditResults.onPage.headings.h1.join(', ') || 'None'}"

Provide 3 alternative optimized title & description pairs. Keep titles under 60 characters and descriptions under 160 characters. Format the response with a clean Markdown comparison table, noting character counts for each, and explain the targeted search intent.`
		},
		{
			id: 'keyword_planner',
			icon: '🔑',
			label: 'Keyword Strategy',
			subtitle: 'Identify target keyword opportunities & search intent',
			prompt: `Based on the page crawl results, analyze the page structure and headings.
URL: ${auditResults.url}
Title: "${auditResults.onPage.title.text || 'None'}"
Headings:
- H1: ${auditResults.onPage.headings.h1.join(', ') || 'None'}
- H2: ${auditResults.onPage.headings.h2.slice(0, 5).join(', ') || 'None'}

Suggest:
1. 5 target SEO keyword opportunities (primary and secondary).
2. The search intent behind these keywords (e.g. informational, commercial, transactional).
3. 3 long-tail questions users might search to find this content.`
		},
		{
			id: 'readability_audit',
			icon: '📝',
			label: 'Readability & Snippets',
			subtitle: 'Structure heading outlines for featured snippet optimization',
			prompt: `Analyze the heading outlines and text readability for the audited page.
Title: "${auditResults.onPage.title.text || 'None'}"
Main Headings: ${auditResults.onPage.headings.h1.join(', ') || 'None'}
Broken Links Count: ${auditResults.links.filter((l) => l.statusState === 'broken').length}
Word Count: ${auditResults.onPage.contentMetrics.wordCount}

Suggest actionable improvements to structure the content layout and headings to target Google's Featured Snippets, simplify any jargon, and optimize readability.`
		}
	]);

	onMount(async () => {
		detectBrowser();
		await checkAiAvailability();
		if (aiStatus === 'available') {
			await initializeSession();
		}
	});

	function detectBrowser() {
		if (typeof window === 'undefined') return;
		const ua = navigator.userAgent;
		const vendor = navigator.vendor;

		// Google Chrome check (Google Inc. vendor)
		const hasChrome =
			(ua.includes('Chrome') || ua.includes('CriOS')) && vendor.includes('Google Inc.');
		const isEdge = ua.includes('Edg');
		const isOpera = ua.includes('OPR') || ua.includes('Opera');
		const isBrave = !!(navigator as any).brave;

		isChrome = hasChrome && !isEdge && !isOpera && !isBrave;
	}

	async function checkAiAvailability() {
		if (typeof window === 'undefined') return;
		const win = window as any;
		const lm = (win.ai && win.ai.languageModel) || win.LanguageModel;
		if (!lm) {
			aiStatus = 'unsupported';
			return;
		}
		try {
			const status = await lm.availability();
			aiStatus = status;
		} catch (e) {
			console.error('Failed to get Chrome AI availability:', e);
			aiStatus = 'unsupported';
		}
	}

	async function initializeSession() {
		if (typeof window === 'undefined') return;
		const win = window as any;
		const lm = (win.ai && win.ai.languageModel) || win.LanguageModel;
		if (!lm) return;

		try {
			// Build a system prompt utilizing the current audit data
			const systemPrompt = `You are an expert SEO Copilot running natively in the browser. You are analyzing the following website:
URL: ${auditResults.url}
Title: ${auditResults.onPage.title.text}
Meta Description: ${auditResults.onPage.description.text}
H1 Headings: ${auditResults.onPage.headings.h1.join(', ') || 'None'}
Broken Links: ${auditResults.links.filter((l) => l.statusState === 'broken').length}
Word Count: ${auditResults.onPage.contentMetrics.wordCount}

Your goal is to answer the user's questions about this SEO audit, provide actionable advice, or generate optimized content (like rewriting titles/descriptions). Format your responses in markdown.`;

			session = await lm.create({
				systemPrompt: systemPrompt,
				// Surface progress if the model still needs to download on first session create.
				monitor: attachDownloadMonitor
			});
			downloadProgress = null;

			messages.push({
				role: 'assistant',
				text:
					'Hello! I am your local Gemini Nano Copilot. I have analyzed your SEO audit for **' +
					auditResults.url +
					'**. What would you like to know or optimize?'
			});
		} catch (e) {
			console.error('Session creation failed', e);
			messages.push({ role: 'assistant', text: 'Error initializing the local model session.' });
		}
	}

	async function sendMessage() {
		if (!currentInput.trim() || !session || isGenerating) return;

		const userMessage = currentInput.trim();
		currentInput = '';

		messages = [...messages, { role: 'user', text: userMessage }];
		isGenerating = true;

		// Add an empty assistant message that we will stream into
		messages = [...messages, { role: 'assistant', text: '' }];

		scrollToBottom();

		abortController = new AbortController();
		const signal = abortController.signal;

		try {
			const stream = await session.promptStreaming(userMessage, { signal });

			let accumulated = '';
			for await (const chunk of stream) {
				if (accumulated.length > 0 && chunk.startsWith(accumulated)) {
					accumulated = chunk; // Cumulative
				} else {
					accumulated += chunk; // Delta
				}

				// Auto-scroll only if the user is already at the bottom (within a 100px threshold)
				const isUserAtBottom = chatBoxEl
					? chatBoxEl.scrollHeight - chatBoxEl.scrollTop - chatBoxEl.clientHeight <= 100
					: true;

				// Update the last message
				messages[messages.length - 1].text = accumulated;
				messages = [...messages];

				if (isUserAtBottom) {
					scrollToBottom();
				}
			}
		} catch (err: any) {
			if (err.name === 'AbortError') {
				messages[messages.length - 1].text += '\n\n*Generation stopped.*';
				messages = [...messages];
			} else {
				console.error(err);
				messages[messages.length - 1].text =
					`[ERROR] Prompt execution aborted: ${err.message || err}`;
				messages = [...messages];
			}
		} finally {
			isGenerating = false;
			abortController = null;
			scrollToBottom();
		}
	}

	async function runNudge(promptText: string) {
		if (isGenerating || !session) return;
		currentInput = promptText;
		await sendMessage();
	}

	function stopGeneration() {
		if (abortController) {
			abortController.abort();
			abortController = null;
		}
		isGenerating = false;
	}

	async function startNewChat() {
		stopGeneration();
		messages = [];
		await initializeSession();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function renderMarkdown(rawText: string) {
		return DOMPurify.sanitize(marked.parse(rawText) as string);
	}

	function scrollToBottom() {
		tick().then(() => {
			if (chatBoxEl) {
				chatBoxEl.scrollTo({
					top: chatBoxEl.scrollHeight,
					behavior: 'smooth'
				});
			}
		});
	}

	// Helper trigger function for when status is downloadable
	async function triggerDownload() {
		if (typeof window === 'undefined') return;
		const win = window as any;
		const lm = (win.ai && win.ai.languageModel) || win.LanguageModel;
		if (lm) {
			try {
				aiStatus = 'downloading';
				downloadProgress = 0;
				// Pass a monitor so we can surface real download progress instead of a blocking alert.
				await lm.create({ monitor: attachDownloadMonitor });
				downloadProgress = 100;
				await checkAiAvailability();
			} catch (e) {
				console.error(e);
				aiStatus = 'downloadable';
			} finally {
				downloadProgress = null;
			}
		}
	}
</script>

<div class="ai-chat-tab">
	<div class="chat-header card-dark">
		<div class="header-left">
			<span class="pulse-sparkle text-primary">✨</span>
			<h2 class="title-md font-mono">SEO AI Copilot</h2>
			{#if aiStatus === 'available'}
				<button
					class="new-chat-btn font-mono"
					onclick={startNewChat}
					title="Start a new chat session"
				>
					<svg
						class="new-chat-icon"
						xmlns="http://www.w3.org/2000/svg"
						width="11"
						height="11"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"
						></line></svg
					>
					New Chat
				</button>
			{/if}
		</div>
		<div class="header-right font-mono text-xs flex items-center gap-3">
			{#if aiStatus === 'available'}
				<span class="status-indicator online">● READY (LOCAL)</span>
			{:else if aiStatus === 'downloading'}
				<span class="status-indicator warning pulse-slow">● DOWNLOADING...</span>
			{:else}
				<span class="status-indicator offline">● {aiStatus.toUpperCase()}</span>
			{/if}
		</div>
	</div>

	{#if aiStatus === 'available'}
		<!-- State 3: Enabled -->
		<div class="chat-container card-dark mt-4">
			<div class="chat-history" class:welcome-state={messages.length <= 1} bind:this={chatBoxEl}>
				{#if messages.length === 0}
					<div class="empty-chat font-mono text-center">
						<div class="spinner-neon"></div>
						<p class="text-muted mt-3">Initializing connection to Gemini Nano...</p>
					</div>
				{:else if messages.length === 1}
					<!-- State 3.1: Welcome Hero State -->
					<div class="welcome-hero animate-fade-in">
						<div class="hero-avatar">
							<div class="avatar-glow"></div>
							<span class="avatar-icon">✨</span>
						</div>
						<h3 class="hero-title font-mono text-gradient">SEO AI COPILOT</h3>
						<p class="hero-desc">
							I have analyzed the SEO audit for <code class="hero-url">{auditResults.url}</code>.
							Select a quick action below or write a custom query to start optimizing your search
							performance.
						</p>

						<div class="nudges-grid-wrapper">
							<div class="nudges-header font-mono text-xxs text-primary mb-3">
								// PREDEFINED_SEO_QUICK_ACTIONS
							</div>
							<div class="nudges-grid">
								{#each nudges as nudge (nudge.id)}
									<button class="nudge-card card-dark" onclick={() => runNudge(nudge.prompt)}>
										<div class="nudge-card-header">
											<span class="nudge-icon">{nudge.icon}</span>
											<span class="nudge-action-title font-mono">{nudge.label}</span>
										</div>
										<p class="nudge-card-subtitle text-xxs text-muted">{nudge.subtitle}</p>
										<div class="nudge-card-footer font-mono text-xxs">
											<span>RUN AUDIT</span>
											<span class="arrow">→</span>
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{:else}
					<!-- State 3.2: Active Conversation State -->
					{#each messages as msg, i (i)}
						<div class="message-wrapper" class:user-msg={msg.role === 'user'}>
							<div
								class="message-bubble"
								class:assistant={msg.role === 'assistant'}
								class:user={msg.role === 'user'}
							>
								<div class="msg-author font-mono">
									{msg.role === 'assistant' ? '🤖 Copilot' : '👤 You'}
								</div>
								<div class="msg-content markdown-body">
									{#if msg.role === 'assistant' && msg.text === '' && isGenerating}
										<div class="typing-indicator-container">
											<span class="typing-indicator"></span>
											<span class="typing-indicator"></span>
											<span class="typing-indicator"></span>
										</div>
									{:else}
										{@html renderMarkdown(msg.text)}
									{/if}
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<div class="chat-input-area-container">
				{#if messages.length > 1 && !isGenerating}
					<div class="quick-nudge-pills">
						{#each nudges as nudge (nudge.id)}
							<button
								class="nudge-pill-btn font-mono text-xxs"
								onclick={() => runNudge(nudge.prompt)}
								title={nudge.subtitle}
							>
								{nudge.icon}
								{nudge.label}
							</button>
						{/each}
					</div>
				{/if}

				<div class="chat-input-area">
					<textarea
						class="chat-input"
						placeholder="Ask about your SEO report... (Shift+Enter for new line)"
						bind:value={currentInput}
						onkeydown={handleKeydown}
						disabled={isGenerating}
					></textarea>
					{#if isGenerating}
						<button class="btn send-btn stop-btn" onclick={stopGeneration}> Stop </button>
					{:else}
						<button class="btn send-btn" onclick={sendMessage} disabled={!currentInput.trim()}>
							Send
						</button>
					{/if}
				</div>
			</div>
		</div>
	{:else if !isChrome && !overrideBrowserCheck}
		<!-- State 1: Chrome not detected -->
		<div class="setup-guide-box card-dark mt-4 border-error">
			<div class="error-header font-mono">
				<span class="text-error">⚠️</span>
				<span class="text-error font-bold">// GOOGLE_CHROME_REQUIRED</span>
			</div>
			<p class="text-muted mt-3">
				The SEO AI Copilot uses <strong>Google Chrome's native Prompt API</strong> to run a local
				instance of <strong>Gemini Nano</strong> directly in your browser.
			</p>
			<p class="text-muted mt-2">
				Running AI models locally ensures your crawled site data is analyzed with <strong
					>100% privacy</strong
				> (nothing is sent to external servers) and runs entirely offline.
			</p>

			<div class="download-section mt-4 font-mono">
				<p class="text-xs text-primary">// TO_PROCEED:</p>
				<div class="action-buttons mt-3 flex gap-3">
					<a
						href="https://www.google.com/chrome/"
						target="_blank"
						rel="noopener noreferrer"
						class="btn btn-primary text-center"
					>
						Download Google Chrome
					</a>
					<button class="btn btn-secondary" onclick={() => (overrideBrowserCheck = true)}>
						Bypass Check &amp; View Setup
					</button>
				</div>
			</div>

			<div class="browser-info mt-4 font-mono text-xxs text-muted">
				<span class="label">Detected User Agent:</span>
				<span class="val text-body"
					>{typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'}</span
				>
			</div>
		</div>
	{:else}
		<!-- State 2: Chrome but AI features not enabled -->
		<div class="setup-guide-box card-dark mt-4 border-warning">
			<div class="warning-header font-mono flex justify-between items-center">
				<div class="flex items-center gap-2">
					<span class="text-warning">⚡</span>
					<span class="text-warning font-bold">// ENABLE_CHROME_AI_STEPS</span>
				</div>
				<button class="btn btn-secondary btn-xs font-mono" onclick={checkAiAvailability}>
					🔄 RE-CHECK STATUS
				</button>
			</div>

			<p class="text-muted mt-3 text-sm">
				Google Chrome is detected, but its built-in local AI model (Gemini Nano) is either disabled
				or not yet downloaded. Follow these steps to configure your browser:
			</p>

			<div class="steps-container mt-4">
				<div class="step-card">
					<div class="step-num font-mono">01</div>
					<div class="step-content">
						<p class="font-mono text-sm text-body-strong">Open Experimental Flags</p>
						<span class="text-xs text-muted">Copy and paste this link in a new tab:</span>
						<code class="code-link select-all">chrome://flags</code>
					</div>
				</div>

				<div class="step-card">
					<div class="step-num font-mono">02</div>
					<div class="step-content">
						<p class="font-mono text-sm text-body-strong">Enable Gemini Nano Prompt API</p>
						<span class="text-xs text-muted"
							>Find <strong class="text-primary">#prompt-api-for-gemini-nano</strong> and set it to:</span
						>
						<code class="code-value font-mono">Enabled</code>
					</div>
				</div>

				<div class="step-card">
					<div class="step-num font-mono">03</div>
					<div class="step-content">
						<p class="font-mono text-sm text-body-strong">Enable On-Device Model Guide</p>
						<span class="text-xs text-muted"
							>Find <strong class="text-primary">#optimization-guide-on-device-model</strong> and set
							it to:</span
						>
						<code class="code-value font-mono">Enabled BypassPrefRequirement</code>
					</div>
				</div>

				<div class="step-card">
					<div class="step-num font-mono">04</div>
					<div class="step-content">
						<p class="font-mono text-sm text-body-strong">Relaunch Chrome</p>
						<span class="text-xs text-muted"
							>Click the <strong class="text-warning">Relaunch</strong> button at the bottom of the flags
							page to apply changes.</span
						>
					</div>
				</div>

				<div class="step-card font-mono">
					<div class="step-num font-mono">05</div>
					<div class="step-content">
						<p class="font-mono text-sm text-body-strong">Initialize / Download Model</p>
						{#if aiStatus === 'downloading'}
							<span class="text-xs text-muted font-sans"
								>Downloading the on-device model. This can take a few minutes on the first run —
								keep this tab open.</span
							>
							<div class="download-progress mt-2">
								<ProgressBar value={downloadProgress ?? 0} color="primary" height="8px" border />
								<span class="download-pct font-mono text-xs text-body-strong">
									{downloadProgress ?? 0}%
								</span>
							</div>
						{:else if aiStatus === 'downloadable'}
							<span class="text-xs text-muted font-sans"
								>The model is ready to download! Click below to start the download:</span
							>
							<div class="mt-2">
								<button class="btn btn-primary btn-sm" onclick={triggerDownload}
									>Download Model</button
								>
							</div>
						{:else}
							<span class="text-xs text-muted font-sans"
								>If the Prompt API is still unavailable after relaunch, open <code
									class="code-link font-mono">chrome://components</code
								>
								and check for updates under <strong>Optimization Guide On Device Model</strong>.
								Then, refresh this page.</span
							>
						{/if}
					</div>
				</div>
			</div>

			<div class="status-footer mt-4 font-mono text-xs flex justify-between items-center">
				<span
					>Current AI Status: <strong class="text-warning">{aiStatus.toUpperCase()}</strong></span
				>
				{#if overrideBrowserCheck}
					<button
						class="btn-text text-xxs font-mono text-muted hover-primary"
						onclick={() => {
							overrideBrowserCheck = false;
							detectBrowser();
						}}
					>
						[Re-enable Browser Check]
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.ai-chat-tab {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-md) var(--spacing-lg);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.new-chat-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		font-size: 10px;
		font-weight: 700;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.08);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-radius: var(--rounded-sm);
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.new-chat-btn:hover {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		border-color: var(--color-primary);
		box-shadow: 0 0 10px rgb(var(--color-primary-rgb) / 0.2);
	}

	.new-chat-icon {
		display: inline-block;
		flex-shrink: 0;
	}

	.status-indicator {
		font-size: 11px;
		font-weight: 700;
	}
	.status-indicator.online {
		color: var(--color-success);
		text-shadow: 0 0 8px var(--color-success);
	}
	.status-indicator.warning {
		color: var(--color-warning);
		text-shadow: 0 0 8px var(--color-warning);
	}
	.status-indicator.offline {
		color: var(--color-muted);
	}

	.pulse-slow {
		animation: pulse 2s infinite;
	}
	@keyframes pulse {
		0% {
			opacity: 0.6;
		}
		50% {
			opacity: 1;
		}
		100% {
			opacity: 0.6;
		}
	}

	/* Setup & Warning Boxes */
	.setup-guide-box {
		padding: var(--spacing-lg);
		border-radius: var(--rounded-md);
		background-color: rgba(0, 0, 0, 0.2);
	}
	.setup-guide-box.border-error {
		border: 1px solid rgb(var(--color-error-rgb) / 0.2);
		box-shadow: inset 0 0 10px rgb(var(--color-error-rgb) / 0.05);
	}
	.setup-guide-box.border-warning {
		border: 1px solid rgb(var(--color-warning-rgb) / 0.2);
		box-shadow: inset 0 0 10px rgb(var(--color-warning-rgb) / 0.05);
	}

	.text-error {
		color: var(--color-error);
	}
	.text-warning {
		color: var(--color-warning);
	}
	.font-bold {
		font-weight: 700;
	}

	.btn-xs {
		padding: 4px 8px;
		font-size: 10px;
		background: transparent;
		border: 1px solid var(--color-hairline-strong);
		color: var(--color-body);
		cursor: pointer;
	}
	.btn-xs:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
	}

	.btn-text {
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: underline;
	}
	.hover-primary:hover {
		color: var(--color-primary) !important;
	}

	.steps-container {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	.step-card {
		display: flex;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
		align-items: flex-start;
	}

	.step-num {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.05);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.1);
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--rounded-sm);
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
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
	}

	.code-link {
		background-color: rgba(255, 255, 255, 0.05);
		padding: 2px 6px;
		border-radius: 4px;
		display: inline-block;
		width: fit-content;
		margin-top: 4px;
		font-size: 11px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.code-value {
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.05);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid rgb(var(--color-primary-rgb) / 0.1);
		display: inline-block;
		width: fit-content;
		margin-top: 4px;
		font-size: 11px;
	}

	.select-all {
		user-select: all;
		cursor: pointer;
	}

	.btn-sm {
		padding: 4px 10px;
		font-size: 11px;
	}

	/* Chat UI */
	.chat-container {
		display: flex;
		flex-direction: column;
		height: 600px;
		padding: 0;
		overflow: hidden;
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-lg);
		background: rgba(10, 10, 10, 0.5);
		backdrop-filter: blur(10px);
	}

	.chat-history {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}

	/* Custom scrollbar for chat history */
	.chat-history::-webkit-scrollbar {
		width: 6px;
	}
	.chat-history::-webkit-scrollbar-track {
		background: transparent;
	}
	.chat-history::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
	}
	.chat-history::-webkit-scrollbar-thumb:hover {
		background: rgb(var(--color-primary-rgb) / 0.25);
	}

	.chat-history.welcome-state {
		justify-content: center;
		align-items: center;
		padding: var(--spacing-xl);
	}

	.message-wrapper {
		display: flex;
		width: 100%;
		margin-bottom: 2px;
	}

	.message-wrapper.user-msg {
		justify-content: flex-end;
	}

	/* Message bubbles */
	.message-bubble {
		max-width: 85%;
		padding: var(--spacing-md);
		border-radius: var(--rounded-md);
		position: relative;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.message-bubble.assistant {
		background-color: var(--color-surface-card);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-left: 3px solid var(--color-primary);
		border-top-left-radius: 2px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.message-bubble.user {
		background: linear-gradient(
			135deg,
			rgb(var(--color-primary-rgb) / 0.15) 0%,
			rgb(var(--color-primary-rgb) / 0.04) 100%
		);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		color: var(--color-ink);
		border-top-right-radius: 2px;
		box-shadow: 0 4px 12px rgb(var(--color-primary-rgb) / 0.03);
	}

	.msg-author {
		font-size: 11px;
		color: var(--color-muted);
		margin-bottom: var(--spacing-xs);
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.5px;
	}

	.message-bubble.user .msg-author {
		color: var(--color-primary);
		text-align: right;
	}

	/* Welcome Hero Panel */
	.welcome-hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
	}

	.hero-avatar {
		position: relative;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background-color: rgb(var(--color-primary-rgb) / 0.05);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.2);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: var(--spacing-md);
	}

	.avatar-glow {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		box-shadow: 0 0 20px rgb(var(--color-primary-rgb) / 0.15);
		animation: pulseGlow 2.5s infinite ease-in-out;
	}

	@keyframes pulseGlow {
		0% {
			transform: scale(0.95);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.1);
			opacity: 1;
		}
		100% {
			transform: scale(0.95);
			opacity: 0.5;
		}
	}

	.avatar-icon {
		font-size: 20px;
		z-index: 1;
	}

	.hero-title {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: 1.5px;
		margin-bottom: var(--spacing-sm);
	}

	.text-gradient {
		background: linear-gradient(90deg, var(--color-on-dark) 30%, var(--color-primary) 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}

	.hero-desc {
		font-size: 13px;
		color: var(--color-body);
		max-width: 540px;
		line-height: 1.6;
		margin-bottom: var(--spacing-lg);
	}

	.hero-url {
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.06);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.15);
		padding: 2px 6px;
		border-radius: var(--rounded-xs);
		font-family: var(--font-family-mono);
	}

	.nudges-grid-wrapper {
		width: 100%;
	}

	.nudges-header {
		letter-spacing: 0.5px;
	}

	.nudges-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-md);
		width: 100%;
	}

	@media (max-width: 768px) {
		.nudges-grid {
			grid-template-columns: 1fr;
			gap: var(--spacing-sm);
		}
	}

	.nudge-card {
		background-color: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.05);
		border-radius: var(--rounded-md);
		padding: var(--spacing-md);
		text-align: left;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		height: 130px;
	}

	.nudge-card:hover {
		border-color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.03);
		transform: translateY(-2px);
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.3),
			0 0 15px rgb(var(--color-primary-rgb) / 0.05);
	}

	.nudge-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.nudge-icon {
		font-size: 16px;
	}

	.nudge-action-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-ink);
	}

	.nudge-card:hover .nudge-action-title {
		color: var(--color-primary);
	}

	.nudge-card-subtitle {
		font-size: 11px;
		color: var(--color-muted);
		line-height: 1.4;
		margin-top: 6px;
		flex-grow: 1;
	}

	.nudge-card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: var(--color-muted);
		font-size: 10px;
		font-weight: 700;
		margin-top: 12px;
		letter-spacing: 0.5px;
		border-top: 1px solid rgba(255, 255, 255, 0.02);
		padding-top: 8px;
	}

	.nudge-card:hover .nudge-card-footer {
		color: var(--color-primary);
		border-color: rgb(var(--color-primary-rgb) / 0.1);
	}

	.nudge-card-footer .arrow {
		transition: transform 0.2s ease;
	}

	.nudge-card:hover .nudge-card-footer .arrow {
		transform: translateX(3px);
	}

	/* Quick Action Pills */
	.quick-nudge-pills {
		display: flex;
		gap: var(--spacing-xs);
		padding: var(--spacing-xs) var(--spacing-md);
		background-color: rgba(0, 0, 0, 0.25);
		border-top: 1px solid var(--color-hairline);
		overflow-x: auto;
		scrollbar-width: none; /* Hide scrollbar for Firefox */
	}
	.quick-nudge-pills::-webkit-scrollbar {
		display: none; /* Hide scrollbar for Chrome/Safari */
	}

	.nudge-pill-btn {
		background-color: rgba(255, 255, 255, 0.03);
		border: 1px solid var(--color-hairline-strong);
		color: var(--color-body);
		padding: 6px 12px;
		border-radius: var(--rounded-pill);
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.nudge-pill-btn:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.05);
	}

	/* Chat Input Area */
	.chat-input-area-container {
		display: flex;
		flex-direction: column;
	}

	.chat-input-area {
		display: flex;
		gap: var(--spacing-sm);
		padding: var(--spacing-md);
		background-color: rgba(0, 0, 0, 0.25);
		border-top: 1px solid var(--color-hairline);
	}

	.chat-input {
		flex: 1;
		background-color: var(--color-surface-soft);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
		padding: 10px 14px;
		color: var(--color-on-dark);
		font-family: var(--font-family-sans);
		resize: none;
		height: 60px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.chat-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 10px rgb(var(--color-primary-rgb) / 0.08);
	}

	.send-btn {
		align-self: flex-end;
		height: 40px;
		padding: 0 var(--spacing-lg);
		background-color: var(--color-primary);
		color: var(--color-on-primary);
		border: none;
		border-radius: var(--rounded-sm);
		font-weight: 700;
		font-family: var(--font-family-mono);
		text-transform: uppercase;
		font-size: 11px;
		letter-spacing: 0.5px;
		box-shadow: 0 4px 12px rgb(var(--color-primary-rgb) / 0.15);
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.send-btn:hover:not(:disabled) {
		background-color: var(--color-primary-active);
		box-shadow: 0 6px 16px rgb(var(--color-primary-rgb) / 0.25);
		transform: translateY(-1px);
	}

	.send-btn:active:not(:disabled) {
		transform: translateY(1px);
		box-shadow: 0 2px 6px rgb(var(--color-primary-rgb) / 0.15);
	}

	.send-btn:disabled {
		background-color: rgb(var(--color-primary-rgb) / 0.04);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.08);
		color: var(--color-muted-soft);
		box-shadow: none;
		cursor: not-allowed;
	}

	.stop-btn {
		background-color: rgb(var(--color-error-rgb) / 0.1) !important;
		border: 1px solid rgb(var(--color-error-rgb) / 0.3) !important;
		color: var(--color-error) !important;
		box-shadow: none !important;
	}
	.stop-btn:hover {
		background-color: rgb(var(--color-error-rgb) / 0.2) !important;
		border-color: var(--color-error) !important;
		box-shadow: 0 0 10px rgb(var(--color-error-rgb) / 0.15) !important;
	}

	/* Spinner Loader */
	.spinner-neon {
		width: 32px;
		height: 32px;
		border: 2px solid rgb(var(--color-primary-rgb) / 0.05);
		border-top: 2px solid var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s cubic-bezier(0.5, 0.1, 0.1, 0.9) infinite;
		margin: 0 auto;
		box-shadow:
			0 0 15px rgb(var(--color-primary-rgb) / 0.1),
			inset 0 0 10px rgb(var(--color-primary-rgb) / 0.05);
	}
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Typing Indicator */
	.typing-indicator-container {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 0;
	}

	.typing-indicator {
		width: 6px;
		height: 6px;
		background-color: var(--color-primary);
		border-radius: 50%;
		box-shadow: 0 0 8px var(--color-primary);
		animation: typingBounce 1.4s infinite ease-in-out;
	}

	.typing-indicator:nth-child(1) {
		animation-delay: 0s;
	}
	.typing-indicator:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing-indicator:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes typingBounce {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.35;
		}
		50% {
			transform: translateY(-6px);
			opacity: 1;
			box-shadow: 0 0 12px var(--color-primary);
		}
	}

	/* Animation */
	.animate-fade-in {
		animation: fadeIn 0.4s ease-out;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Global Markdown Styling inside chat bubbles */
	:global(.markdown-body p) {
		margin-bottom: 12px;
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--color-body-strong);
	}
	:global(.markdown-body p:last-child) {
		margin-bottom: 0;
	}
	:global(.markdown-body strong) {
		color: var(--color-primary);
		font-weight: 600;
	}

	/* Markdown Lists with proper nesting and indenting */
	:global(.markdown-body ul),
	:global(.markdown-body ol) {
		margin-left: 20px;
		margin-bottom: 12px;
		padding-left: 4px;
	}
	:global(.markdown-body li) {
		margin-bottom: 6px;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--color-body);
	}
	:global(.markdown-body li:last-child) {
		margin-bottom: 0;
	}
	:global(.markdown-body li strong) {
		color: var(--color-primary);
	}

	/* Markdown Headings inside chat bubbles */
	:global(.markdown-body h1) {
		font-size: 16px;
		margin-top: 16px;
		margin-bottom: 8px;
		color: var(--color-ink);
		border-bottom: 1px solid var(--color-hairline);
		padding-bottom: 4px;
		font-weight: 700;
	}
	:global(.markdown-body h2) {
		font-size: 14.5px;
		margin-top: 14px;
		margin-bottom: 8px;
		color: var(--color-ink);
		font-weight: 600;
	}
	:global(.markdown-body h3) {
		font-size: 13px;
		margin-top: 12px;
		margin-bottom: 6px;
		color: var(--color-body-strong);
		font-weight: 600;
	}

	/* Inline Code styling */
	:global(.markdown-body code) {
		background-color: rgba(255, 255, 255, 0.08);
		color: var(--color-primary);
		padding: 2px 5px;
		border-radius: 4px;
		font-family: var(--font-family-mono);
		font-size: 12px;
		border: 1px solid rgba(255, 255, 255, 0.04);
	}

	/* Code Block containers (pre) styling */
	:global(.markdown-body pre) {
		background-color: rgba(0, 0, 0, 0.4) !important;
		border: 1px solid rgba(255, 255, 255, 0.08) !important;
		border-radius: var(--rounded-sm);
		padding: var(--spacing-sm);
		margin: var(--spacing-sm) 0;
		overflow-x: auto;
		max-width: 100%;
	}

	:global(.markdown-body pre code) {
		background: none !important;
		border: none !important;
		padding: 0 !important;
		border-radius: 0 !important;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-body-strong);
		display: block;
		font-family: var(--font-family-mono);
	}

	/* Sleek custom scrollbar for code blocks */
	:global(.markdown-body pre::-webkit-scrollbar) {
		height: 4px;
	}
	:global(.markdown-body pre::-webkit-scrollbar-track) {
		background: transparent;
	}
	:global(.markdown-body pre::-webkit-scrollbar-thumb) {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 2px;
	}
	:global(.markdown-body pre::-webkit-scrollbar-thumb:hover) {
		background: var(--color-primary);
	}

	/* Tables styling in markdown */
	:global(.markdown-body table) {
		width: 100%;
		border-collapse: collapse;
		margin-top: 12px;
		margin-bottom: 16px;
		font-size: 12.5px;
	}
	:global(.markdown-body th) {
		background-color: rgb(var(--color-primary-rgb) / 0.03);
		border: 1px solid var(--color-hairline-strong);
		padding: 8px 12px;
		text-align: left;
		color: var(--color-primary);
		font-family: var(--font-family-mono);
		font-weight: 600;
	}
	:global(.markdown-body td) {
		border: 1px solid var(--color-hairline);
		padding: 8px 12px;
		line-height: 1.5;
		color: var(--color-body);
	}
	:global(.markdown-body tr:nth-child(even)) {
		background-color: rgba(255, 255, 255, 0.01);
	}
	:global(.markdown-body tr:hover) {
		background-color: rgb(var(--color-primary-rgb) / 0.02);
	}
</style>
