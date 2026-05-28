<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';
  import InfoPageLayout from '$lib/components/InfoPageLayout.svelte';

  const whatSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "What This Does - SelectSEO Auditor",
    "url": "https://selectseo.in/what-this-does/",
    "description": "Discover the local-first, developer-focused features of SelectSEO Auditor, including client-side crawling, SQL console, and PageSpeed integration.",
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
          "name": "What This Does",
          "item": "https://selectseo.in/what-this-does/"
        }
      ]
    }
  };
</script>

<SEO
  title="What This Does - SelectSEO Auditor"
  description="Discover the local-first, developer-focused features of SelectSEO Auditor."
  path="/what-this-does/"
  schema={whatSchema}
/>

<InfoPageLayout
  title="What This Does"
  subtitle="SelectSEO Auditor is a local-first, developer-focused SEO analysis suite built for performance, privacy, and precision."
>
  <div class="info-grid">
    <div class="info-card card-dark">
      <div class="card-icon">⚡</div>
      <h3>Client-Side Crawling</h3>
      <p>Scrapes and parses page HTML tags, titles, headings, and images directly in your browser using a CORS proxy. Your crawled raw HTML never touches our servers.</p>
    </div>
    <div class="info-card card-dark">
      <div class="card-icon">📁</div>
      <h3>SQL-Based Auditing</h3>
      <p>Compiles all crawled link maps, image lists, and HTML structural hierarchies into an in-memory SQL database, enabling powerful SQLite queries.</p>
    </div>
    <div class="info-card card-dark">
      <div class="card-icon">✨</div>
      <h3>On-Device AI Copilot</h3>
      <p>Uses Google Chrome's native Prompt API to run Gemini Nano locally in your browser. Optimize page titles, plan keywords, and audit readability with zero API keys and absolute data privacy.</p>
    </div>
    <div class="info-card card-dark">
      <div class="card-icon">📊</div>
      <h3>PageSpeed Core Vitals</h3>
      <p>Connects directly to Google's PageSpeed Insights API to pull real-time lighthouse scores for performance, accessibility, SEO, and best practices.</p>
    </div>
    <div class="info-card card-dark">
      <div class="card-icon">🔒</div>
      <h3>Privacy-First Design</h3>
      <p>Serverless architecture ensures zero tracking or data retention. All scanned results, database tables, and API keys remain inside your local browser storage.</p>
    </div>
    <div class="info-card card-dark">
      <div class="card-icon">🌐</div>
      <h3>Open Source &amp; Extensible</h3>
      <p>Built entirely with open source web standards (Svelte, SQLite WASM, and adapters). Completely free to self-host, customize, or modify under the MIT license.</p>
    </div>
  </div>

  <!-- Comparison Section -->
  <section class="comparison-section mt-5">
    <h2 class="section-title"><span class="highlight-text">SelectSEO</span> vs Legacy Platforms</h2>
    <p class="section-subtitle">How SelectSEO Auditor compares to legacy cloud-hosted SEO intelligence suites like Ahrefs, SEMrush, or Moz.</p>

    <div class="table-container card-dark">
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Feature / Capability</th>
            <th class="col-highlight">SelectSEO Auditor</th>
            <th>Traditional Platforms (Ahrefs / SEMrush)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">On-Device Local AI</td>
            <td class="text-success col-highlight">✅ Native Gemini Nano (Zero API cost, fully private)</td>
            <td class="text-muted">❌ Cloud API tokens / expensive monthly credit limits</td>
          </tr>
          <tr>
            <td class="font-bold">Data Privacy</td>
            <td class="text-success col-highlight">✅ 100% Local (Crawl tables &amp; history stay in browser)</td>
            <td class="text-muted">❌ Gated Cloud servers (Data scraped &amp; stored on external servers)</td>
          </tr>
          <tr>
            <td class="font-bold">SQL Console Playground</td>
            <td class="text-success col-highlight">✅ Native SQLite WASM Console (Full custom queries)</td>
            <td class="text-muted">❌ Fixed tables and standard filters only</td>
          </tr>
          <tr>
            <td class="font-bold">Licensing &amp; Cost</td>
            <td class="text-success col-highlight">✅ 100% Open Source &amp; Free (MIT License)</td>
            <td class="text-muted">❌ Gated proprietary subscription model ($100+/mo)</td>
          </tr>
          <tr>
            <td class="font-bold">Core Web Vitals Integration</td>
            <td class="text-success col-highlight">✅ Free direct Google PageSpeed API calls</td>
            <td class="text-muted">❌ Gated behind complex limits or paid developer tiers</td>
          </tr>
          <tr>
            <td class="font-bold">System Performance</td>
            <td class="text-success col-highlight">✅ Client-side crawling (Zero server roundtrip overhead)</td>
            <td class="text-muted">❌ Slow cloud-queue scanning with queue lines</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</InfoPageLayout>

<style>
  /* Grid layout for What This Does */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-lg);
  }

  .info-card {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    border-radius: var(--rounded-md);
  }

  .card-icon {
    font-size: 24px;
    margin-bottom: var(--spacing-xxs);
  }

  .info-card h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-ink);
  }

  .info-card p {
    font-size: 14.5px;
    line-height: 1.65;
    color: var(--color-body);
  }

  /* Comparison Section styling */
  .mt-5 {
    margin-top: 64px;
  }

  .col-highlight {
    background-color: rgba(250, 255, 105, 0.015) !important;
    border-left: 1px dashed rgba(250, 255, 105, 0.1) !important;
    border-right: 1px dashed rgba(250, 255, 105, 0.1) !important;
  }

  th.col-highlight {
    color: var(--color-primary) !important;
    border-top: 1px dashed rgba(250, 255, 105, 0.1) !important;
  }

  .table-container {
    overflow-x: auto;
    border-radius: var(--rounded-lg);
    border: 1px solid var(--color-hairline);
    margin-top: var(--spacing-lg);
    background-color: rgba(10, 10, 10, 0.3);
  }

  .comparison-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
    min-width: 650px;
  }

  .comparison-table th {
    padding: var(--spacing-md) var(--spacing-lg);
    font-family: var(--font-family-mono);
    color: var(--color-ink);
    border-bottom: 2px solid var(--color-hairline-strong);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .comparison-table td {
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-hairline);
    line-height: 1.55;
  }

  .comparison-table tr:last-child td {
    border-bottom: none;
  }

  .comparison-table tr:hover {
    background-color: rgba(255, 255, 255, 0.01);
  }

  .text-success {
    color: var(--color-success);
  }

  .text-muted {
    color: var(--color-muted);
  }

  .font-bold {
    font-weight: 600;
    color: var(--color-body-strong);
  }
</style>
