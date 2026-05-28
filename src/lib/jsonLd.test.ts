import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from './jsonLd';

describe('serializeJsonLd', () => {
	it('escapes < so a value cannot break out of the script element', () => {
		const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
		expect(out).not.toContain('</script>');
		expect(out).not.toContain('<');
		expect(out).toContain('\\u003c');
	});

	it('round-trips back to the original object', () => {
		const obj = { '@type': 'FAQPage', q: 'a < b & c', items: [1, 2, 3] };
		expect(JSON.parse(serializeJsonLd(obj))).toEqual(obj);
	});

	it('escapes the U+2028 / U+2029 line/paragraph separators', () => {
		const ls = String.fromCharCode(0x2028);
		const ps = String.fromCharCode(0x2029);
		const out = serializeJsonLd({ text: `line${ls}and${ps}more` });
		expect(out).toContain('\\u2028');
		expect(out).toContain('\\u2029');
		expect(out).not.toContain(ls);
		expect(out).not.toContain(ps);
	});
});
