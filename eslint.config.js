import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

import svelteConfig from './svelte.config.js';

export default ts.config(
	// Things we never want to lint.
	{
		ignores: [
			'node_modules/',
			'.svelte-kit/',
			'build/',
			'static/',
			'docs/',
			'package-lock.json',
			// The Cloudflare Worker runs on a separate runtime; lint it on its own terms elsewhere.
			'cloudflare-worker/',
			// svelte-eslint-parser cannot tokenize the literal `<script>` string used to inject
			// JSON-LD via {@html} (a parser limitation, not a code defect). svelte-check covers it.
			'src/lib/components/SEO.svelte'
		]
	},

	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	// eslint-config-prettier turns off stylistic rules that conflict with Prettier formatting.
	prettier,
	...svelte.configs.prettier,

	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			// The codebase intentionally uses `any` in a handful of places (Chrome AI APIs,
			// sql.js dynamic rows, jsPDF internals). Treat as a hint, not a hard failure.
			'@typescript-eslint/no-explicit-any': 'warn',
			// Unused vars/imports are surfaced as warnings rather than errors: clearing them
			// would mean deleting code across many files and shifting line numbers that other
			// in-flight cleanup tasks depend on. svelte-check also reports these.
			'@typescript-eslint/no-unused-vars': 'warn'
		}
	},

	{
		// TypeScript already enforces type-aware undefined checks; ESLint's no-undef
		// produces false positives for ambient/DOM globals, so disable it for TS/Svelte.
		files: ['**/*.{ts,svelte}'],
		rules: {
			'no-undef': 'off'
		}
	},

	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				// Parse <script lang="ts"> blocks with the TypeScript parser.
				parser: ts.parser,
				svelteConfig
			}
		},
		rules: {
			// Bare reactive reads inside `$effect` (e.g. `scanLogs;` to register a dependency)
			// are a legitimate Svelte 5 runes pattern, so this rule false-positives here.
			'@typescript-eslint/no-unused-expressions': 'off',
			// Keyed {#each} is a perf/correctness hint, not a bug for these static lists.
			// Adding keys would touch markup across several components.
			'svelte/require-each-key': 'warn',
			// This project deliberately uses plain hrefs and goto() with string paths rather
			// than SvelteKit's resolve() helper; the rule is purely stylistic for our usage.
			'svelte/no-navigation-without-resolve': 'off',
			// {@html} is used intentionally for JSON-LD injection and sanitized (DOMPurify)
			// markdown rendering; downgrade the blanket XSS warning to a non-blocking hint.
			'svelte/no-at-html-tags': 'warn'
		}
	}
);
