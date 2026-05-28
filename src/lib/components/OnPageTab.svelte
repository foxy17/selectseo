<script lang="ts">
  import type { AuditResults } from '$lib/seoEngine';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import Collapsible from '$lib/components/Collapsible.svelte';
  import SegmentedToggle from '$lib/components/SegmentedToggle.svelte';

  let { auditResults }: { auditResults: AuditResults } = $props();

  // SERP Mobile vs Desktop toggle state
  let serpMode = $state<'desktop' | 'mobile'>('desktop');

  // Active social preview tab
  let socialMode = $state<'facebook' | 'twitter'>('facebook');

  // Heading levels for the outline tree (H2..H6; H1 has a missing-state special case).
  const headingLevels = $derived([
    { level: 2, items: auditResults.onPage.headings.h2 },
    { level: 3, items: auditResults.onPage.headings.h3 },
    { level: 4, items: auditResults.onPage.headings.h4 },
    { level: 5, items: auditResults.onPage.headings.h5 },
    { level: 6, items: auditResults.onPage.headings.h6 }
  ]);

  // Normalized schema list: prefer parsed `schemas`, otherwise synthesize from `schemaTypes`.
  const schemaItems = $derived(
    auditResults.onPage.schemas && auditResults.onPage.schemas.length > 0
      ? auditResults.onPage.schemas
      : auditResults.onPage.schemaTypes.map((type) => ({
          type,
          code: JSON.stringify({ '@context': 'https://schema.org', '@type': type }, null, 2)
        }))
  );

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

  // Gauge band colors (custom thresholds, NOT the general scoreBand scheme).
  const titleBand = $derived<'success' | 'warning' | 'error'>(
    titleLength >= 50 && titleLength <= 60
      ? 'success'
      : (titleLength >= 30 && titleLength < 50) || (titleLength > 60 && titleLength <= 70)
        ? 'warning'
        : 'error'
  );
  const descBand = $derived<'success' | 'warning' | 'error'>(
    descLength >= 110 && descLength <= 160
      ? 'success'
      : (descLength >= 80 && descLength < 110) || (descLength > 160 && descLength <= 180)
        ? 'warning'
        : 'error'
  );

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
        <SegmentedToggle
          ariaLabel="SERP preview mode"
          options={[
            { label: 'Desktop', value: 'desktop' },
            { label: 'Mobile', value: 'mobile' }
          ]}
          bind:value={serpMode}
        />
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
        <SegmentedToggle
          ariaLabel="Social preview platform"
          options={[
            { label: 'Facebook', value: 'facebook' },
            { label: 'Twitter', value: 'twitter' }
          ]}
          bind:value={socialMode}
        />
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
      <ProgressBar value={titlePercent} color={titleBand} height="10px" border />
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
      <ProgressBar value={descPercent} color={descBand} height="10px" border />
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
      <!-- H1 Section (special missing-state handling) -->
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

      <!-- H2..H6 Sections -->
      {#each headingLevels as { level, items }}
        {#each items as text}
          <div class="tree-node depth-{level}">
            <span class="tag-badge h{level}-badge">H{level}</span>
            <span class="node-text">{text}</span>
            <span class="node-length font-mono">{text.length} ch</span>
          </div>
        {/each}
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
          {#if auditResults.onPage.viewportAudit.status === 'ok'}
            <span class="text-success" title={auditResults.onPage.viewport}>{auditResults.onPage.viewportAudit.status.toUpperCase()}</span>
          {:else}
            <span class="text-error" title={auditResults.onPage.viewportAudit.message}>{auditResults.onPage.viewportAudit.status.toUpperCase()}</span>
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
          <span>HTML Language:</span>
          {#if auditResults.onPage.languageAudit.status === 'ok'}
            <span class="text-success">{auditResults.onPage.contentMetrics.language.toUpperCase()}</span>
          {:else}
            <span class="text-error" title={auditResults.onPage.languageAudit.message}>MISSING</span>
          {/if}
        </li>
        <li class="checklist-row">
          <span>Robots Indexing:</span>
          {#if auditResults.onPage.robotsMetaAudit.status === 'ok'}
            <span class="text-success">ALLOWED</span>
          {:else}
            <span class="text-warning" title={auditResults.onPage.robotsMetaAudit.message}>{auditResults.onPage.robotsMetaAudit.status.toUpperCase()}</span>
          {/if}
        </li>
        <li class="checklist-row">
          <span>Favicon links:</span>
          {#if auditResults.onPage.faviconAudit.status === 'ok'}
            <span class="text-success">DETECTED</span>
          {:else}
            <span class="text-warning" title={auditResults.onPage.faviconAudit.message}>MISSING</span>
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
        {#each schemaItems as schema}
          <Collapsible cardClass="schema-collapsible-card" headerClass="schema-header-btn" bodyClass="schema-json-body font-mono">
            {#snippet header()}
              <div class="schema-title-wrap">
                <span class="schema-type-title font-mono text-primary">{schema.type}</span>
              </div>
            {/snippet}
            {#snippet badge()}
              <span class="schema-rich-badge">Eligible for Rich Results</span>
            {/snippet}
            <pre class="raw-json"><code>{schema.code}</code></pre>
          </Collapsible>
        {/each}
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

  /* SERP / Facebook / Twitter preview mimics: the literal hex colors below
     (Google blues/greys, Facebook #3b5998, Twitter dark blues, white SERP bg)
     are deliberate external-brand mimicry and intentionally NOT design tokens. */
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

  .depth-1 { margin-left: 0; border-left-color: var(--color-primary); background-color: rgb(var(--color-primary-rgb) / 0.03); }
  .depth-2 { margin-left: var(--spacing-md); border-left-color: var(--color-accent-blue); }
  /* #10b981 (emerald-600) is intentionally distinct from --color-success (#22c55e). */
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

  .h1-badge { background-color: rgb(var(--color-primary-rgb) / 0.15); color: var(--color-primary); }
  .h2-badge { background-color: rgb(var(--color-accent-blue-rgb) / 0.15); color: var(--color-accent-blue); }
  /* #10b981 (emerald-600) is intentionally distinct from --color-success (#22c55e). */
  .h3-badge { background-color: rgba(16, 185, 129, 0.15); color: #10b981; }
  .h4-badge, .h5-badge, .h6-badge { background-color: var(--color-surface-soft); color: var(--color-muted); }
  .error-badge { background-color: rgb(var(--color-error-rgb) / 0.15); color: var(--color-error); }

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
    background-color: rgb(var(--color-warning-rgb) / 0.05);
    border: 1px solid rgb(var(--color-warning-rgb) / 0.2);
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

  /* Schema collapsed cards (the card wrapper is rendered by the Collapsible child). */
  .schema-cards-container :global(.schema-collapsible-card) {
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
    margin-bottom: var(--spacing-sm);
    overflow: hidden;
    background-color: var(--color-surface-soft);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .schema-cards-container :global(.schema-collapsible-card:hover) {
    border-color: rgb(var(--color-primary-rgb) / 0.4);
    box-shadow: 0 0 12px rgb(var(--color-primary-rgb) / 0.06);
  }

  /* The header button lives inside the Collapsible child component, so target it globally. */
  .schema-cards-container :global(.schema-header-btn) {
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

  .schema-cards-container :global(.schema-header-btn:hover) {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .schema-cards-container :global(.schema-header-btn:focus-visible) {
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
    background-color: rgb(var(--color-success-rgb) / 0.08);
    border: 1px solid rgb(var(--color-success-rgb) / 0.25);
    padding: 3px 10px;
    border-radius: var(--rounded-pill);
    margin-left: auto;
    margin-right: var(--spacing-lg);
  }

  .schema-cards-container :global(.schema-json-body) {
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
