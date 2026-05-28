import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	calculateGrade,
	fetchPageSpeed,
	recalculateOverallScore,
	summarizeAudit
} from './seoEngine';
import type { AuditResults, LinkItem, PageSpeedMetric } from './seoEngine';

/** Build a minimal LinkItem with an overridable status state. */
function link(id: number, statusState: LinkItem['statusState']): LinkItem {
	return {
		id,
		href: `https://example.com/${id}`,
		text: `link ${id}`,
		isExternal: false,
		isSecure: true,
		status: statusState === 'ok' ? 200 : statusState === 'broken' ? 404 : null,
		statusText: null,
		statusState,
		rel: '',
		responseTime: null,
		redirectDestination: null
	};
}

/**
 * Minimal AuditResults fixture. Defaults to an all-"ok" page; callers override
 * just the fields under test.
 */
function makeAudit(overrides: Partial<AuditResults> = {}): AuditResults {
	const ok = (extra: Record<string, unknown> = {}) => ({ status: 'ok' as const, message: '', ...extra });
	return {
		url: 'https://example.com',
		timestamp: '2026-01-01T00:00:00.000Z',
		onPage: {
			title: { text: '', length: 0, status: 'ok', message: '' },
			description: { text: '', length: 0, status: 'ok', message: '' },
			headings: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], status: 'ok', message: '' },
			canonical: { url: '', status: 'ok', message: '' },
			imageAlts: { total: 0, missing: 0, details: [], status: 'ok', message: '' },
			openGraph: { title: '', description: '', image: '', type: '', status: 'ok', message: '' },
			twitterCard: { card: '', title: '', description: '', image: '', status: 'ok', message: '' },
			contentMetrics: { wordCount: 0, contentRatio: 0, readingLevel: 'N/A', language: 'en' },
			viewport: '',
			charset: '',
			favicon: '',
			hreflangs: [],
			robots: '',
			schemaTypes: [],
			schemas: [],
			htmlSize: 0,
			viewportAudit: ok(),
			languageAudit: ok(),
			robotsMetaAudit: ok(),
			faviconAudit: ok()
		},
		links: [],
		pageSpeedMobile: null,
		pageSpeedDesktop: null,
		aiDiscoverability: {
			score: 100,
			grade: 'A+',
			qaFormatting: ok(),
			scannability: ok(),
			semanticHtml: ok(),
			targetSchema: ok(),
			robotsTxtAi: ok()
		},
		score: 100,
		grade: 'A+',
		...overrides
	};
}

const speed = (score: number): PageSpeedMetric => ({
	score,
	lcp: '',
	tbt: '',
	cls: '',
	fcp: '',
	speedIndex: '',
	recommendations: []
});

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

describe('summarizeAudit', () => {
	it('counts all passes for an all-ok page (incl. ok links)', () => {
		const audit = makeAudit({ links: [link(1, 'ok'), link(2, 'ok')] });
		expect(summarizeAudit(audit)).toEqual({
			errorCount: 0,
			warningCount: 0,
			// title, description, headings, imageAlts, canonical, openGraph (6) + 2 ok links
			passedCount: 8
		});
	});

	it('counts errors, warnings and passes across the audited fields', () => {
		const audit = makeAudit({
			onPage: {
				...makeAudit().onPage,
				title: { text: '', length: 0, status: 'missing', message: '' }, // error
				description: { text: '', length: 0, status: 'warning', message: '' }, // warning
				headings: {
					h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
					status: 'error', // error
					message: ''
				},
				canonical: { url: '', status: 'missing', message: '' }, // warning
				openGraph: { title: '', description: '', image: '', type: '', status: 'ok', message: '' } // pass
				// imageAlts stays 'ok' (pass)
			},
			links: [link(1, 'broken'), link(2, 'ok'), link(3, 'pending')]
		});

		expect(summarizeAudit(audit)).toEqual({
			// title missing + headings error + 1 broken link
			errorCount: 3,
			// description warning + canonical missing
			warningCount: 2,
			// imageAlts ok + openGraph ok + 1 ok link
			passedCount: 3
		});
	});
});

describe('recalculateOverallScore', () => {
	it('returns the base score unchanged with no broken links and no pagespeed', () => {
		const audit = makeAudit({ score: 88, links: [link(1, 'ok')] });
		expect(recalculateOverallScore(audit)).toBe(88);
	});

	it('subtracts a broken-link penalty capped at 15', () => {
		// 10 broken links -> 10 * 2 = 20, capped at 15 -> 100 - 15 = 85
		const audit = makeAudit({
			score: 100,
			links: Array.from({ length: 10 }, (_, i) => link(i, 'broken'))
		});
		expect(recalculateOverallScore(audit)).toBe(85);
	});

	it('blends 60% base score with 40% average pagespeed and clamps', () => {
		// base 90, one broken link (-2) -> 88; avg perf = (80 + 60) / 2 = 70
		// round(88 * 0.6 + 70 * 0.4) = round(52.8 + 28) = round(80.8) = 81
		const audit = makeAudit({
			score: 90,
			links: [link(1, 'broken')],
			pageSpeedDesktop: speed(80),
			pageSpeedMobile: speed(60)
		});
		expect(recalculateOverallScore(audit)).toBe(81);
	});

	it('does not mutate the input audit', () => {
		const audit = makeAudit({ score: 90, links: [link(1, 'broken')] });
		recalculateOverallScore(audit);
		expect(audit.score).toBe(90);
	});
});
