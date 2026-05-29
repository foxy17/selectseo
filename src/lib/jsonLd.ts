/**
 * Serialize an object to a JSON string that is safe to embed inside an inline
 * `<script type="application/ld+json">` element.
 *
 * `JSON.stringify` does NOT escape the `</script>` sequence, so a schema value
 * containing `</script><script>...` would break out of the JSON-LD block and execute.
 * Escaping `<` as its unicode escape is valid JSON, renders identically to a JSON-LD
 * parser, and makes `</script>` impossible. We also escape the JS line/paragraph
 * separators (U+2028 / U+2029), which are valid in JSON but terminate an inline script.
 */
const UNSAFE_JSONLD = new RegExp('[<\\u2028\\u2029]', 'g');

export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(
		UNSAFE_JSONLD,
		(ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
	);
}
