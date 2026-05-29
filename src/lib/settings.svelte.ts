import { STORAGE_KEYS } from './storageKeys';

/**
 * The single source of truth for the CORS proxy preset options. Both the
 * landing page and the crawl-detail page render these as <option>s, and the
 * load() routine uses them to map a stored proxy URL back to a selection.
 */
export const PROXY_PRESETS = [
	{ label: 'CORSProxy.io (Recommended)', value: 'https://corsproxy.io/?url=' },
	{ label: 'AllOrigins (Raw)', value: 'https://api.allorigins.win/raw?url=' },
	{ label: 'Custom Proxy...', value: 'custom' }
] as const;

const DEFAULT_PROXY = 'https://corsproxy.io/?url=';

/**
 * Rune-backed settings store shared across pages. Holds the proxy selection,
 * the custom proxy URL, and the optional PageSpeed API key. The effective
 * proxy URL is derived (not effect-synced): the selected preset value when a
 * preset is chosen, otherwise the custom input value.
 *
 * SSR/prerender safety: the module is initialized with defaults and never
 * touches localStorage at the top level. Only load()/save() access storage,
 * and both are guarded for environments where localStorage is unavailable.
 */
class Settings {
	selectedProxy = $state<string>(DEFAULT_PROXY);
	customProxy = $state<string>('');
	apiKey = $state<string>('');

	/** The proxy URL actually used when starting a crawl. */
	get effectiveProxyUrl(): string {
		return this.selectedProxy === 'custom' ? this.customProxy : this.selectedProxy;
	}

	/** Load persisted settings. Safe to call only in the browser (onMount). */
	load() {
		if (typeof localStorage === 'undefined') return;
		try {
			const savedProxy = localStorage.getItem(STORAGE_KEYS.proxy);
			const savedKey = localStorage.getItem(STORAGE_KEYS.pagespeedKey);

			if (savedProxy) {
				const preset = PROXY_PRESETS.find((p) => p.value !== 'custom' && p.value === savedProxy);
				if (preset) {
					this.selectedProxy = preset.value;
					this.customProxy = '';
				} else {
					this.selectedProxy = 'custom';
					this.customProxy = savedProxy;
				}
			}

			if (savedKey) this.apiKey = savedKey;
		} catch (e) {
			console.error('Failed to load settings:', e);
		}
	}

	/** Persist the effective proxy URL + API key to localStorage. */
	save() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(STORAGE_KEYS.proxy, this.effectiveProxyUrl);
			localStorage.setItem(STORAGE_KEYS.pagespeedKey, this.apiKey);
		} catch (e) {
			console.warn('Failed to save settings:', e);
		}
	}
}

export const settings = new Settings();
