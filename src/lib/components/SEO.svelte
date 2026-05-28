<script lang="ts">
	import { serializeJsonLd } from '$lib/jsonLd';

	interface Props {
		title?: string;
		description?: string;
		path?: string; // e.g., "/" or "/faq/"
		ogImage?: string;
		schema?: Record<string, any> | Record<string, any>[];
	}

	let {
		title = 'SelectSEO Auditor - Developer SEO & Auditing Dashboard',
		description = 'High-performance, developer-first SEO scanner and analysis panel running entirely in your browser.',
		path = '',
		ogImage = '/meta-image.png',
		schema
	}: Props = $props();

	const domain = 'https://selectseo.in';

	// Ensure path starts with / and ends with / unless it's empty
	let formattedPath = $derived.by(() => {
		let p = path;
		if (p && !p.startsWith('/')) {
			p = '/' + p;
		}
		if (p && !p.endsWith('/')) {
			p = p + '/';
		}
		if (p === '/') {
			p = '';
		}
		return p;
	});

	const canonicalUrl = $derived(`${domain}${formattedPath}`);
	const fullOgImage = $derived(ogImage.startsWith('http') ? ogImage : `${domain}${ogImage}`);
</script>

<svelte:head>
	<!-- Standard Meta Tags -->
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonicalUrl} />

	<!-- OpenGraph -->
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={fullOgImage} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="SelectSEO Auditor" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={fullOgImage} />

	<!-- JSON-LD Structured Data -->
	{#if schema}
		{#if Array.isArray(schema)}
			{#each schema as s}
				{@html `<script type="application/ld+json">${serializeJsonLd(s)}</script>`}
			{/each}
		{:else}
			{@html `<script type="application/ld+json">${serializeJsonLd(schema)}</script>`}
		{/if}
	{/if}
</svelte:head>
