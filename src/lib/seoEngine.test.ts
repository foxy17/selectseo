import { describe, expect, it } from 'vitest';
import { calculateGrade } from './seoEngine';

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
