import { describe, expect, it } from 'vitest';
import { cacheKeyFor } from './sqlEngine';
import type { AuditResults, LinkItem } from './seoEngine';

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

/** Minimal AuditResults fixture; only the fields cacheKeyFor reads matter. */
function makeAudit(overrides: Partial<AuditResults> = {}): AuditResults {
	return {
		url: 'https://example.com',
		timestamp: '2026-01-01T00:00:00.000Z',
		// cacheKeyFor only touches url, timestamp and links; the rest is unused here.
		onPage: {} as AuditResults['onPage'],
		links: [],
		pageSpeedMobile: null,
		pageSpeedDesktop: null,
		aiDiscoverability: {} as AuditResults['aiDiscoverability'],
		score: 100,
		grade: 'A+',
		...overrides
	};
}

describe('cacheKeyFor', () => {
	it('is stable across calls for the same unchanged audit', () => {
		const audit = makeAudit({ links: [link(1, 'pending'), link(2, 'pending')] });
		expect(cacheKeyFor(audit)).toBe(cacheKeyFor(audit));
	});

	it('differs for audits of different URLs', () => {
		const a = makeAudit({ url: 'https://a.example' });
		const b = makeAudit({ url: 'https://b.example' });
		expect(cacheKeyFor(a)).not.toBe(cacheKeyFor(b));
	});

	it('differs for the same URL crawled at different timestamps (re-clone)', () => {
		const a = makeAudit({ timestamp: '2026-01-01T00:00:00.000Z' });
		const b = makeAudit({ timestamp: '2026-01-02T00:00:00.000Z' });
		expect(cacheKeyFor(a)).not.toBe(cacheKeyFor(b));
	});

	it('changes when pending links become validated (in-place mutation)', () => {
		const links = [link(1, 'pending'), link(2, 'pending')];
		const audit = makeAudit({ links });
		const before = cacheKeyFor(audit);

		// Simulate validateLinks() resolving statuses on the same array.
		links[0].statusState = 'ok';
		links[1].statusState = 'broken';
		const after = cacheKeyFor(audit);

		expect(after).not.toBe(before);
	});

	it('does not change when nothing relevant changes', () => {
		const links = [link(1, 'ok'), link(2, 'broken')];
		const audit = makeAudit({ links });
		const first = cacheKeyFor(audit);
		// Re-read without mutating link count or validation state.
		expect(cacheKeyFor(audit)).toBe(first);
	});
});
