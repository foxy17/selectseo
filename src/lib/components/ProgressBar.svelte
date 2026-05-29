<script lang="ts">
	import { scoreBand } from '$lib/scoreUtils';

	let {
		value = 0,
		color,
		band,
		height = '6px',
		track = 'var(--color-surface-soft)',
		border = false,
		indeterminate = false,
		transition = '0.3s',
		class: className = ''
	}: {
		/** Fill percentage (0–100). Clamped internally. Ignored when `indeterminate`. */
		value?: number;
		/**
		 * Explicit fill color. A band keyword (`success`/`warning`/`error`/`primary`)
		 * resolves to the matching token; any other value (e.g. `var(--color-success)`)
		 * is applied as a raw CSS color.
		 */
		color?: 'success' | 'warning' | 'error' | 'primary' | (string & {});
		/** When `color` is omitted, derive the band via `scoreBand(band)`. */
		band?: number;
		/** Track + fill height. */
		height?: string;
		/** Track background color. */
		track?: string;
		/** Add a hairline border around the track. */
		border?: boolean;
		/**
		 * Show an animated indeterminate bar (a segment sliding across the track)
		 * instead of a determinate fill. Use when total progress is unknown.
		 */
		indeterminate?: boolean;
		/** Fill width transition duration. */
		transition?: string;
		class?: string;
	} = $props();

	const pct = $derived(Math.max(0, Math.min(100, value)));

	const KNOWN_BANDS = ['success', 'warning', 'error', 'primary'];

	// Resolve the effective color: explicit `color` wins, else derive from `band`.
	const resolved = $derived(color ?? (band !== undefined ? scoreBand(band) : undefined));

	// A known band keyword is applied as a class; anything else as an inline color.
	const bandClass = $derived(resolved && KNOWN_BANDS.includes(resolved) ? resolved : undefined);
	const inlineColor = $derived(resolved && !KNOWN_BANDS.includes(resolved) ? resolved : undefined);
</script>

<div
	class="pb-track {className}"
	class:pb-bordered={border}
	style:height
	style:background-color={track}
>
	<div
		class="pb-fill"
		class:pb-indeterminate={indeterminate}
		class:fill-success={bandClass === 'success'}
		class:fill-warning={bandClass === 'warning'}
		class:fill-error={bandClass === 'error'}
		class:fill-primary={bandClass === 'primary'}
		style:width={indeterminate ? null : pct + '%'}
		style:background-color={inlineColor}
		style:transition={indeterminate ? null : `width ${transition} ease`}
	></div>
</div>

<style>
	.pb-track {
		border-radius: var(--rounded-pill);
		overflow: hidden;
	}

	.pb-bordered {
		border: 1px solid var(--color-hairline);
	}

	.pb-fill {
		height: 100%;
		border-radius: var(--rounded-pill);
	}

	/* Indeterminate: a fixed-width segment sliding across the track. */
	.pb-indeterminate {
		width: 40%;
		animation: pb-indeterminate-slide 1.1s ease-in-out infinite;
	}

	@keyframes pb-indeterminate-slide {
		0% {
			transform: translateX(-110%);
		}
		100% {
			transform: translateX(280%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pb-indeterminate {
			animation-duration: 2.2s;
		}
	}

	.fill-success {
		background-color: var(--color-success);
	}
	.fill-warning {
		background-color: var(--color-warning);
	}
	.fill-error {
		background-color: var(--color-error);
	}
	.fill-primary {
		background-color: var(--color-primary);
	}
</style>
