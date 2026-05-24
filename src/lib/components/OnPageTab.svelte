<script lang="ts">
  import type { AuditResults } from '$lib/seoEngine';

  let { auditResults }: { auditResults: AuditResults } = $props();

  // SERP Mobile vs Desktop toggle state
  let serpMode = $state<'desktop' | 'mobile'>('desktop');
  
  // Active social preview tab
  let socialMode = $state<'facebook' | 'twitter'>('facebook');

  // Expanded state for schema cards
  let expandedSchemas = $state<Record<number, boolean>>({});

  function toggleSchema(index: number) {
    expandedSchemas[index] = !expandedSchemas[index];
  }

  // Get domain name for previews
  const domainName = $derived.by(() => {
    try {
      return new URL(auditResults.url).hostname;
    } catch {
      return 'example.com';
    }
  });

  // Character gauge calculators
  const titleLength = $derived(auditResults.onPage.title.text.length);
  const titlePercent = $derived(Math.min(100, (titleLength / 80) * 100));
  const descLength = $derived(auditResults.onPage.description.text.length);
  const descPercent = $derived(Math.min(100, (descLength / 200) * 100));

  // Determine skip-level warnings
  const headingWarnings = $derived.by(() => {
    const warnings: string[] = [];
    const h1Count = auditResults.onPage.headings.h1.length;
    const h2Count = auditResults.onPage.headings.h2.length;
    const h3Count = auditResults.onPage.headings.h3.length;
    const h4Count = auditResults.onPage.headings.h4.length;
    const h5Count = auditResults.onPage.headings.h5.length;
    const h6Count = auditResults.onPage.headings.h6.length;

    if (h1Count === 0) warnings.push('Missing H1 heading: A page should always have exactly one H1 tag representing its primary topic.');
    if (h1Count > 1) warnings.push(`Multiple H1 headings: Found ${h1Count} H1 tags. It is recommended to keep exactly one H1 per page.`);
    if (h3Count > 0 && h2Count === 0) warnings.push('Skip-level H3: Found H3 headings but no H2 headings. Maintain a proper hierarchy (H1 -> H2 -> H3).');
    if (h4Count > 0 && h3Count === 0) warnings.push('Skip-level H4: Found H4 headings but no H3 headings.');
    if (h5Count > 0 && h4Count === 0) warnings.push('Skip-level H5: Found H5 headings but no H4 headings.');
    if (h6Count > 0 && h5Count === 0) warnings.push('Skip-level H6: Found H6 headings but no H5 headings.');

    return warnings;
  });
</script>

