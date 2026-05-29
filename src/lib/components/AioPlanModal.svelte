<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { marked } from 'marked';
	import DOMPurify from 'dompurify';
	import { aioPlan, type AioPlanContext } from '$lib/aioPlanState.svelte';

	let { ctx, onClose }: { ctx: AioPlanContext; onClose: () => void } = $props();

	let input = $state('');
	let chatBox = $state<HTMLDivElement | null>(null);
	let inputEl = $state<HTMLTextAreaElement | null>(null);

	function renderMarkdown(text: string): string {
		return DOMPurify.sanitize(marked.parse(text) as string);
	}

	function scrollToBottom() {
		tick().then(() => {
			if (chatBox) chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
		});
	}

	// Keep the view pinned to the newest content as it streams in.
	$effect(() => {
		// Touch the reactive deps so this re-runs on every streamed update.
		void aioPlan.messages.length;
		void aioPlan.messages[aioPlan.messages.length - 1]?.text;
		scrollToBottom();
	});

	async function send() {
		const q = input.trim();
		if (!q || aioPlan.isStreaming) return;
		input = '';
		await aioPlan.ask(q);
	}

	function regenerate() {
		aioPlan.start(ctx);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	}

	onMount(() => {
		inputEl?.focus();
		function onWindowKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
		}
		window.addEventListener('keydown', onWindowKey);
		return () => window.removeEventListener('keydown', onWindowKey);
	});
</script>

<!-- Backdrop: click/key it directly to dismiss. Guard on target so events that
	 bubble up from the dialog (e.g. Enter/Space in the textarea or on a button)
	 don't close the modal. Escape is handled by a window listener in onMount. -->
<div
	class="modal-backdrop"
	role="button"
	tabindex="-1"
	aria-label="Close action plan"
	onclick={(e) => {
		if (e.target === e.currentTarget) onClose();
	}}
	onkeydown={(e) => {
		if (e.target !== e.currentTarget) return;
		if (e.key === 'Enter' || e.key === ' ') onClose();
	}}
