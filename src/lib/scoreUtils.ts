/**
 * Centralized score-band coloring for the audit UI.
 *
 * There are intentionally TWO band schemes here — this is NOT drift:
 *  - `scoreBand` is the GENERAL app scheme (>=90 success / >=70 warning / else error),
 *    used by category grades, issue cards, etc.
 *  - `lighthouseBand` mirrors Google Lighthouse's own thresholds
 *    (>=90 green / >=50 orange / else red). PageSpeed gauges use this so our
 *    coloring matches what users see in PageSpeed Insights. Keeping it separate
 *    is deliberate: forcing PageSpeed onto the general 70 cutoff would diverge
 *    from Google.
 */

export type ScoreBand = 'success' | 'warning' | 'error';

/** General app scheme: >=90 success / >=70 warning / else error. */
export function scoreBand(score: number): ScoreBand {
	if (score >= 90) return 'success';
	if (score >= 70) return 'warning';
	return 'error';
}

/** Lighthouse parity scheme: >=90 success / >=50 warning / else error. */
export function lighthouseBand(score: number): ScoreBand {
	if (score >= 90) return 'success';
	if (score >= 50) return 'warning';
	return 'error';
}

/** Utility text-color class for the general scheme (text-success|text-warning|text-error). */
export function scoreTextClass(score: number): string {
	return 'text-' + scoreBand(score);
}

/** CSS color value for a PageSpeed gauge, keyed off the Lighthouse band. */
export function lighthouseHex(score: number): string {
	const band = lighthouseBand(score);
	if (band === 'success') return 'var(--color-success)';
	if (band === 'warning') return 'var(--color-warning)';
	return 'var(--color-error)';
}
