import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, toCsv } from './exportUtils';

describe('toCsv', () => {
	it('serialises a plain row with no special characters unquoted', () => {
		expect(toCsv([['a', 'b', 'c']])).toBe('a,b,c');
	});

	it('joins multiple rows with newlines', () => {
		expect(toCsv([['h1', 'h2'], ['v1', 'v2']])).toBe('h1,h2\nv1,v2');
	});

	it('quotes fields that contain a comma', () => {
		expect(toCsv([['a,b', 'c']])).toBe('"a,b",c');
	});

	it('quotes fields with an embedded double quote and doubles the quote', () => {
		expect(toCsv([['say "hi"', 'ok']])).toBe('"say ""hi""",ok');
	});

	it('quotes fields that contain a newline', () => {
		expect(toCsv([['line1\nline2']])).toBe('"line1\nline2"');
	});

	it('quotes fields that contain a carriage return', () => {
		expect(toCsv([['line1\r\nline2']])).toBe('"line1\r\nline2"');
	});

	it('renders null and undefined as empty strings', () => {
		expect(toCsv([[null, undefined, 'x']])).toBe(',,x');
	});

	it('renders numbers without quoting', () => {
		expect(toCsv([[1, 2, 0]])).toBe('1,2,0');
	});
});

describe('copyToClipboard', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true and writes the text when the clipboard resolves', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await expect(copyToClipboard('hello')).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('hello');
	});

	it('returns false when the clipboard write rejects', async () => {
		const writeText = vi.fn().mockRejectedValue(new Error('denied'));
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await expect(copyToClipboard('hello')).resolves.toBe(false);
	});

	it('returns false when the clipboard API is unavailable', async () => {
		vi.stubGlobal('navigator', {});

		await expect(copyToClipboard('hello')).resolves.toBe(false);
	});
});
