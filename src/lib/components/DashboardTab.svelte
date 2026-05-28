<script lang="ts">
  import { calculateGrade, type AuditResults } from '$lib/seoEngine';
  import { scoreBand } from '$lib/scoreUtils';
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let { 
    auditResults, 
    isValidatingLinks, 
    checkedLinksCount, 
    totalLinksCount, 
    jumpToSection 
  }: { 
    auditResults: AuditResults; 
    isValidatingLinks: boolean; 
    checkedLinksCount: number; 
    totalLinksCount: number; 
    jumpToSection: (tabName: string, selector?: string) => void;
  } = $props();

  // Calculate category-level scores
  const categoryScores = $derived.by(() => {
    if (!auditResults) return null;

    // 1. Meta Score
    let metaScore = 100;
    if (auditResults.onPage.title.status === 'missing') metaScore -= 40;
    else if (auditResults.onPage.title.status === 'warning') metaScore -= 15;
    if (auditResults.onPage.description.status === 'missing') metaScore -= 30;
    else if (auditResults.onPage.description.status === 'warning') metaScore -= 10;
    if (auditResults.onPage.canonical.status === 'missing') metaScore -= 20;
    if (auditResults.onPage.robots.toLowerCase().includes('noindex')) metaScore -= 10;
    metaScore = Math.max(0, metaScore);

    // 2. Structure Score
    let structScore = 100;
    if (auditResults.onPage.headings.status === 'error') structScore -= 50;
    else if (auditResults.onPage.headings.status === 'warning') structScore -= 20;
    if (auditResults.onPage.schemaTypes.length === 0) structScore -= 30;
    if (auditResults.onPage.htmlSize > 150 * 1024) structScore -= 20;
    structScore = Math.max(0, structScore);

    // 3. Media Score
    let mediaScore = 100;
    if (auditResults.onPage.imageAlts.total > 0) {
      const missingPct = auditResults.onPage.imageAlts.missing / auditResults.onPage.imageAlts.total;
      mediaScore -= Math.round(missingPct * 100);
    }
    mediaScore = Math.max(0, mediaScore);

    // 4. Links Score
    let linksScore = 100;
    const totalLinks = auditResults.links.length;
    if (totalLinks > 0) {
      const brokenLinks = auditResults.links.filter(l => l.statusState === 'broken').length;
      const insecureLinks = auditResults.links.filter(l => !l.isSecure).length;
      linksScore -= Math.min(60, Math.round((brokenLinks / totalLinks) * 150));
      linksScore -= Math.min(40, Math.round((insecureLinks / totalLinks) * 50));
    }
    linksScore = Math.max(0, linksScore);

    // 5. Performance Score
    let perfScore = null;
    if (auditResults.pageSpeedMobile || auditResults.pageSpeedDesktop) {
      const mScore = auditResults.pageSpeedMobile?.score ?? 0;
      const dScore = auditResults.pageSpeedDesktop?.score ?? 0;
      if (auditResults.pageSpeedMobile && auditResults.pageSpeedDesktop) {
        perfScore = Math.round((mScore + dScore) / 2);
      } else {
        perfScore = auditResults.pageSpeedMobile ? mScore : dScore;
      }
    }

    return {
      meta: { score: metaScore, grade: calculateGrade(metaScore) },
      structure: { score: structScore, grade: calculateGrade(structScore) },
      media: { score: mediaScore, grade: calculateGrade(mediaScore) },
      links: { score: linksScore, grade: calculateGrade(linksScore) },
      performance: perfScore !== null ? { score: perfScore, grade: calculateGrade(perfScore) } : null
    };
  });

  // Derived sorted list of audit issues
  const sortedIssues = $derived.by(() => {
    if (!auditResults) return [];

    const issues = [
      {
        id: 'title',
        title: 'Page Title Tag',
        description: auditResults.onPage.title.message,
        status: auditResults.onPage.title.status,
        whyItMatters: 'The title tag is the single most important on-page SEO element. It tells search engines what the page is about and is displayed in search results.',
        howToFix: 'Ensure every page has a unique, descriptive title tag between 50-60 characters long.',
        impact: 'High',
        tab: 'onpage',
        selector: '#title-tag-card'
      },
      {
        id: 'description',
        title: 'Meta Description Tag',
        description: auditResults.onPage.description.message,
        status: auditResults.onPage.description.status,
        whyItMatters: 'Meta descriptions influence click-through rates from search engine results pages (SERPs) by summarizing the page content.',
        howToFix: 'Write a compelling, unique meta description between 150-160 characters containing key search terms.',
        impact: 'Medium',
        tab: 'onpage',
        selector: '#meta-desc-card'
      },
      {
        id: 'canonical',
        title: 'Canonical URL Tag',
        description: auditResults.onPage.canonical.message,
        status: auditResults.onPage.canonical.status,
        whyItMatters: 'Canonical tags prevent duplicate content issues by specifying the primary (authoritative) version of a webpage to search engines.',
        howToFix: 'Add a <link rel="canonical" href="..."/> tag pointing to the absolute, preferred URL of this page.',
        impact: 'High',
        tab: 'onpage',
        selector: '#canonical-card'
      },
      {
        id: 'headings',
        title: 'Heading structure (H1)',
        description: auditResults.onPage.headings.message,
        status: auditResults.onPage.headings.status === 'ok' ? 'ok' : (auditResults.onPage.headings.status === 'error' ? 'error' : 'warning'),
        whyItMatters: 'An H1 heading represents the page title. Having exactly one H1 structures the page logically for users and search crawlers.',
        howToFix: 'Use semantic HTML heading tags. Make sure the page has exactly one H1 tag.',
        impact: 'High',
        tab: 'onpage',
        selector: '#headings-card'
      },
      {
        id: 'images',
        title: 'Image Alt Attributes',
        description: auditResults.onPage.imageAlts.message,
        status: auditResults.onPage.imageAlts.status,
        whyItMatters: 'Alt tags describe images to visually impaired users and allow search engines to understand and index image content for image search.',
        howToFix: 'Add descriptive, keyword-rich alt attributes to all <img> tags that convey content or context.',
        impact: 'Medium',
        tab: 'onpage',
        selector: '#images-card'
      },
      {
        id: 'links',
        title: 'Broken Hyperlinks',
        description: auditResults.links.filter(l => l.statusState === 'broken').length > 0
          ? `Found ${auditResults.links.filter(l => l.statusState === 'broken').length} broken links.`
          : 'All crawled links returned successful HTTP statuses.',
        status: auditResults.links.filter(l => l.statusState === 'broken').length > 0 ? 'error' : 'ok',
        whyItMatters: 'Broken links (404s) degrade user experience, waste crawl budget, and signal search engines that the website might be unmaintained.',
        howToFix: 'Locate the broken URLs in the Links tab and update the href attribute or remove the invalid links.',
        impact: 'High',
        tab: 'links',
        selector: '#links-table-card'
      },
      {
        id: 'insecure_links',
        title: 'HTTPS Security Protocols',
        description: auditResults.links.filter(l => !l.isSecure).length > 0
          ? `Detected ${auditResults.links.filter(l => !l.isSecure).length} insecure (HTTP) links.`
          : 'All crawled links use HTTPS secure protocols.',
        status: auditResults.links.filter(l => !l.isSecure).length > 0 ? 'warning' : 'ok',
        whyItMatters: 'Serving pages over HTTPS and linking securely prevents man-in-the-middle attacks and is a lightweight ranking signal.',
        howToFix: 'Update any links pointing to http:// destinations to secure https:// protocols.',
        impact: 'Medium',
        tab: 'links',
        selector: '#links-table-card'
      },
      {
        id: 'pagespeed',
        title: 'Core Web Vitals & PageSpeed',
        description: (auditResults.pageSpeedMobile || auditResults.pageSpeedDesktop)
          ? `Mobile Score: ${auditResults.pageSpeedMobile?.score ?? 'N/A'}, Desktop Score: ${auditResults.pageSpeedDesktop?.score ?? 'N/A'}`
          : 'PageSpeed score has not been calculated. Trigger audit below.',
        status: (auditResults.pageSpeedMobile || auditResults.pageSpeedDesktop)
          ? (((auditResults.pageSpeedMobile?.score ?? 100) < 50 || (auditResults.pageSpeedDesktop?.score ?? 100) < 50) ? 'error' : (((auditResults.pageSpeedMobile?.score ?? 100) < 90 || (auditResults.pageSpeedDesktop?.score ?? 100) < 90) ? 'warning' : 'ok'))
          : 'warning',
        whyItMatters: 'Page speed, Core Web Vitals (LCP, FID/INP, CLS) are official Google ranking signals representing page experience.',
        howToFix: 'Execute a PageSpeed audit on the PageSpeed tab and implement the recommendations like minification and image sizing.',
        impact: 'High',
        tab: 'pagespeed',
        selector: '#pagespeed-section'
      }
    ];

    return issues.sort((a, b) => {
      const statusWeight: Record<string, number> = { error: 0, missing: 0, warning: 1, ok: 2 };
      const wA = statusWeight[a.status] ?? 2;
      const wB = statusWeight[b.status] ?? 2;
      if (wA !== wB) return wA - wB;
      
      const impactWeight: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
      const iA = impactWeight[a.impact] ?? 2;
      const iB = impactWeight[b.impact] ?? 2;
      return iA - iB;
    });
  });

  const internalLinksCount = $derived(auditResults.links.filter(l => !l.isExternal).length);
  const externalLinksCount = $derived(auditResults.links.filter(l => l.isExternal).length);