<div class="on-page-tab">
  
  <!-- SERP and Social Previews row -->
  <div class="previews-row grid grid-2">
    
    <!-- Google SERP Preview Card -->
    <div class="preview-card card-dark" id="serp-preview-card">
      <div class="card-header-row">
        <h3 class="title-md">Google SERP Preview</h3>
        <div class="toggle-buttons font-mono">
          <button class="toggle-btn" class:active={serpMode === 'desktop'} onclick={() => serpMode = 'desktop'}>Desktop</button>
          <button class="toggle-btn" class:active={serpMode === 'mobile'} onclick={() => serpMode = 'mobile'}>Mobile</button>
        </div>
      </div>
      
      <div class="serp-box" class:serp-mobile={serpMode === 'mobile'}>
        <div class="serp-url font-sans">
          {domainName} <span class="url-arrow">›</span> {auditResults.url.split('/').filter(Boolean).slice(2).join(' › ') || ''}
        </div>
        <div class="serp-title">
          {#if titleLength > 60}
            {auditResults.onPage.title.text.slice(0, 60)}...
          {:else}
            {auditResults.onPage.title.text || 'Missing Page Title'}
          {/if}
        </div>
        <div class="serp-desc">
          {#if descLength > 155}
            {auditResults.onPage.description.text.slice(0, 155)}...
          {:else}
            {auditResults.onPage.description.text || 'Please provide a meta description. Otherwise, search engines will construct a snippet from page contents.'}
          {/if}
        </div>
      </div>

      <!-- Truncation Warnings -->
      <div class="preview-validations mt-2">
        {#if titleLength > 60}
          <div class="validation-item text-warning">⚠ Title exceeds optimal length ({titleLength}/60 chars) and will be truncated.</div>
        {:else if titleLength > 0 && titleLength < 30}
          <div class="validation-item text-muted">⚠ Title is shorter than recommended ({titleLength}/30-60 chars).</div>
        {/if}

        {#if descLength > 160}
          <div class="validation-item text-warning">⚠ Description exceeds optimal length ({descLength}/160 chars) and will be truncated.</div>
        {:else if descLength > 0 && descLength < 110}
          <div class="validation-item text-muted">⚠ Description is shorter than recommended ({descLength}/110-160 chars).</div>
        {/if}
      </div>
    </div>

    <!-- Social Media Preview Card -->
    <div class="preview-card card-dark">
      <div class="card-header-row">
        <h3 class="title-md">Social Media Share Preview</h3>
        <div class="toggle-buttons font-mono">
          <button class="toggle-btn" class:active={socialMode === 'facebook'} onclick={() => socialMode = 'facebook'}>Facebook</button>
          <button class="toggle-btn" class:active={socialMode === 'twitter'} onclick={() => socialMode = 'twitter'}>Twitter</button>
        </div>
      </div>

      {#if socialMode === 'facebook'}
        <div class="facebook-box">
          <div class="fb-image-placeholder">
            {#if auditResults.onPage.openGraph.image}
              <img src={auditResults.onPage.openGraph.image} alt="OG representation" class="social-img" />
            {:else}
              <span class="placeholder-text">Missing og:image tag</span>
            {/if}
          </div>
          <div class="fb-info">
            <span class="fb-domain font-mono">{domainName.toUpperCase()}</span>
            <div class="fb-title">{auditResults.onPage.openGraph.title || auditResults.onPage.title.text || 'Share Title'}</div>
            <div class="fb-desc">{auditResults.onPage.openGraph.description || auditResults.onPage.description.text || 'Share description details...'}</div>
          </div>
        </div>
      {:else}
        <div class="twitter-box">
          <div class="tw-image-placeholder">
            {#if auditResults.onPage.twitterCard.image || auditResults.onPage.openGraph.image}
              <img src={auditResults.onPage.twitterCard.image || auditResults.onPage.openGraph.image} alt="Twitter representation" class="social-img" />
            {:else}
              <span class="placeholder-text">Missing twitter:image / og:image tag</span>
            {/if}
          </div>
          <div class="tw-info">
            <span class="tw-domain font-mono">{domainName}</span>
            <div class="tw-title">{auditResults.onPage.twitterCard.title || auditResults.onPage.title.text || 'Twitter Share Title'}</div>
            <div class="tw-desc">{auditResults.onPage.twitterCard.description || auditResults.onPage.description.text || 'Twitter share summary description...'}</div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Character Count Gauges -->
  <div class="gauges-card card-dark mt-4">
    <h3 class="title-md">Character Length Audits</h3>
    
    <div class="gauge-group mt-2" id="title-tag-card">
      <div class="gauge-label-row">
        <span>Title Length: <strong class="text-primary">{titleLength}</strong> characters</span>
        <span class="range-info">Optimal: 50-60</span>
      </div>
      <div class="gauge-track">
        <div class="gauge-fill" style="width: {titlePercent}%" class:gauge-green={titleLength >= 50 && titleLength <= 60} class:gauge-yellow={(titleLength >= 30 && titleLength < 50) || (titleLength > 60 && titleLength <= 70)} class:gauge-red={titleLength < 30 || titleLength > 70}></div>
      </div>
      <div class="gauge-zones">
        <span>Too Short (&lt;30)</span>
        <span class="text-success text-center">Optimal (50-60)</span>
        <span class="text-right">Too Long (&gt;70)</span>
      </div>
    </div>

    <div class="gauge-group mt-4" id="meta-desc-card">
      <div class="gauge-label-row">
        <span>Meta Description Length: <strong class="text-primary">{descLength}</strong> characters</span>
        <span class="range-info">Optimal: 150-160</span>
      </div>
      <div class="gauge-track">
        <div class="gauge-fill" style="width: {descPercent}%" class:gauge-green={descLength >= 110 && descLength <= 160} class:gauge-yellow={(descLength >= 80 && descLength < 110) || (descLength > 160 && descLength <= 180)} class:gauge-red={descLength < 80 || descLength > 180}></div>
      </div>
      <div class="gauge-zones">
        <span>Too Short (&lt;110)</span>
        <span class="text-success text-center">Optimal (150-160)</span>
        <span class="text-right">Too Long (&gt;180)</span>
      </div>
    </div>
  </div>

  <!-- Heading outline tree with hierarchy validator -->
  <div class="headings-card card-dark mt-4" id="headings-card">
    <h3 class="title-md">Heading Outline & Hierarchy</h3>
    
    {#if headingWarnings.length > 0}
      <div class="heading-warnings-box mt-2">
        <h4 class="title-sm text-warning">Hierarchy Recommendations</h4>
        <ul>
          {#each headingWarnings as warning}
            <li class="warning-li">{warning}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <div class="headings-tree mt-2">
      <!-- H1 Section -->
      {#if auditResults.onPage.headings.h1.length > 0}
        {#each auditResults.onPage.headings.h1 as h1}
          <div class="tree-node depth-1">
            <span class="tag-badge h1-badge">H1</span>
            <span class="node-text">{h1}</span>
            <span class="node-length font-mono">{h1.length} ch</span>
          </div>
        {/each}
      {:else}
        <div class="tree-node depth-1 text-error">
          <span class="tag-badge error-badge">H1</span>
          <span class="node-text font-italic">Missing Heading H1 Tag</span>
        </div>
      {/if}

      <!-- H2 Section -->
      {#each auditResults.onPage.headings.h2 as h2}
        <div class="tree-node depth-2">
          <span class="tag-badge h2-badge">H2</span>
          <span class="node-text">{h2}</span>
          <span class="node-length font-mono">{h2.length} ch</span>
        </div>
      {/each}

      <!-- H3 Section -->
      {#each auditResults.onPage.headings.h3 as h3}
        <div class="tree-node depth-3">
          <span class="tag-badge h3-badge">H3</span>
          <span class="node-text">{h3}</span>
          <span class="node-length font-mono">{h3.length} ch</span>
        </div>
      {/each}

      <!-- H4 Section -->
      {#each auditResults.onPage.headings.h4 as h4}
        <div class="tree-node depth-4">
          <span class="tag-badge h4-badge">H4</span>
          <span class="node-text">{h4}</span>
          <span class="node-length font-mono">{h4.length} ch</span>
        </div>
      {/each}

      <!-- H5 Section -->
      {#each auditResults.onPage.headings.h5 as h5}
        <div class="tree-node depth-5">
          <span class="tag-badge h5-badge">H5</span>
          <span class="node-text">{h5}</span>
          <span class="node-length font-mono">{h5.length} ch</span>
        </div>
      {/each}

      <!-- H6 Section -->
      {#each auditResults.onPage.headings.h6 as h6}
        <div class="tree-node depth-6">
          <span class="tag-badge h6-badge">H6</span>
          <span class="node-text">{h6}</span>
          <span class="node-length font-mono">{h6.length} ch</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Content quality & Meta validations row -->
  <div class="meta-quality-row grid grid-2 mt-4">
    
    <!-- Content Quality panel -->
    <div class="quality-card card-dark">
      <h3 class="title-md">Content Quality Metrics</h3>
      <div class="metrics-grid font-mono mt-2">
        <div class="metric-item">
          <span class="label">WORD COUNT</span>
          <span class="val text-primary">{auditResults.onPage.contentMetrics.wordCount} words</span>
        </div>
        <div class="metric-item">
          <span class="label">CONTENT RATIO</span>
          <span class="val">{auditResults.onPage.contentMetrics.contentRatio}% of HTML</span>
        </div>
        <div class="metric-item">
          <span class="label">READING LEVEL</span>
          <span class="val text-blue">{auditResults.onPage.contentMetrics.readingLevel}</span>
        </div>
        <div class="metric-item">
          <span class="label">HTML LANGUAGE</span>
          <span class="val">{auditResults.onPage.contentMetrics.language.toUpperCase()}</span>
        </div>
      </div>
    </div>

    <!-- Technical Meta Tag Audits -->
    <div class="meta-tag-audits-card card-dark">
      <h3 class="title-md">Technical Meta Checklist</h3>
      <ul class="meta-checklist mt-2 font-mono">
        <li class="checklist-row">
          <span>Viewport (Mobile friendliness):</span>
          {#if auditResults.onPage.viewport}
            <span class="text-success" title={auditResults.onPage.viewport}>PRESENT</span>
          {:else}
            <span class="text-error">MISSING (Crucial!)</span>
          {/if}
        </li>
        <li class="checklist-row">
          <span>Charset declaration:</span>
          {#if auditResults.onPage.charset}
            <span class="text-success">{auditResults.onPage.charset.toUpperCase()}</span>
          {:else}
            <span class="text-warning">MISSING</span>
          {/if}
        </li>
        <li class="checklist-row">
          <span>Favicon links:</span>
          {#if auditResults.onPage.favicon}
            <span class="text-success">DETECTED</span>
          {:else}
            <span class="text-warning">MISSING</span>
          {/if}
        </li>
        <li class="checklist-row">
          <span>Hreflang translations:</span>
          {#if auditResults.onPage.hreflangs.length > 0}
            <span class="text-success">{auditResults.onPage.hreflangs.length} tags found</span>
          {:else}
            <span class="text-muted">None configured</span>
          {/if}
        </li>
      </ul>
    </div>
  </div>

  <!-- Expandable Schema validator panel -->
  <div class="schema-card card-dark mt-4" id="schema-card">
    <h3 class="title-md">Schema Structured Data ({auditResults.onPage.schemaTypes.length} found)</h3>
    <p class="section-desc mt-1">Structured JSON-LD schema helps search engines understand details about WebPages, Companies, Products, and rich snippets.</p>
    
    {#if auditResults.onPage.schemaTypes.length === 0}
      <div class="empty-state text-warning mt-2 font-mono">
        ⚠ No JSON-LD structured schemas detected on this page. Search engines won't represent rich product/review cards.
      </div>
    {:else}
      <div class="schema-cards-container mt-2">
        {#if auditResults.onPage.schemas && auditResults.onPage.schemas.length > 0}
          {#each auditResults.onPage.schemas as schema, idx}
            <div class="schema-collapsible-card">
              <button class="schema-header-btn" onclick={() => toggleSchema(idx)}>
                <div class="schema-title-wrap">
                  <span class="schema-type-title font-mono text-primary">{schema.type}</span>
                </div>
                <span class="schema-rich-badge">Eligible for Rich Results</span>
                <span class="expand-arrow">{expandedSchemas[idx] ? '▲' : '▼'}</span>
              </button>
              
              {#if expandedSchemas[idx]}
                <div class="schema-json-body font-mono">
                  <pre class="raw-json"><code>{schema.code}</code></pre>
                </div>
              {/if}
            </div>
          {/each}
        {:else}
          {#each auditResults.onPage.schemaTypes as type, idx}
            <div class="schema-collapsible-card">
              <button class="schema-header-btn" onclick={() => toggleSchema(idx)}>
                <div class="schema-title-wrap">
                  <span class="schema-type-title font-mono text-primary">{type}</span>
                </div>
                <span class="schema-rich-badge">Eligible for Rich Results</span>
                <span class="expand-arrow">{expandedSchemas[idx] ? '▲' : '▼'}</span>
              </button>
              
              {#if expandedSchemas[idx]}
                <div class="schema-json-body font-mono">
                  <pre class="raw-json"><code>{JSON.stringify({ "@context": "https://schema.org", "@type": type }, null, 2)}</code></pre>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <!-- End of OnPage Tab -->

</div>

<style>
  .on-page-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  /* Previews Switcher */
  .toggle-buttons {
    display: flex;
    background-color: var(--color-surface-soft);
    padding: 2px;
    border-radius: var(--rounded-sm);
    border: 1px solid var(--color-hairline);
  }

  .toggle-btn {
    background: none;
    border: none;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted);
    cursor: pointer;
    border-radius: var(--rounded-xs);
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .toggle-btn.active {
    background-color: var(--color-surface-card);
    color: var(--color-primary);
  }

  /* SERP Box styles */
  .serp-box {
    background-color: #ffffff;
    border-radius: var(--rounded-md);
    padding: 16px;
    color: #1a0dab;
    border: 1px solid #dadce0;
    max-width: 600px;
    transition: max-width 0.2s ease;
  }

  .serp-mobile {
    max-width: 375px;
  }

  .serp-url {
    font-size: 12px;
    color: #202124;
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .url-arrow {
    color: #70757a;
    font-size: 10px;
  }

  .serp-title {
    font-size: 19px;
    line-height: 1.3;
    font-weight: 400;
    text-decoration: none;
    margin-bottom: 3px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .serp-title:hover {
    text-decoration: underline;
  }

  .serp-desc {
    font-size: 14px;
    color: #4d5156;
    line-height: 1.58;
    word-wrap: break-word;
  }

  .validation-item {
    font-size: 12px;
    margin-top: 4px;
    font-family: var(--font-family-mono);
  }

  /* Social Share boxes */
  .facebook-box {
    background-color: #3b5998;
    color: #ffffff;
    border-radius: var(--rounded-md);
    overflow: hidden;
    border: 1px solid var(--color-hairline);
  }

  .fb-image-placeholder, .tw-image-placeholder {
    height: 150px;
    background-color: #2b2b2b;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .social-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder-text {
    font-size: 12px;
    color: var(--color-muted);
    font-family: var(--font-family-mono);
  }

  .fb-info {
    background-color: #f2f3f5;
    color: #1c1e21;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fb-domain {
    font-size: 10px;
    color: #606770;
  }

  .fb-title {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  .fb-desc {
    font-size: 12px;
    color: #606770;
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .twitter-box {
    background-color: #15202b;
    border-radius: var(--rounded-md);
    overflow: hidden;
    border: 1px solid var(--color-hairline-strong);
  }

  .tw-info {
    padding: 12px;
    color: #8899a6;
    display: flex;
    flex-direction: column;
    gap: 2px;
    background-color: #192734;
  }

  .tw-domain {
    font-size: 11px;
  }

  .tw-title {
    font-size: 14px;
    font-weight: 600;
    color: #ffffff;
  }

  .tw-desc {
    font-size: 12px;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Linear Length Gauges */
  .gauge-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .gauge-label-row {
    display: flex;
    justify-content: space-between;
    font-size: 14px;
  }

  .range-info {
    font-size: 12px;
    color: var(--color-muted);
  }

  .gauge-track {
    height: 10px;
    background-color: var(--color-surface-soft);
    border-radius: var(--rounded-pill);
    overflow: hidden;
    border: 1px solid var(--color-hairline);
  }

  .gauge-fill {
    height: 100%;
    border-radius: var(--rounded-pill);
    transition: width 0.3s ease;
  }

  .gauge-green { background-color: var(--color-success); }
  .gauge-yellow { background-color: var(--color-warning); }
  .gauge-red { background-color: var(--color-error); }

  .gauge-zones {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--color-muted);
  }

  .text-center { text-align: center; flex: 1; }
  .text-right { text-align: right; }

  /* Heading outline tree connector nodes */
  .headings-tree {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    position: relative;
    padding-left: var(--spacing-xs);
  }

  .tree-node {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 6px var(--spacing-sm);
    background-color: rgba(255, 255, 255, 0.02);
    border-radius: var(--rounded-sm);
    border-left: 2px solid var(--color-hairline-strong);
    font-size: 14px;
    color: var(--color-body-strong);
  }

  .depth-1 { margin-left: 0; border-left-color: var(--color-primary); background-color: rgba(250, 255, 105, 0.03); }
  .depth-2 { margin-left: var(--spacing-md); border-left-color: #3b82f6; }
  .depth-3 { margin-left: calc(var(--spacing-md) * 2); border-left-color: #10b981; }
  .depth-4 { margin-left: calc(var(--spacing-md) * 3); }
  .depth-5 { margin-left: calc(var(--spacing-md) * 4); }
  .depth-6 { margin-left: calc(var(--spacing-md) * 5); }

  .tag-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--rounded-xs);
    font-family: var(--font-family-mono);
  }

  .h1-badge { background-color: rgba(250, 255, 105, 0.15); color: var(--color-primary); }
  .h2-badge { background-color: rgba(59, 130, 246, 0.15); color: #3b82f6; }
  .h3-badge { background-color: rgba(16, 185, 129, 0.15); color: #10b981; }
  .h4-badge, .h5-badge, .h6-badge { background-color: var(--color-surface-soft); color: var(--color-muted); }
  .error-badge { background-color: rgba(239, 68, 68, 0.15); color: var(--color-error); }

  .node-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-length {
    font-size: 11px;
    color: var(--color-muted);
  }

  .font-italic { font-style: italic; }

  .heading-warnings-box {
    background-color: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: var(--rounded-md);
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .heading-warnings-box ul {
    margin-left: 20px;
  }

  .warning-li {
    font-size: 13px;
    color: var(--color-warning);
    margin-top: 4px;
  }

  /* Content Quality */
  .metrics-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .metric-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background-color: var(--color-surface-soft);
    padding: var(--spacing-sm);
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
  }

  .metric-item .label {
    font-size: 10px;
    color: var(--color-muted);
    letter-spacing: 0.5px;
  }

  .metric-item .val {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-on-dark);
  }

  /* Technical Checklist */
  .meta-checklist {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .checklist-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    border-bottom: 1px solid var(--color-hairline);
    padding-bottom: var(--spacing-xxs);
  }

  .section-desc {
    font-size: 14px;
    color: var(--color-muted);
  }

  /* Schema collapsed cards */
  .schema-collapsible-card {
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
    margin-bottom: var(--spacing-sm);
    overflow: hidden;
    background-color: var(--color-surface-soft);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .schema-collapsible-card:hover {
    border-color: rgba(250, 255, 105, 0.4);
    box-shadow: 0 0 12px rgba(250, 255, 105, 0.06);
  }

  .schema-header-btn {
    width: 100%;
    background: none;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    cursor: pointer;
    text-align: left;
    outline: none;
    color: var(--color-ink) !important;
    transition: background-color 0.15s ease;
  }

  .schema-header-btn:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .schema-header-btn:focus-visible {
    background-color: rgba(255, 255, 255, 0.04);
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }

  .schema-title-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .schema-type-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-primary) !important;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .schema-type-title::before {
    content: "●";
    color: var(--color-primary);
    font-size: 8px;
    text-shadow: 0 0 8px var(--color-primary);
  }

  .schema-rich-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-success);
    background-color: rgba(34, 197, 94, 0.08);
    border: 1px solid rgba(34, 197, 94, 0.25);
    padding: 3px 10px;
    border-radius: var(--rounded-pill);
    margin-left: auto;
    margin-right: var(--spacing-lg);
  }

  .expand-arrow {
    color: var(--color-muted);
    font-size: 12px;
    transition: transform 0.2s ease;
  }

  .schema-json-body {
    padding: var(--spacing-md);
    background-color: #050507;
    border-top: 1px solid var(--color-hairline);
  }

  .raw-json {
    font-size: 13px;
    color: #e2e8f0;
    overflow-x: auto;
    padding: var(--spacing-sm);
    background-color: #09090b;
    border-radius: var(--rounded-sm);
    border: 1px solid rgba(255, 255, 255, 0.03);
    line-height: 1.5;
  }
</style>
