<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { initShader } from '$lib/consoleShader';

	interface Props {
		logs: string[];
		title: string;
		emptyText?: string;
		/** Height of the console viewport in px (landing uses 240, crawl-detail 280). */
		viewportHeight?: number;
	}

	let { logs, title, emptyText = 'ready for input...', viewportHeight = 240 }: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let consoleBodyEl = $state<HTMLDivElement | null>(null);

	// Auto-scroll the terminal to the bottom whenever new log lines arrive.
	$effect(() => {
		logs;
		void tick().then(() => {
			if (consoleBodyEl) {
				consoleBodyEl.scrollTop = consoleBodyEl.scrollHeight;
			}
		});
	});

	onMount(() => {
		const cleanupShader = canvasEl ? initShader(canvasEl) : null;
		return () => {
			if (cleanupShader) cleanupShader();
		};
	});
</script>

<div class="console-card">
	<div class="console-header">
		<span class="dot red"></span>
		<span class="dot yellow"></span>
		<span class="dot green"></span>
		<span class="console-title">{title}</span>
	</div>
	<div class="console-viewport" style="height: {viewportHeight}px;">
		<canvas bind:this={canvasEl} class="console-canvas"></canvas>
		<div bind:this={consoleBodyEl} class="console-body">
			{#if logs.length === 0}
				<div class="empty-console">
					<span class="prompt">$</span>
					{emptyText}
				</div>
			{:else}
				{#each logs as logline}
					<div class="log-line">{logline}</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.console-card {
		position: relative;
		background-color: rgba(10, 10, 15, 0.95);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid rgba(250, 255, 105, 0.25);
		border-radius: var(--rounded-lg);
		overflow: hidden;
		font-family: var(--font-family-mono);
		box-shadow:
			0 0 30px rgba(250, 255, 105, 0.08),
			inset 0 0 25px rgba(0, 0, 0, 0.8);
	}

	.console-header {
		background-color: rgba(16, 16, 24, 0.95);
		padding: 10px var(--spacing-md);
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid rgba(250, 255, 105, 0.2);
		position: relative;
		z-index: 12;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.dot.red {
		background-color: var(--color-error);
		box-shadow: 0 0 6px var(--color-error);
	}
	.dot.yellow {
		background-color: var(--color-warning);
		box-shadow: 0 0 6px var(--color-warning);
	}
	.dot.green {
		background-color: var(--color-success);
		box-shadow: 0 0 6px var(--color-success);
	}

	.console-title {
		font-size: 11px;
		color: rgba(250, 255, 105, 0.6);
		margin-left: 8px;
		letter-spacing: 1px;
		text-transform: uppercase;
		font-weight: 600;
	}

	.console-viewport {
		position: relative;
		overflow: hidden;
	}

	.console-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10;
	}

	.console-body {
		position: relative;
		padding: var(--spacing-md);
		height: 100%;
		overflow-y: auto;
		font-size: 12px;
		color: var(--color-primary);
		line-height: 1.6;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-shadow: 0 0 5px rgba(250, 255, 105, 0.5);
		animation: HUD-breathing 4s ease-in-out infinite;
		z-index: 11;
		background: transparent;
	}

	.console-viewport::before {
		content: ' ';
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
		box-shadow:
			0 0 8px var(--color-primary),
			0 0 15px var(--color-primary);
		animation: laser-sweep 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		pointer-events: none;
		z-index: 13;
	}

	.console-viewport::after {
		content: ' ';
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		bottom: 0;
		right: 0;
		background:
			radial-gradient(circle, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 0.4) 100%),
			linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 0,
			linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 0 0,
			linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 0,
			linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 100% 0,
			linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 100%,
			linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 0 100%,
			linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 100%,
			linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 100% 100%;
		background-size:
			100% 100%,
			8px 8px,
			8px 8px,
			8px 8px,
			8px 8px,
			8px 8px,
			8px 8px,
			8px 8px,
			8px 8px;
		background-repeat: no-repeat;
		pointer-events: none;
		z-index: 14;
		opacity: 0.75;
	}

	@keyframes HUD-breathing {
		0%,
		100% {
			filter: brightness(1) drop-shadow(0 0 0px rgba(250, 255, 105, 0));
		}
		50% {
			filter: brightness(1.08) drop-shadow(0 0 2px rgba(250, 255, 105, 0.25));
		}
	}

	@keyframes laser-sweep {
		0% {
			top: 0%;
			opacity: 0;
		}
		5% {
			opacity: 1;
		}
		95% {
			opacity: 1;
		}
		100% {
			top: 100%;
			opacity: 0;
		}
	}

	.empty-console {
		color: rgba(250, 255, 105, 0.5);
		text-shadow: 0 0 3px rgba(250, 255, 105, 0.2);
	}

	.prompt {
		color: var(--color-primary);
		font-weight: bold;
		text-shadow: 0 0 5px rgba(250, 255, 105, 0.5);
	}
</style>
