<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';
  import InfoPageLayout from '$lib/components/InfoPageLayout.svelte';

  // Single source of truth for the FAQ Q&A. Both the visible cards and the
  // FAQPage JSON-LD are built from this array, so the structured-data answers
  // always match the text users actually read. Answers may contain inline HTML
  // (e.g. <code>/<strong>); the schema uses a tag-stripped plain-text version.
  const faqs: { q: string; a: string }[] = [
    {
      q: "Why does it require a CORS proxy?",
      a: "Web browsers enforce CORS (Cross-Origin Resource Sharing) safety policies, which prevent websites from requesting files from other domains directly. A CORS proxy forwards the request, allowing our client-side engine to scrape page HTML and validate outgoing links."
    },
    {
      q: "How does the Client SQL Console work?",
      a: "Once a target site is audited, all data (headings, images, links, and PageSpeed metrics) is parsed and inserted into a virtual relational database schema inside the browser. You can execute SQL queries to filter or extract exactly the information you need."
    },
    {
      q: "Is my scanned data private and secure?",
      a: "Yes. SelectSEO has no backend server or database storage. Your scanned URLs, API credentials, and query outputs are kept local to your browser sandbox and are never shared or logged."
    },
    {
      q: "What SQL database schema is exposed?",
      a: "We compile data into multiple virtual tables: <code>metadata</code> (name, value), <code>headings</code> (level, text), <code>images</code> (src, alt, status), and <code>links</code> (url, anchor_text, type, status_code)."
    },
    {
      q: "How does the built-in Chrome AI Copilot work?",
      a: "It leverages Google Chrome's native Prompt API to run a local instance of <strong>Gemini Nano</strong> directly on your GPU/CPU. When you scan a site, your SEO audit metrics are loaded into the model session. All optimizations, keyword plans, and readability audits are processed locally with 100% privacy and zero monthly credit limits."
    }
  ];

  const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

  const faqSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Frequently Asked Questions - SelectSEO Auditor",
      "url": "https://selectseo.in/faq/",
      "description": "Answers to common questions about SelectSEO's serverless client-side auditing engine.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://selectseo.in/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "FAQ",
            "item": "https://selectseo.in/faq/"
          }
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map((faq) => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": stripTags(faq.a)
        }
      }))
    }
  ];
</script>

<SEO
  title="Frequently Asked Questions - SelectSEO Auditor"
  description="Answers to common questions about SelectSEO's serverless client-side auditing engine."
  path="/faq/"
  schema={faqSchema}
/>

<InfoPageLayout
  title="Frequently Asked Questions"
  subtitle="Answers to common questions about SelectSEO's serverless auditing engine."
>
  <div class="faq-grid">
    {#each faqs as faq (faq.q)}
      <div class="faq-card card-dark">
        <h4>{faq.q}</h4>
        <p>{@html faq.a}</p>
      </div>
    {/each}
  </div>
</InfoPageLayout>

<style>
  /* Grid layout for FAQ */
  .faq-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-lg);
  }

  .faq-card {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    border-radius: var(--rounded-md);
  }

  .faq-card h4 {
    font-size: 17px;
    font-weight: 600;
    color: var(--color-ink);
  }

  .faq-card p {
    font-size: 14px;
    line-height: 1.65;
    color: var(--color-body);
  }

  @media (max-width: 768px) {
    .faq-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
