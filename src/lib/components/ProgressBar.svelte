<script lang="ts">
	import { scoreBand } from '$lib/scoreUtils';

	let {
		value,
		color,
		band,
		height = '6px',
		track = 'var(--color-surface-soft)',
		border = false,
		transition = '0.3s',
		class: className = ''
	}: {
		/** Fill percentage (0–100). Clamped internally. */
		value: number;
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
		class:fill-success={bandClass === 'success'}
		class:fill-warning={bandClass === 'warning'}
		class:fill-error={bandClass === 'error'}
		class:fill-primary={bandClass === 'primary'}
		style:width={pct + '%'}
		style:background-color={inlineColor}
		style:transition="width {transition} ease"
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
