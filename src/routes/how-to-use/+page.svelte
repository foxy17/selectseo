<script lang="ts">
  import SEO from '$lib/components/SEO.svelte';

  const howToSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "How To Use - SelectSEO Auditor",
      "url": "https://selectseo.in/how-to-use/",
      "description": "Step-by-step developer onboarding and usage guide for SelectSEO Auditor.",
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
            "name": "How To Use",
            "item": "https://selectseo.in/how-to-use/"
          }
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "How to Use SelectSEO Auditor",
      "description": "Follow these quick steps to audit any site and query its dataset.",
      "step": [
        {
          "@type": "HowToStep",
          "name": "Configure the Proxy",
          "text": "Configure the CORS proxy worker URL (e.g. corsproxy.io) to allow the browser to crawl cross-origin target sites."
        },
        {
          "@type": "HowToStep",
          "name": "Scan a Target URL",
          "text": "Input a target domain (e.g., svelte.dev) and click Scan Target. Follow the live audit logs stream."
        },
        {
          "@type": "HowToStep",
          "name": "Analyze Audit Checklist",
          "text": "Review page layout structures, meta tags, and outbound hyperlink status codes."
        },
        {
          "@type": "HowToStep",
          "name": "Query via SQL Console",
          "text": "Scroll down to the SQL Console and write custom query statements to inspect results."
        },
        {
          "@type": "HowToStep",
          "name": "Use Chrome On-Device AI",
          "text": "Enable Chrome's prompt API flags, download the local Gemma model, and use the built-in Copilot for offline content improvements."
        }
      ]
    }
  ];
</script>

<SEO 
  title="How To Use - SelectSEO Auditor" 
  description="Step-by-step developer onboarding and usage guide for SelectSEO Auditor." 
  path="/how-to-use/" 
  schema={howToSchema} 
/>

