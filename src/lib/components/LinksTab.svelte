<script lang="ts">
  import type { AuditResults, LinkItem } from '$lib/seoEngine';
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let { 
    auditResults, 
    isValidatingLinks, 
    checkedLinksCount, 
    totalLinksCount 
  }: { 
    auditResults: AuditResults; 
    isValidatingLinks: boolean; 
    checkedLinksCount: number; 
    totalLinksCount: number;
  } = $props();

  // Internal states
  let activeFilter = $state<'all' | 'internal' | 'external' | 'broken' | 'redirects' | 'insecure' | 'nofollow'>('all');
  let searchQuery = $state('');
  let sortColumn = $state<'href' | 'text' | 'type' | 'secure' | 'status' | 'responseTime'>('status');
  let sortDirection = $state<'asc' | 'desc' | 'none'>('asc');
  let expandedRow = $state<number | null>(null);

  function toggleRow(id: number) {
    if (expandedRow === id) expandedRow = null;
    else expandedRow = id;
  }

  // Count calculations
  const total = $derived(auditResults.links.length);
  const internal = $derived(auditResults.links.filter(l => !l.isExternal).length);
  const external = $derived(auditResults.links.filter(l => l.isExternal).length);
  const broken = $derived(auditResults.links.filter(l => l.statusState === 'broken').length);
  const redirects = $derived(auditResults.links.filter(l => l.status && l.status >= 300 && l.status < 400).length);
  const insecure = $derived(auditResults.links.filter(l => !l.isSecure).length);
  const nofollow = $derived(auditResults.links.filter(l => l.rel.toLowerCase().includes('nofollow')).length);

  // Distribution percentages for stack chart
  const intPct = $derived(total > 0 ? (internal / total) * 100 : 0);
  const extPct = $derived(total > 0 ? (external / total) * 100 : 0);
  const redPct = $derived(total > 0 ? (redirects / total) * 100 : 0);
  const brkPct = $derived(total > 0 ? (broken / total) * 100 : 0);

  // Sorting columns
  function handleSort(col: typeof sortColumn) {
    if (sortColumn === col) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else if (sortDirection === 'desc') {
        sortDirection = 'none';
        sortColumn = 'status';
      } else {
        sortDirection = 'asc';
      }
    } else {
      sortColumn = col;
      sortDirection = 'asc';
    }
  }

  // Process list reactively
  const filteredLinks = $derived.by(() => {
    let items = [...auditResults.links];

    // Filter
    if (activeFilter === 'internal') items = items.filter(l => !l.isExternal);
    else if (activeFilter === 'external') items = items.filter(l => l.isExternal);
    else if (activeFilter === 'broken') items = items.filter(l => l.statusState === 'broken');
    else if (activeFilter === 'redirects') items = items.filter(l => l.status && l.status >= 300 && l.status < 400);
    else if (activeFilter === 'insecure') items = items.filter(l => !l.isSecure);
    else if (activeFilter === 'nofollow') items = items.filter(l => l.rel.toLowerCase().includes('nofollow'));

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(l => (l.href || '').toLowerCase().includes(q) || (l.text || '').toLowerCase().includes(q));
    }

    // Sort
    if (sortColumn && sortDirection !== 'none') {
      items.sort((a, b) => {
        let valA: any = (a as any)[sortColumn];
        let valB: any = (b as any)[sortColumn];

        // Handle Type sort mapping
        if (sortColumn === 'type') {
          valA = a.isExternal ? 'external' : 'internal';
          valB = b.isExternal ? 'external' : 'internal';
        }
        if (sortColumn === 'secure') {
          valA = a.isSecure ? 1 : 0;
          valB = b.isSecure ? 1 : 0;
        }

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    return items;
  });

  // Bulk actions
  function copyBrokenLinks() {
    const brokenUrls = auditResults.links.filter(l => l.statusState === 'broken').map(l => l.href).join('\n');
    if (!brokenUrls) return;
    navigator.clipboard.writeText(brokenUrls);
    alert('Copied all broken links to clipboard!');
  }

  function exportCSV() {
    const headers = ['Anchor Text', 'URL', 'Scope', 'Security', 'HTTP Status', 'Response Time (ms)', 'Redirect Destination'];
    const rows = auditResults.links.map(l => [
      `"${(l.text || '').replace(/"/g, '""')}"`,
      `"${l.href}"`,
      l.isExternal ? 'external' : 'internal',
      l.isSecure ? 'HTTPS' : 'HTTP',
      l.status || 'N/A',
      l.responseTime || 0,
      l.redirectDestination ? `"${l.redirectDestination}"` : ''
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'crawled-links.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function copyAsMarkdown() {
    let md = '| Anchor Text | URL | Scope | Security | HTTP Status | Response Time |\n';
    md += '|---|---|---|---|---|---|\n';
    auditResults.links.forEach(l => {
      md += `| ${(l.text || '[No text]').replace(/\|/g, '\\|')} | [Link](${l.href}) | ${l.isExternal ? 'External' : 'Internal'} | ${l.isSecure ? 'HTTPS' : 'HTTP'} | ${l.status || 'N/A'} | ${l.responseTime ? l.responseTime + 'ms' : 'N/A'} |\n`;
    });
    navigator.clipboard.writeText(md);
    alert('Copied Markdown table to clipboard!');
  }
</script>

<div class="links-tab" id="links-auditor-section">
  
  <!-- Stats ribbon with visual distribution stack -->
  <div class="links-summary-ribbon card-dark">
    <div class="ribbon-counts">
      <div class="count-item">
        <span class="val">{total}</span>
        <span class="lbl">TOTAL CRAWLED</span>
      </div>
      <div class="count-item">
        <span class="val text-success">{internal}</span>
        <span class="lbl">INTERNAL</span>
      </div>
      <div class="count-item">
        <span class="val text-warning">{external}</span>
        <span class="lbl">EXTERNAL</span>
      </div>
      <div class="count-item">
        <span class="val text-error">{broken}</span>
        <span class="lbl">BROKEN (4xx/5xx)</span>
      </div>
      <div class="count-item">
        <span class="val text-primary">{redirects}</span>
        <span class="lbl">REDIRECTS (3xx)</span>
      </div>
    </div>

    <!-- Distribution bar -->
    <div class="dist-track mt-4">
      {#if total > 0}
        <div class="dist-segment segment-int" style="width: {intPct}%" title="Internal ({intPct.toFixed(1)}%)"></div>
        <div class="dist-segment segment-ext" style="width: {extPct}%" title="External ({extPct.toFixed(1)}%)"></div>
        <div class="dist-segment segment-red" style="width: {redPct}%" title="Redirects ({redPct.toFixed(1)}%)"></div>
        <div class="dist-segment segment-brk" style="width: {brkPct}%" title="Broken ({brkPct.toFixed(1)}%)"></div>
      {:else}
        <div class="empty-bar">No links crawled</div>
      {/if}
    </div>
  </div>

  <!-- Link Issues highlight box -->
  {#if broken > 0 || insecure > 0 || nofollow > 0}
    <div class="links-issues-panel mt-4 border-error">
      <h3 class="title-sm text-error">Actionable Link Concerns</h3>
      <div class="concerns-row mt-2 font-mono">
        {#if broken > 0}
          <button class="concern-pill pill-error" onclick={() => activeFilter = 'broken'}>
            ❌ {broken} Broken link{broken > 1 ? 's' : ''} detected
          </button>
        {/if}
        {#if insecure > 0}
          <button class="concern-pill pill-warning" onclick={() => activeFilter = 'insecure'}>
            ⚠ {insecure} Insecure HTTP hyperlink{insecure > 1 ? 's' : ''}
          </button>
        {/if}
        {#if nofollow > 0}
          <button class="concern-pill pill-info" onclick={() => activeFilter = 'nofollow'}>
            ℹ {nofollow} Rel="nofollow" instruction{nofollow > 1 ? 's' : ''}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Progress bar if actively validating links -->
  {#if isValidatingLinks}
    <div class="links-progress-banner card-dark border-warning mt-4">
      <div class="progress-details">
        <span class="progress-label font-mono">HYPERLINKS CRAWLER STATUS</span>
        <span class="progress-ratio font-mono">{checkedLinksCount} / {totalLinksCount} inspected</span>
      </div>
      <ProgressBar value={(checkedLinksCount / totalLinksCount) * 100} transition="0.2s" />
      <p class="progress-tip font-mono text-muted">Scanning pages in background... Checked URLs are updating in real-time.</p>
    </div>
  {/if}

  <!-- Filter Bar & text search -->
  <div class="filter-actions-bar mt-4">
    <div class="filter-buttons font-mono">
      <button class="filter-btn" class:active={activeFilter === 'all'} onclick={() => activeFilter = 'all'}>
        All <span class="sup">{total}</span>
      </button>
      <button class="filter-btn" class:active={activeFilter === 'internal'} onclick={() => activeFilter = 'internal'}>
        Internal <span class="sup">{internal}</span>
      </button>
      <button class="filter-btn" class:active={activeFilter === 'external'} onclick={() => activeFilter = 'external'}>
        External <span class="sup">{external}</span>
      </button>
      <button class="filter-btn" class:active={activeFilter === 'broken'} onclick={() => activeFilter = 'broken'}>
        Broken <span class="sup text-error">{broken}</span>
      </button>
      <button class="filter-btn" class:active={activeFilter === 'redirects'} onclick={() => activeFilter = 'redirects'}>
        Redirects <span class="sup text-primary">{redirects}</span>
      </button>
    </div>

    <!-- Search box -->
    <div class="links-search-box">
      <input 
        type="text" 
        class="search-input-links" 
        placeholder="Filter by URL or anchor..." 
        bind:value={searchQuery}
      />
    </div>
  </div>

  <!-- Bulk action buttons -->
  <div class="bulk-actions mt-2 font-mono">
    <button class="btn btn-secondary btn-sm" onclick={exportCSV}>CSV Export</button>
    <button class="btn btn-secondary btn-sm" onclick={copyAsMarkdown}>Copy Markdown</button>
    {#if broken > 0}
      <button class="btn btn-primary btn-sm btn-error-bg" onclick={copyBrokenLinks}>Copy Broken URLs</button>
    {/if}
  </div>

  <!-- Links Outlines Table -->
  <div class="table-container card-dark mt-4" id="links-table-card">
    <table class="data-table links-data-table">
      <thead>
        <tr class="font-mono">
          <th class="clickable-header" onclick={() => handleSort('text')}>
            Anchor Text {sortColumn === 'text' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
          <th class="clickable-header" onclick={() => handleSort('href')}>
            Destination URL {sortColumn === 'href' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
          <th class="clickable-header" onclick={() => handleSort('type')}>
            Scope {sortColumn === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
          <th class="clickable-header" onclick={() => handleSort('secure')}>
            Security {sortColumn === 'secure' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
          <th class="clickable-header" onclick={() => handleSort('status')}>
            HTTP Status {sortColumn === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
          <th class="clickable-header" onclick={() => handleSort('responseTime')}>
            Speed {sortColumn === 'responseTime' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
          </th>
        </tr>
      </thead>
      <tbody>
        {#if filteredLinks.length === 0}
          <tr>
            <td colspan="6" class="empty-state">No matching hyperlinks found.</td>
          </tr>
        {:else}
          {#each filteredLinks as link (link.id)}
            <tr class="link-row" onclick={() => toggleRow(link.id)} class:row-expanded={expandedRow === link.id}>
              <td class="anchor-text-cell">{link.text || '[Empty anchor]'}</td>
              <td class="monotext url-cell select-all">{link.href}</td>
              <td>
                <span class="badge" class:badge-pill={!link.isExternal} class:badge-yellow={link.isExternal}>
                  {link.isExternal ? 'EXTERNAL' : 'INTERNAL'}
                </span>
              </td>
              <td>
                {#if link.isSecure}
                  <span class="security-https">HTTPS</span>
                {:else}
                  <span class="security-http">HTTP Insecure</span>
                {/if}
              </td>
              <td>
                {#if link.statusState === 'pending'}
                  <span class="status-pending">Pending</span>
                {:else if link.statusState === 'checking'}
                  <span class="status-checking">Checking...</span>
                {:else if link.statusState === 'ok'}
                  <span class="status-ok">{link.status} OK</span>
                {:else}
                  <span class="badge badge-error">{link.status || 'ERR'} BROKEN</span>
                {/if}
              </td>
              <td class="font-mono text-muted text-right-align">
                {#if link.responseTime}
                  {link.responseTime}ms
                {:else}
                  --
                {/if}
              </td>
            </tr>

            <!-- Expandable detail box -->
            {#if expandedRow === link.id}
              <tr class="expanded-detail-tr">
                <td colspan="6" class="expanded-cell card-dark font-mono">
                  <div class="expand-grid">
                    <div class="grid-item">
                      <span class="detail-label">Full Anchor Text:</span>
                      <p class="detail-val">{link.text || '[Empty]'}</p>
                    </div>
                    <div class="grid-item">
                      <span class="detail-label">Destination URL:</span>
                      <p class="detail-val select-all"><a href={link.href} target="_blank" rel="noreferrer">{link.href}</a></p>
                    </div>
                    <div class="grid-item">
                      <span class="detail-label">Link Attributes:</span>
                      <p class="detail-val">
                        {#if link.rel}
                          <span class="badge badge-pill">{link.rel}</span>
                        {:else}
                          <span class="text-muted">None configured</span>
                        {/if}
                        {#if link.isExternal && !link.rel.includes('noopener')}
                          <span class="badge badge-error ml-2" title="Security best practice: add rel='noopener' to external targets.">Missing noopener</span>
                        {/if}
                      </p>
                    </div>
                    {#if link.redirectDestination}
                      <div class="grid-item">
                        <span class="detail-label text-warning">Redirect Destination:</span>
                        <p class="detail-val text-primary select-all">{link.redirectDestination}</p>
                      </div>
                    {/if}
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

</div>

<style>
  .links-tab {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .links-summary-ribbon {
    padding: var(--spacing-md) !important;
  }

  .ribbon-counts {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }

  .count-item {
    display: flex;
    flex-direction: column;
  }

  .count-item .val {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--font-family-mono);
  }

  .count-item .lbl {
    font-size: 10px;
    color: var(--color-muted);
    letter-spacing: 0.5px;
    font-weight: 600;
  }

  /* Distribution Stack chart */
  .dist-track {
    height: 8px;
    background-color: var(--color-surface-soft);
    border-radius: var(--rounded-pill);
    overflow: hidden;
    display: flex;
    border: 1px solid var(--color-hairline);
  }

  .dist-segment {
    height: 100%;
    transition: width 0.3s ease;
  }

  .segment-int { background-color: var(--color-success); }
  .segment-ext { background-color: var(--color-warning); }
  .segment-red { background-color: var(--color-primary); }
  .segment-brk { background-color: var(--color-error); }

  .empty-bar {
    width: 100%;
    text-align: center;
    font-size: 11px;
    color: var(--color-muted);
    line-height: 8px;
    font-family: var(--font-family-mono);
  }

  /* Actionable link issues box */
  .links-issues-panel {
    background-color: rgba(239, 68, 68, 0.05);
    border-left: 4px solid var(--color-error);
    border-radius: var(--rounded-md);
    padding: var(--spacing-sm);
  }

  .concerns-row {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .concern-pill {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: var(--rounded-pill);
    font-weight: 600;
    transition: background-color 0.15s ease;
  }

  .pill-error { background-color: rgba(239, 68, 68, 0.12); color: var(--color-error); border: 1px solid rgba(239, 68, 68, 0.2); }
  .pill-error:hover { background-color: rgba(239, 68, 68, 0.25); }
  .pill-warning { background-color: rgba(245, 158, 11, 0.12); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.2); }
  .pill-warning:hover { background-color: rgba(245, 158, 11, 0.25); }
  .pill-info { background-color: rgba(59, 130, 246, 0.12); color: var(--color-accent-blue); border: 1px solid rgba(59, 130, 246, 0.2); }
  .pill-info:hover { background-color: rgba(59, 130, 246, 0.25); }

  /* Filters */
  .filter-actions-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }

  .filter-buttons {
    display: flex;
    background-color: var(--color-surface-soft);
    padding: 2px;
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
    flex-wrap: wrap;
  }

  .filter-btn {
    background: none;
    border: none;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-muted);
    cursor: pointer;
    border-radius: var(--rounded-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .filter-btn.active {
    background-color: var(--color-surface-card);
    color: var(--color-primary);
  }

  .filter-btn .sup {
    font-size: 10px;
    font-weight: 700;
    background-color: rgba(255, 255, 255, 0.05);
    padding: 1px 5px;
    border-radius: var(--rounded-xs);
  }

  .links-search-box {
    min-width: 250px;
  }

  .search-input-links {
    width: 100%;
    background-color: var(--color-surface-soft);
    border: 1px solid var(--color-hairline);
    border-radius: var(--rounded-md);
    padding: 8px 12px;
    color: var(--color-on-dark);
    font-size: 14px;
    outline: none;
  }

  .search-input-links:focus {
    border-color: var(--color-primary);
  }

  /* Bulk Actions */
  .bulk-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .btn-sm {
    height: 30px;
    padding: 0 var(--spacing-sm);
    font-size: 12px;
  }

  .btn-error-bg {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-error);
    transition: all 0.15s ease;
  }

  .btn-error-bg:hover {
    background-color: var(--color-error);
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
  }

  /* Muted Cyberpunk Badges for Scope & Security */
  .badge {
    font-size: 9px;
    font-weight: 700;
    padding: 3px 6px;
    border-radius: var(--rounded-xs);
    font-family: var(--font-family-mono);
    letter-spacing: 0.5px;
  }
  .badge-pill {
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--color-body);
  }
  .badge-yellow {
    background-color: rgba(59, 130, 246, 0.04);
    border: 1px solid rgba(59, 130, 246, 0.15);
    color: var(--color-accent-blue);
  }

  .security-https {
    color: var(--color-muted);
    font-size: 11px;
    font-family: var(--font-family-mono);
    opacity: 0.85;
  }

  .security-http {
    color: var(--color-error);
    font-weight: 700;
    font-size: 11px;
    font-family: var(--font-family-mono);
    text-shadow: 0 0 6px rgba(239, 68, 68, 0.2);
    animation: blink-danger 2s infinite alternate;
  }

  @keyframes blink-danger {
    0% { opacity: 0.6; }
    100% { opacity: 1; }
  }

  /* HTTP Status codes hierarchy */
  .status-pending {
    color: var(--color-muted);
    font-size: 12px;
    font-family: var(--font-family-mono);
  }
  .status-checking {
    color: var(--color-warning);
    font-size: 12px;
    font-family: var(--font-family-mono);
  }
  .status-ok {
    color: rgba(34, 197, 94, 0.55);
    font-size: 12px;
    font-family: var(--font-family-mono);
    font-weight: 500;
  }

  .badge-error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: var(--color-error);
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.1);
  }

  .ml-2 { margin-left: var(--spacing-xs); }

  /* Sort headers */
  .clickable-header {
    cursor: pointer;
    user-select: none;
  }

  .clickable-header:hover {
    color: var(--color-primary);
    background-color: rgba(255, 255, 255, 0.02);
  }

  .table-container {
    width: 100%;
    overflow-x: auto;
  }

  /* Outlines table layout */
  .links-data-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    min-width: 950px;
  }

  /* Define column widths */
  .links-data-table th:nth-child(1),
  .links-data-table td:nth-child(1) {
    width: 25%;
  }

  .links-data-table th:nth-child(2),
  .links-data-table td:nth-child(2) {
    width: 33%;
  }

  .links-data-table th:nth-child(3),
  .links-data-table td:nth-child(3) {
    width: 11%;
    text-align: center;
  }

  .links-data-table th:nth-child(4),
  .links-data-table td:nth-child(4) {
    width: 11%;
    text-align: center;
  }

  .links-data-table th:nth-child(5),
  .links-data-table td:nth-child(5) {
    width: 12%;
    text-align: center;
  }

  .links-data-table th:nth-child(6),
  .links-data-table td:nth-child(6) {
    width: 8%;
    text-align: right;
  }

  /* Spacing & alignments */
  .links-data-table th, 
  .links-data-table td {
    padding: 12px 14px;
    vertical-align: middle;
  }

  .link-row {
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .link-row:hover {
    background-color: rgba(250, 255, 105, 0.03) !important;
  }

  .row-expanded {
    background-color: rgba(250, 255, 105, 0.02) !important;
  }

  .anchor-text-cell {
    word-break: break-word;
    white-space: normal;
    line-height: 1.4;
    font-weight: 500;
    color: var(--color-on-dark);
  }

  .url-cell {
    word-break: break-all;
    white-space: normal;
    font-size: 12px;
  }

  .text-right-align {
    text-align: right;
  }

  .select-all {
    user-select: all;
  }

  /* Expanded Detail Box */
  .expanded-detail-tr {
    background-color: rgba(10, 10, 15, 0.8) !important;
  }

  .expanded-cell {
    padding: var(--spacing-md) !important;
    border-top: 1px solid var(--color-hairline) !important;
    border-bottom: 2px solid var(--color-primary) !important;
  }

  .expand-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  .grid-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    font-size: 11px;
    color: var(--color-muted);
    font-weight: 600;
  }

  .detail-val {
    font-size: 13px;
    color: var(--color-on-dark);
    word-break: break-all;
  }

  /* Progress Bar Banner */
  .links-progress-banner {
    padding: var(--spacing-md) !important;
  }

  .progress-details {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }

  .progress-label {
    font-weight: 600;
    color: var(--color-warning);
  }

  .progress-ratio {
    color: var(--color-on-dark);
  }

  .progress-tip {
    font-size: 11px;
    margin-top: 6px;
  }
</style>
