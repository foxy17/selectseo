import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateGrade, fetchPageSpeed } from './seoEngine';

describe('calculateGrade', () => {
	it('returns A for a high score', () => {
		expect(calculateGrade(95)).toBe('A');
	});

	it('returns F at the bottom boundary', () => {
		expect(calculateGrade(0)).toBe('F');
	});

	it('returns A+ at the top boundary (>= 97)', () => {
		expect(calculateGrade(97)).toBe('A+');
	});
});

describe('fetchPageSpeed', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** Build a minimal fetch Response-like stub returning the given JSON body. */
	function stubFetchJson(body: unknown, ok = true, status = 200) {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok,
				status,
				statusText: ok ? 'OK' : 'Error',
				json: async () => body
			})
		);
	}

	it('throws when the response has no lighthouseResult', async () => {
		stubFetchJson({});
		await expect(fetchPageSpeed('https://example.com', 'mobile')).rejects.toThrow(
			'PageSpeed returned no Lighthouse performance data.'
		);
	});

	it('throws when categories.performance is missing', async () => {
		stubFetchJson({ lighthouseResult: { categories: {}, audits: {} } });
		await expect(fetchPageSpeed('https://example.com', 'mobile')).rejects.toThrow(
			'PageSpeed returned no Lighthouse performance data.'
		);
	});

	it('reads the score and classifies opportunity audits via details.type', async () => {
		stubFetchJson({
			lighthouseResult: {
				categories: { performance: { score: 0.92 } },
				audits: {
					// A failing optimization opportunity (should become a recommendation)
					'unused-css-rules': {
						id: 'unused-css-rules',
						title: 'Reduce unused CSS',
						description: 'Remove dead rules.',
						score: 0.3,
						displayValue: 'Potential savings of 100 ms',
						numericValue: 1234,
						details: { type: 'opportunity', overallSavingsMs: 100 }
					},
					// A passing optimization opportunity (should land in passedAudits)
					'modern-image-formats': {
						id: 'modern-image-formats',
						title: 'Serve images in modern formats',
						description: 'Use WebP/AVIF.',
						score: 1,
						details: { type: 'opportunity' }
					},
					// A normal (non-opportunity) audit that must NOT be classified
					'first-contentful-paint': {
						id: 'first-contentful-paint',
						title: 'First Contentful Paint',
						score: 0.5,
						displayValue: '2.1 s',
						details: { type: 'metric' }
					}
				}
			}
		});

		const result = await fetchPageSpeed('https://example.com', 'desktop');

		// score read from categories.performance.score (0.92 -> 92)
		expect(result.score).toBe(92);

		// failing opportunity classified as a recommendation
		expect(result.recommendations).toHaveLength(1);
		expect(result.recommendations[0].title).toBe('Reduce unused CSS');
		expect(result.recommendations[0].impact).toBe(100);

		// passing opportunity classified as passed; non-opportunity audit excluded
		expect(result.passedAudits).toEqual(['Serve images in modern formats']);
	});
});
