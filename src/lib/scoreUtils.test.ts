import { describe, expect, it } from 'vitest';
import { scoreBand, lighthouseBand, scoreTextClass, lighthouseHex } from './scoreUtils';

describe('scoreBand (general 90/70 scheme)', () => {
	it('returns success at the 90 boundary', () => {
		expect(scoreBand(90)).toBe('success');
		expect(scoreBand(100)).toBe('success');
	});

	it('returns warning between 70 and 89', () => {
		expect(scoreBand(89)).toBe('warning');
		expect(scoreBand(70)).toBe('warning');
	});

	it('returns error below 70', () => {
		expect(scoreBand(69)).toBe('error');
		expect(scoreBand(0)).toBe('error');
	});
});

describe('lighthouseBand (Lighthouse 90/50 scheme)', () => {
	it('returns success at the 90 boundary', () => {
		expect(lighthouseBand(90)).toBe('success');
	});

	it('returns warning at the 50 boundary', () => {
		expect(lighthouseBand(50)).toBe('warning');
		expect(lighthouseBand(89)).toBe('warning');
	});

	it('returns error below 50', () => {
		expect(lighthouseBand(49)).toBe('error');
		expect(lighthouseBand(0)).toBe('error');
	});
});

describe('scoreTextClass', () => {
	it('prefixes the general band with text-', () => {
		expect(scoreTextClass(95)).toBe('text-success');
		expect(scoreTextClass(75)).toBe('text-warning');
		expect(scoreTextClass(40)).toBe('text-error');
	});
});

describe('lighthouseHex', () => {
	it('returns the preserved CSS color values keyed off the Lighthouse band', () => {
		expect(lighthouseHex(95)).toBe('var(--color-success)');
		expect(lighthouseHex(70)).toBe('var(--color-warning)');
		expect(lighthouseHex(30)).toBe('var(--color-error)');
	});
});
