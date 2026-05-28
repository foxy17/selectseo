<script lang="ts">
	import { settings, PROXY_PRESETS } from '$lib/settings.svelte';

	interface Props {
		title: string;
		intro?: string;
		saveLabel: string;
		onsave?: () => void;
	}

	let { title, intro, saveLabel, onsave }: Props = $props();

	function handleSave() {
		settings.save();
		onsave?.();
	}
</script>

<div class="settings-drawer card-dark">
	<h3 class="title-sm">{title}</h3>
	{#if intro}
		<p class="text-muted text-xs mb-3">{intro}</p>
	{/if}
	<div class="settings-grid">
		<div class="field proxy-field-group">
			<div class="proxy-select-wrap">
				<label for="proxy-select">CORS Proxy Choice</label>
				<select
					id="proxy-select"
					class="text-input select-input"
					bind:value={settings.selectedProxy}
				>
					{#each PROXY_PRESETS as preset}
						<option value={preset.value}>{preset.label}</option>
					{/each}
				</select>
			</div>
			{#if settings.selectedProxy === 'custom'}
				<div class="proxy-input-wrap animate-fade-in mt-1">
					<label for="proxy-input">Custom Proxy URL</label>
					<input
						id="proxy-input"
						type="text"
						class="text-input"
						bind:value={settings.customProxy}
						placeholder="e.g. https://myproxy.com/?url="
					/>
				</div>
			{/if}
		</div>
		<div class="field">
			<label for="pagespeed-input">PageSpeed API Key (Optional)</label>
			<input
				id="pagespeed-input"
				type="password"
				class="text-input"
				bind:value={settings.apiKey}
				placeholder="Google Cloud API Key"
			/>
		</div>
		<button class="btn btn-secondary save-btn font-mono" onclick={handleSave}>{saveLabel}</button>
	</div>
</div>

<style>
	.settings-drawer {
		padding: var(--spacing-md);
	}

	.settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: var(--spacing-md);
		align-items: flex-end;
		margin-top: var(--spacing-xs);
	}

	.settings-grid label {
		font-size: 12px;
		color: var(--color-muted);
		font-weight: 600;
		text-transform: uppercase;
		margin-bottom: var(--spacing-xxs);
		display: block;
	}

	.text-input {
		background-color: var(--color-surface-soft);
		border: 1px solid var(--color-hairline);
		border-radius: var(--rounded-sm);
		color: var(--color-on-dark);
		padding: 8px 12px;
		outline: none;
		width: 100%;
		font-size: 14px;
	}

	.text-input:focus {
		border-color: var(--color-primary);
	}

	.save-btn {
		height: 38px;
	}

	@media (max-width: 768px) {
		.settings-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
