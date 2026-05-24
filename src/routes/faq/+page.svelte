<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';

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
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Why does it require a CORS proxy?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Web browsers enforce CORS (Cross-Origin Resource Sharing) safety policies, which prevent websites from requesting files from other domains directly. A CORS proxy forwards the request, allowing our client-side engine to scrape page HTML and validate outgoing links."
          }
        },
        {
          "@type": "Question",
          "name": "How does the Client SQL Console work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Once a target site is audited, all data (headings, images, links, and PageSpeed metrics) is parsed and inserted into a virtual relational database schema inside the browser. You can execute SQL queries to filter or extract exactly the information you need."
          }
        },
        {
          "@type": "Question",
          "name": "Is my scanned data private and secure?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. SelectSEO has no backend server or database storage. Your scanned URLs, API credentials, and query outputs are kept local to your browser sandbox and are never shared or logged."
          }
        },
        {
          "@type": "Question",
          "name": "What SQL database schema is exposed?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "We compile data into multiple virtual tables: metadata (name, value), headings (level, text), images (src, alt, status), and links (url, anchor_text, type, status_code)."
          }
        },
        {
          "@type": "Question",
          "name": "How does the built-in Chrome AI Copilot work?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "It leverages Google Chrome's native Prompt API to run Gemini Nano directly on your hardware. Since all optimizations, keyword ideas, and readability suggestions are generated in-browser, no audit details leave your machine, ensuring 100% privacy and zero API costs."
          }
        }
      ]
    }
  ];
</script>

<SEO 
  title="Frequently Asked Questions - SelectSEO Auditor" 
  description="Answers to common questions about SelectSEO's serverless client-side auditing engine." 
  path="/faq/" 
  schema={faqSchema} 
/>

<div class="info-page container">
  <!-- FAQ Section -->
  <section id="faq" class="info-section">
    <h1 class="section-title"><span class="highlight-text">Frequently</span> Asked Questions</h1>
    <p class="section-subtitle">Answers to common questions about SelectSEO's serverless auditing engine.</p>
    
    <div class="faq-grid">
      <div class="faq-card card-dark">
        <h4>Why does it require a CORS proxy?</h4>
        <p>Web browsers enforce CORS (Cross-Origin Resource Sharing) safety policies, which prevent websites from requesting files from other domains directly. A CORS proxy forwards the request, allowing our client-side engine to scrape page HTML and validate outgoing links.</p>
      </div>
      <div class="faq-card card-dark">
        <h4>How does the Client SQL Console work?</h4>
        <p>Once a target site is audited, all data (headings, images, links, and PageSpeed metrics) is parsed and inserted into a virtual relational database schema inside the browser. You can execute SQL queries to filter or extract exactly the information you need.</p>
      </div>
      <div class="faq-card card-dark">
        <h4>Is my scanned data private and secure?</h4>
        <p>Yes. SelectSEO has no backend server or database storage. Your scanned URLs, API credentials, and query outputs are kept local to your browser sandbox and are never shared or logged.</p>
      </div>
      <div class="faq-card card-dark">
        <h4>What SQL database schema is exposed?</h4>
        <p>We compile data into multiple virtual tables: <code>metadata</code> (name, value), <code>headings</code> (level, text), <code>images</code> (src, alt, status), and <code>links</code> (url, anchor_text, type, status_code).</p>
      </div>
      <div class="faq-card card-dark">
        <h4>How does the built-in Chrome AI Copilot work?</h4>
        <p>It leverages Google Chrome's native Prompt API to run a local instance of <strong>Gemini Nano</strong> directly on your GPU/CPU. When you scan a site, your SEO audit metrics are loaded into the model session. All optimizations, keyword plans, and readability audits are processed locally with 100% privacy and zero monthly credit limits.</p>
      </div>
    </div>
  </section>
</div>

<style>
  .info-page {
    padding: 64px var(--spacing-lg);
  }

  .info-section {
    padding: var(--spacing-xl) 0;
  }

  .section-title {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: var(--spacing-xs);
    letter-spacing: -0.5px;
  }

  .section-subtitle {
    color: var(--color-muted);
    font-size: 16px;
    margin-bottom: var(--spacing-xl);
    max-width: 720px;
    line-height: 1.6;
  }

  .highlight-text {
    color: var(--color-primary);
  }

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