</script>

<div class="overview-tab">
  
  <!-- Category Breakdown Cards -->
  {#if categoryScores}
    <div class="category-breakdown-grid grid grid-3">
      <div class="category-card card-dark">
        <div class="card-header">
          <span class="category-title">Meta & Content</span>
          <span class="category-grade" class:text-success={scoreBand(categoryScores.meta.score) === 'success'} class:text-warning={scoreBand(categoryScores.meta.score) === 'warning'} class:text-error={scoreBand(categoryScores.meta.score) === 'error'}>{categoryScores.meta.grade}</span>
        </div>
        <ProgressBar value={categoryScores.meta.score} band={categoryScores.meta.score} />
        <span class="score-label">{categoryScores.meta.score}/100</span>
      </div>

      <div class="category-card card-dark">
        <div class="card-header">
          <span class="category-title">Structure & Hierarchy</span>
          <span class="category-grade" class:text-success={scoreBand(categoryScores.structure.score) === 'success'} class:text-warning={scoreBand(categoryScores.structure.score) === 'warning'} class:text-error={scoreBand(categoryScores.structure.score) === 'error'}>{categoryScores.structure.grade}</span>
        </div>
        <ProgressBar value={categoryScores.structure.score} band={categoryScores.structure.score} />
        <span class="score-label">{categoryScores.structure.score}/100</span>
      </div>

      <div class="category-card card-dark">
        <div class="card-header">
          <span class="category-title">Media Alt text</span>
          <span class="category-grade" class:text-success={scoreBand(categoryScores.media.score) === 'success'} class:text-warning={scoreBand(categoryScores.media.score) === 'warning'} class:text-error={scoreBand(categoryScores.media.score) === 'error'}>{categoryScores.media.grade}</span>
        </div>
        <ProgressBar value={categoryScores.media.score} band={categoryScores.media.score} />
        <span class="score-label">{categoryScores.media.score}/100</span>
      </div>

      <div class="category-card card-dark">
        <div class="card-header">
          <span class="category-title">Links Quality</span>
          <span class="category-grade" class:text-success={scoreBand(categoryScores.links.score) === 'success'} class:text-warning={scoreBand(categoryScores.links.score) === 'warning'} class:text-error={scoreBand(categoryScores.links.score) === 'error'}>{categoryScores.links.grade}</span>
        </div>
        <ProgressBar value={categoryScores.links.score} band={categoryScores.links.score} />
        <span class="score-label">{categoryScores.links.score}/100</span>
      </div>

      <div class="category-card card-dark">
        <div class="card-header">
          <span class="category-title">Performance Vitals</span>
          {#if categoryScores.performance}
            <span class="category-grade" class:text-success={scoreBand(categoryScores.performance.score) === 'success'} class:text-warning={scoreBand(categoryScores.performance.score) === 'warning'} class:text-error={scoreBand(categoryScores.performance.score) === 'error'}>{categoryScores.performance.grade}</span>
          {:else}
            <span class="category-grade text-muted">N/A</span>
          {/if}
        </div>
        <ProgressBar value={categoryScores.performance?.score ?? 0} band={categoryScores.performance?.score} />
        {#if categoryScores.performance}
          <span class="score-label">{categoryScores.performance.score}/100</span>
        {:else}
          <span class="score-label text-muted">Awaiting API fetch</span>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Stats ribbon bar -->
  <div class="stats-ribbon card-dark font-mono">
    <div class="ribbon-item">
      <span class="label">PAGE HTML SIZE</span>
      <span class="value">{(auditResults.onPage.htmlSize / 1024).toFixed(1)} KB</span>
    </div>
    <div class="ribbon-item">
      <span class="label">TOTAL IMAGES</span>
      <span class="value">{auditResults.onPage.imageAlts.total}</span>
    </div>
    <div class="ribbon-item">
      <span class="label">SCHEMA TYPES</span>
      <span class="value">{auditResults.onPage.schemaTypes.length} types</span>
    </div>
    <div class="ribbon-item">
      <span class="label">LINKS (INT / EXT)</span>
      <span class="value text-primary">{internalLinksCount} / {externalLinksCount}</span>
    </div>
    <div class="ribbon-item">
      <span class="label">CRAWL TIMESTAMP</span>
      <span class="value">{new Date(auditResults.timestamp).toLocaleTimeString()}</span>
    </div>
  </div>

  <h2 class="title-lg sect-title mt-4">Prioritized Audit Checks</h2>
  
  <!-- Priority Issue cards list -->
  <div class="issues-list">
    {#each sortedIssues as issue}
      <div 
        class="issue-card card-dark clickable" 
        onclick={() => jumpToSection(issue.tab, issue.selector)}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && jumpToSection(issue.tab, issue.selector)}
        class:border-success={issue.status === 'ok'} 
        class:border-warning={issue.status === 'warning'} 
        class:border-error={issue.status === 'error' || issue.status === 'missing'}
      >
        <div class="issue-head">
          <div class="issue-head-left">
            <span class="badge" class:badge-success={issue.status === 'ok'} class:badge-warning={issue.status === 'warning'} class:badge-error={issue.status === 'error' || issue.status === 'missing'}>
              {issue.status.toUpperCase()}
            </span>
            <span class="badge badge-pill impact-badge" class:impact-high={issue.impact === 'High'} class:impact-medium={issue.impact === 'Medium'}>
              {issue.impact} Impact
            </span>
            <h3 class="title-sm inline-title">{issue.title}</h3>
          </div>
          <span class="jump-indicator">→ View Detail</span>
        </div>
        
        <p class="issue-desc">{issue.description}</p>
        
        {#if issue.status !== 'ok'}
          <div class="issue-tips">
            <div class="tip-section">
              <span class="tip-label">Why it matters:</span>
              <p class="tip-content">{issue.whyItMatters}</p>
            </div>
            <div class="tip-section mt-2">
              <span class="tip-label">How to fix:</span>
              <p class="tip-content text-primary">{issue.howToFix}</p>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

</div>

<style>
  .overview-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .category-breakdown-grid {
    margin-top: var(--spacing-sm);
  }

  .category-card {
    padding: var(--spacing-md) !important;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .category-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .category-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-body-strong);
  }

  .category-grade {
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-family-sans);
  }

  .score-label {
    font-size: 11px;
    color: var(--color-muted);
    font-family: var(--font-family-mono);
  }

  /* Stats Ribbon */
  .stats-ribbon {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    padding: var(--spacing-md) !important;
    border: 1px dashed var(--color-hairline-strong) !important;
    background-color: rgba(26, 26, 26, 0.4) !important;
  }

  .ribbon-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ribbon-item .label {
    font-size: 10px;
    color: var(--color-muted);
    letter-spacing: 0.5px;
  }

  .ribbon-item .value {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-on-dark);
  }

  .mt-4 { margin-top: var(--spacing-lg); }
  .mt-2 { margin-top: var(--spacing-xs); }

  /* Issue Cards */
  .issue-card {
    padding: var(--spacing-md) !important;
    margin-bottom: var(--spacing-md);
    border-left: 4px solid var(--color-hairline);
    transition: border-color 0.2s ease, transform 0.15s ease;
  }

  .issue-card:hover {
    transform: translateY(-2px);
    border-left-color: var(--color-primary-active) !important;
  }

  .clickable {
    cursor: pointer;
  }

  .issue-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xs);
  }

  .issue-head-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .inline-title {
    margin: 0;
    color: var(--color-on-dark);
  }

  .impact-badge {
    font-size: 10px;
    padding: 2px 8px;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--color-hairline);
  }

  .impact-high {
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
    background-color: rgba(248, 113, 113, 0.05);
  }

  .impact-medium {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.3);
    background-color: rgba(251, 191, 36, 0.05);
  }

  .jump-indicator {
    font-size: 12px;
    color: var(--color-primary);
    font-weight: 600;
    opacity: 0.7;
    transition: opacity 0.15s ease;
  }

  .issue-card:hover .jump-indicator {
    opacity: 1;
  }

  .issue-desc {
    font-size: 14px;
    color: var(--color-body);
    line-height: 1.5;
  }

  .issue-tips {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    background-color: var(--color-surface-soft);
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
  }

  .tip-section {
    font-size: 13px;
  }

  .tip-label {
    font-weight: 600;
    color: var(--color-body-strong);
    display: block;
    margin-bottom: 2px;
  }

  .tip-content {
    color: var(--color-muted);
    line-height: 1.4;
  }
</style>
