/**
 * Shared helpers for Chrome's built-in on-device Prompt API (Gemini Nano),
 * exposed via `window.ai.languageModel` / `window.LanguageModel`.
 *
 * Both the in-app AI Chat tab and the How-To-Use guide drive the same model
 * download flow, so the API lookup, availability query, and `downloadprogress`
 * parsing live here rather than being duplicated per component.
 */

/** Availability states reported by the Prompt API, plus our own `unknown`/`downloading`/`unsupported`. */
export type AiStatus =
	| 'unknown'
	| 'available'
	| 'downloadable'
	| 'downloading'
	| 'unavailable'
	| 'unsupported';

/** The Prompt API namespace, or `null` when the API is absent (non-Chrome / flag off / SSR). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLanguageModel(): any | null {
	if (typeof window === 'undefined') return null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const win = window as any;
	return (win.ai && win.ai.languageModel) || win.LanguageModel || null;
}

/**
 * Convert a `downloadprogress` event into a 0–100 percentage. Per the Prompt API
 * spec `e.loaded` is already a 0–1 fraction (no `total`); older builds report
 * bytes with a `total`, so we handle both.
 */
export function downloadProgressPercent(ev: ProgressEvent): number {
	const frac = ev.total ? ev.loaded / ev.total : ev.loaded;
	return Math.min(100, Math.max(0, Math.round((frac || 0) * 100)));
}

/** Query model availability, normalising any failure to `unsupported`. */
export async function getAiAvailability(): Promise<AiStatus> {
	const lm = getLanguageModel();
	if (!lm) return 'unsupported';
	try {
		return await lm.availability();
	} catch (e) {
		console.error('Failed to get Chrome AI availability:', e);
		return 'unsupported';
	}
}

/**
 * Kick off (or attach to) the on-device model download, reporting progress as a
 * 0–100 percentage via `onProgress`. Resolves once `create()` settles. Throws if
 * the API is missing or `create()` rejects — callers handle their own status.
 */
export async function downloadModel(onProgress: (percent: number) => void): Promise<void> {
	const lm = getLanguageModel();
	if (!lm) throw new Error('Prompt API unavailable');
	await lm.create({
		monitor(m: EventTarget) {
			m.addEventListener('downloadprogress', (ev: Event) => {
				onProgress(downloadProgressPercent(ev as ProgressEvent));
			});
		}
	});
}