<div class="info-page container">
  <!-- How To Use Section -->
  <section id="how-to-use" class="info-section">
    <h1 class="section-title"><span class="highlight-text">How</span> To Use</h1>
    <p class="section-subtitle">Follow these quick steps to audit any site and query its dataset.</p>
    
    <div class="steps-container">
      <div class="step-item">
        <div class="step-number">01</div>
        <div class="step-content">
          <h4>Configure the Proxy</h4>
          <p>Make sure to configure the CORS proxy worker URL (e.g., using corsproxy.io or a custom Cloudflare worker) to allow the browser to crawl cross-origin target sites.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">02</div>
        <div class="step-content">
          <h4>Scan a Target URL</h4>
          <p>Input a target domain (e.g., <code>svelte.dev</code>) and click <strong>Scan Target</strong>. Follow the live audit logs stream on the console panel.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">03</div>
        <div class="step-content">
          <h4>Analyze Audit Checklist</h4>
          <p>Review page layout structures, meta tags, and outbound hyperlink status codes on the generated results dashboard.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">04</div>
        <div class="step-content">
          <h4>Query via SQL Console</h4>
          <p>Scroll down to the SQL Console and write custom query statements. Example: <code>SELECT url, anchor_text FROM links WHERE status_code = 404</code>.</p>
        </div>
      </div>
      <div class="step-item">
        <div class="step-number">05</div>
        <div class="step-content">
          <h4>Consult the AI Copilot</h4>
          <p>Switch to the <strong>✨ AI Chat</strong> tab (the second tab) to generate CTR-optimized metadata pairs, map keyword strategies, and fix headings readability.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Chrome Built-in AI Copilot Guide Section -->
  <section id="chrome-ai-guide" class="info-section mt-5 border-t pt-5">
    <h2 class="section-title"><span class="highlight-text">Chrome</span> Built-in AI Copilot</h2>
    <p class="section-subtitle">SelectSEO Auditor integrates Chrome's experimental Prompt API to run optimization suggestions locally on your PC using Google's <strong>Gemini Nano</strong> model.</p>
    
    <div class="ai-config-grid">
      <div class="ai-config-info card-dark">
        <h3 class="title-sm text-primary mb-2">// WHY_LOCAL_AI?</h3>
        <p class="text-xs leading-relaxed text-muted">
          Unlike traditional cloud AI assistants, SelectSEO does not transmit page crawl payloads to external servers or require subscription-based API keys. All title improvements, keyword extractions, and readability edits are processed locally on your hardware.
        </p>
        <div class="space-warning-box mt-3 text-xs p-2 rounded">
          <span class="text-warning">⚠️ Storage Alert:</span> Downloading Chrome's native optimization component requires downloading a ~4GB <code>weights.bin</code> file. If you ever need to delete this file to reclaim disk space, set the <strong>#optimization-guide-on-device-model</strong> flag back to 'Disabled' and restart Chrome.
        </div>
      </div>
      
      <div class="ai-config-steps card-dark font-mono text-xs">
        <h3 class="title-sm text-warning mb-2">// LOCAL_LLM_ENABLE_PROCEDURE</h3>
        <ol class="setup-list">
          <li>Open a new Chrome tab and navigate to <code class="code-link">chrome://flags</code>.</li>
          <li>Find <strong class="text-primary">#prompt-api-for-gemini-nano</strong> and set it to <strong>Enabled</strong>.</li>
          <li>Find <strong class="text-primary">#optimization-guide-on-device-model</strong> and set it to <strong>Enabled BypassPrefRequirement</strong>. <span class="text-warning">*Note: 'BypassPrefRequirement' is crucial to prevent silent hardware capability rejects.</span></li>
          <li>Relaunch Chrome completely. (A second relaunch is sometimes needed to enforce flag updates).</li>
          <li><strong>Trigger the download:</strong> Open DevTools console on this page and execute <code class="code-link">await (window.ai?.languageModel || window.LanguageModel)?.create()</code>. This call forces Chrome to dynamically register the component and begin downloading.</li>
          <li>Navigate to <code class="code-link">chrome://on-device-internals</code> and click the <strong>"Model Status"</strong> tab. The status should change from <em>"No On-device Feature Used"</em> to <em>"Downloading"</em>.</li>
          <li>Once download completes, scan any target site, switch to the dedicated **✨ AI Chat** tab, and click any quick audit action card to begin!</li>
        </ol>
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

  /* Steps styling for How To Use */
  .steps-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--spacing-lg);
  }

  .step-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .step-number {
    font-family: var(--font-family-mono);
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary);
    opacity: 0.85;
    border-bottom: 2px solid var(--color-primary-disabled);
    padding-bottom: var(--spacing-xxs);
    width: max-content;
  }

  .step-content h4 {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-ink);
    margin-bottom: 6px;
  }

  .step-content p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-body);
  }

  /* Responsive collapses for steps */
  @media (max-width: 1024px) {
    .steps-container {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    .steps-container {
      grid-template-columns: 1fr;
    }
  }

  /* Chrome AI Section classes */
  .mt-5 {
    margin-top: 48px;
  }
  .pt-5 {
    padding-top: 48px;
  }
  .border-t {
    border-top: 1px solid var(--color-hairline);
  }
  .mb-2 {
    margin-bottom: var(--spacing-xs);
  }
  .mt-3 {
    margin-top: var(--spacing-sm);
  }
  .p-2 {
    padding: var(--spacing-sm);
  }
  
  .ai-config-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
  }

  .ai-config-info, .ai-config-steps {
    padding: var(--spacing-xl);
    border-radius: var(--rounded-lg);
  }

  .space-warning-box {
    background-color: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.15);
    line-height: 1.5;
  }

  .setup-list {
    margin-left: 20px;
    line-height: 1.6;
  }

  .setup-list li {
    margin-top: var(--spacing-xs);
  }

  .code-link {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--color-on-dark);
    padding: 1px 6px;
    border-radius: var(--rounded-xs);
  }

  @media (max-width: 768px) {
    .ai-config-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