>
	<div
		class="modal-dialog card-dark"
		role="dialog"
		tabindex="-1"
		aria-modal="true"
		aria-labelledby="aio-plan-title"
	>
		<header class="modal-head">
			<div class="head-left">
				<span class="spark">✨</span>
				<h2 id="aio-plan-title" class="title-md font-mono">AI Action Plan</h2>
				<span class="local-badge font-mono">LOCAL · PRIVATE</span>
			</div>
			<div class="head-right">
				<button
					class="btn-regen font-mono"
					onclick={regenerate}
					disabled={aioPlan.isStreaming}
					title="Clear and generate a fresh plan"
				>
					↻ Regenerate
				</button>
				<button class="btn-close" onclick={onClose} aria-label="Close">✕</button>
			</div>
		</header>

		<div class="chat-history" bind:this={chatBox}>
			{#each aioPlan.messages as msg, i (i)}
				<div class="msg-row" class:user={msg.role === 'user'}>
					<div
						class="bubble"
						class:assistant={msg.role === 'assistant'}
						class:user={msg.role === 'user'}
					>
						<div class="bubble-author font-mono">
							{msg.role === 'assistant' ? '🤖 AEO Consultant' : '👤 You'}
						</div>
						{#if msg.role === 'assistant' && msg.text === '' && aioPlan.isStreaming}
							<div class="typing">
								<span></span><span></span><span></span>
							</div>
						{:else if msg.role === 'assistant'}
							<div class="bubble-body aio-md">{@html renderMarkdown(msg.text)}</div>
						{:else}
							<div class="bubble-body">{msg.text}</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if aioPlan.status === 'error' && aioPlan.error}
				<p class="chat-error font-mono">{aioPlan.error}</p>
			{/if}
		</div>

		<div class="chat-input-bar">
			<textarea
				class="chat-input"
				placeholder="Ask a follow-up about this plan… (Shift+Enter for new line)"
				bind:value={input}
				bind:this={inputEl}
				onkeydown={handleKeydown}
				disabled={aioPlan.isStreaming}
			></textarea>
			{#if aioPlan.isStreaming}
				<button class="btn-send stop" onclick={() => aioPlan.stop()}>Stop</button>
			{:else}
				<button class="btn-send" onclick={send} disabled={!input.trim()}>Send</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background-color: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-lg);
		animation: backdrop-in 0.2s ease-out;
	}
	@keyframes backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-dialog {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 760px;
		height: min(80vh, 720px);
		padding: 0;
		overflow: hidden;
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-radius: var(--rounded-lg);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
		animation: dialog-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
	@keyframes dialog-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		padding: var(--spacing-md) var(--spacing-lg);
		border-bottom: 1px solid var(--color-hairline);
		background-color: rgba(0, 0, 0, 0.25);
	}

	.head-left {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}
	.spark {
		font-size: 16px;
	}
	.local-badge {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.5px;
		color: var(--color-success);
		border: 1px solid rgb(var(--color-success-rgb, 34 197 94) / 0.3);
		border-radius: var(--rounded-xs);
		padding: 1px 6px;
	}

	.head-right {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.btn-regen {
		font-size: 11px;
		font-weight: 700;
		padding: 5px 12px;
		color: var(--color-primary);
		background-color: rgb(var(--color-primary-rgb) / 0.08);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-radius: var(--rounded-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-regen:hover:not(:disabled) {
		background-color: var(--color-primary);
		color: var(--color-on-primary);
	}
	.btn-regen:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn-close {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		color: var(--color-muted);
		background-color: transparent;
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.btn-close:hover {
		color: var(--color-error);
		border-color: rgb(var(--color-error-rgb) / 0.4);
	}

	.chat-history {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-lg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
	}
	.chat-history::-webkit-scrollbar {
		width: 6px;
	}
	.chat-history::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 3px;
	}

	.msg-row {
		display: flex;
		width: 100%;
	}
	.msg-row.user {
		justify-content: flex-end;
	}

	.bubble {
		max-width: 88%;
		padding: var(--spacing-md);
		border-radius: var(--rounded-md);
		word-wrap: break-word;
		overflow-wrap: break-word;
	}
	.bubble.assistant {
		background-color: var(--color-surface-card);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-left: 3px solid var(--color-primary);
		border-top-left-radius: 2px;
	}
	.bubble.user {
		background: linear-gradient(
			135deg,
			rgb(var(--color-primary-rgb) / 0.15) 0%,
			rgb(var(--color-primary-rgb) / 0.04) 100%
		);
		border: 1px solid rgb(var(--color-primary-rgb) / 0.25);
		border-top-right-radius: 2px;
	}

	.bubble-author {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--color-muted);
		margin-bottom: var(--spacing-xs);
	}
	.bubble.user .bubble-author {
		color: var(--color-primary);
		text-align: right;
	}
	.bubble-body {
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--color-body-strong);
	}

	.typing {
		display: flex;
		gap: 6px;
		padding: 6px 0;
	}
	.typing span {
		width: 6px;
		height: 6px;
		background-color: var(--color-primary);
		border-radius: 50%;
		box-shadow: 0 0 8px var(--color-primary);
		animation: typing-bounce 1.4s infinite ease-in-out;
	}
	.typing span:nth-child(2) {
		animation-delay: 0.2s;
	}
	.typing span:nth-child(3) {
		animation-delay: 0.4s;
	}
	@keyframes typing-bounce {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.35;
		}
		50% {
			transform: translateY(-6px);
			opacity: 1;
		}
	}

	.chat-error {
		font-size: 12px;
		color: var(--color-error);
	}

	.chat-input-bar {
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
		height: 52px;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
	}
	.chat-input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 10px rgb(var(--color-primary-rgb) / 0.08);
	}

	.btn-send {
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
		cursor: pointer;
		transition: all 0.2s ease;
	}
	.btn-send:hover:not(:disabled) {
		background-color: var(--color-primary-active);
		transform: translateY(-1px);
	}
	.btn-send:disabled {
		background-color: rgb(var(--color-primary-rgb) / 0.04);
		color: var(--color-muted-soft);
		cursor: not-allowed;
	}
	.btn-send.stop {
		background-color: rgb(var(--color-error-rgb) / 0.1);
		border: 1px solid rgb(var(--color-error-rgb) / 0.3);
		color: var(--color-error);
	}
	.btn-send.stop:hover {
		background-color: rgb(var(--color-error-rgb) / 0.2);
	}

	/* Markdown styling for the streamed AI plan / replies. */
	:global(.aio-md p) {
		font-size: 13.5px;
		line-height: 1.6;
		color: var(--color-body-strong);
		margin-bottom: 10px;
	}
	:global(.aio-md p:last-child) {
		margin-bottom: 0;
	}
	:global(.aio-md strong) {
		color: var(--color-primary);
		font-weight: 600;
	}
	:global(.aio-md ol),
	:global(.aio-md ul) {
		margin: 0 0 10px 20px;
		padding-left: 4px;
	}
	:global(.aio-md li) {
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--color-body);
		margin-bottom: 6px;
	}
	:global(.aio-md h1),
	:global(.aio-md h2),
	:global(.aio-md h3) {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-ink);
		margin: 12px 0 6px;
	}
	:global(.aio-md code) {
		font-family: var(--font-family-mono);
		font-size: 12px;
		color: var(--color-primary);
		background-color: rgba(255, 255, 255, 0.06);
		padding: 1px 5px;
		border-radius: 4px;
	}
	:global(.aio-md pre) {
		background-color: rgba(0, 0, 0, 0.4);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
		padding: var(--spacing-sm);
		overflow-x: auto;
		margin: 8px 0;
	}
	:global(.aio-md pre code) {
		background: none;
		padding: 0;
		color: var(--color-body-strong);
	}
	:global(.aio-md table) {
		width: 100%;
		border-collapse: collapse;
		margin: 8px 0;
		font-size: 12.5px;
	}
	:global(.aio-md th) {
		background-color: rgb(var(--color-primary-rgb) / 0.04);
		border: 1px solid var(--color-hairline-strong);
		padding: 6px 10px;
		text-align: left;
		color: var(--color-primary);
		font-family: var(--font-family-mono);
	}
	:global(.aio-md td) {
		border: 1px solid var(--color-hairline);
		padding: 6px 10px;
		color: var(--color-body);
	}
</style>
