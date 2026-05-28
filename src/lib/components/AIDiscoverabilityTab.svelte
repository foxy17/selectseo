<script lang="ts">
  import type { AIDiscoverabilityAudit } from '$lib/seoEngine';

  let { audit }: { audit: AIDiscoverabilityAudit } = $props();
</script>

<div class="ai-discoverability-tab">
  <div class="score-card card-dark">
    <div class="row-between">
      <h3 class="title-md">AI Readiness Score</h3>
      <div class="score-badge font-mono" class:grade-a={audit.score >= 90} class:grade-b={audit.score >= 80 && audit.score < 90} class:grade-c={audit.score >= 70 && audit.score < 80} class:grade-f={audit.score < 70}>
        {audit.score}/100 ({audit.grade})
      </div>
    </div>
    <p class="section-desc mt-1">This score evaluates how well your content is structured for AI models like ChatGPT, Gemini, and Perplexity to read, extract facts, and cite as a source.</p>
  </div>

  <div class="audit-grid grid grid-2 mt-4">
    <!-- Q&A Formatting -->
    <div class="audit-card card-dark">
      <div class="row-between">
        <h4 class="title-sm">Fact-First Q&A Formatting</h4>
        <span class="status-badge" class:status-ok={audit.qaFormatting.status === 'ok'} class:status-warn={audit.qaFormatting.status === 'warning'}>
          {audit.qaFormatting.status.toUpperCase()}
        </span>
      </div>
      <p class="audit-msg mt-1">{audit.qaFormatting.message}</p>
    </div>

    <!-- Scannability -->
    <div class="audit-card card-dark">
      <div class="row-between">
        <h4 class="title-sm">Content Scannability (Lists & Tables)</h4>
        <span class="status-badge" class:status-ok={audit.scannability.status === 'ok'} class:status-warn={audit.scannability.status === 'warning'}>
          {audit.scannability.status.toUpperCase()}
        </span>
      </div>
      <p class="audit-msg mt-1">{audit.scannability.message}</p>
    </div>

    <!-- Semantic HTML -->
    <div class="audit-card card-dark">
      <div class="row-between">
        <h4 class="title-sm">Semantic HTML Structure</h4>
        <span class="status-badge" class:status-ok={audit.semanticHtml.status === 'ok'} class:status-warn={audit.semanticHtml.status === 'warning'}>
          {audit.semanticHtml.status.toUpperCase()}
        </span>
      </div>
      <p class="audit-msg mt-1">{audit.semanticHtml.message}</p>
    </div>

    <!-- Target Schema -->
    <div class="audit-card card-dark">
      <div class="row-between">
        <h4 class="title-sm">High-Value AI Schema Depth</h4>
        <span class="status-badge" class:status-ok={audit.targetSchema.status === 'ok'} class:status-warn={audit.targetSchema.status === 'warning'}>
          {audit.targetSchema.status.toUpperCase()}
        </span>
      </div>
      <p class="audit-msg mt-1">{audit.targetSchema.message}</p>
    </div>

    <!-- Robots TXT -->
    <div class="audit-card card-dark" style="grid-column: 1 / -1">
      <div class="row-between">
        <h4 class="title-sm">AI Crawler Permissions (robots.txt)</h4>
        <span class="status-badge" class:status-ok={audit.robotsTxtAi.status === 'ok'} class:status-warn={audit.robotsTxtAi.status === 'warning'}>
          {audit.robotsTxtAi.status.toUpperCase()}
        </span>
      </div>
      <p class="audit-msg mt-1">{audit.robotsTxtAi.message}</p>
    </div>
  </div>
</div>

<style>
  .ai-discoverability-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .score-card {
    padding: var(--spacing-lg);
  }

  .score-badge {
    padding: 8px 16px;
    border-radius: var(--rounded-md);
    font-weight: 700;
    font-size: 18px;
    background-color: var(--color-surface-soft);
  }

  .grade-a { color: var(--color-success); border: 1px solid var(--color-success); }
  .grade-b { color: var(--color-accent-blue); border: 1px solid var(--color-accent-blue); }
  .grade-c { color: var(--color-warning); border: 1px solid var(--color-warning); }
  .grade-f { color: var(--color-error); border: 1px solid var(--color-error); }

  .audit-grid {
    gap: var(--spacing-md);
  }

  .audit-card {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .status-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: var(--rounded-xs);
    font-family: var(--font-family-mono);
  }

  /* #10b981 (emerald-600) is intentionally distinct from --color-success (#22c55e). */
  .status-ok { background-color: rgba(16, 185, 129, 0.15); color: #10b981; }
  .status-warn { background-color: rgb(var(--color-warning-rgb) / 0.15); color: var(--color-warning); }

  .audit-msg {
    font-size: 14px;
    color: var(--color-muted);
    line-height: 1.5;
  }
</style>
