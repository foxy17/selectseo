<script lang="ts">
  import { onMount } from 'svelte';
  import { runSEOAudit, validateLinks, fetchPageSpeed, calculateGrade } from '$lib/seoEngine';
  import type { AuditResults, LinkItem, PageSpeedMetric } from '$lib/seoEngine';
  import { executeSQLQuery, initSqlEngine } from '$lib/sqlEngine';
  import type { SQLQueryResult } from '$lib/sqlEngine';
  import { exportSEOReport } from '$lib/pdfExporter';
  import SEO from '$lib/components/SEO.svelte';
  import DashboardTab from '$lib/components/DashboardTab.svelte';
  import OnPageTab from '$lib/components/OnPageTab.svelte';
  import LinksTab from '$lib/components/LinksTab.svelte';
  import PageSpeedTab from '$lib/components/PageSpeedTab.svelte';
  import SqlConsoleTab from '$lib/components/SqlConsoleTab.svelte';
  import AiChatTab from '$lib/components/AiChatTab.svelte';
  import { appState } from '$lib/sharedState.svelte';

  const homeSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "SelectSEO Auditor",
      "url": "https://selectseo.in/"
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "SelectSEO Auditor",
      "url": "https://selectseo.in/",
      "description": "High-performance, developer-first SEO scanner and analysis panel running entirely in your browser.",
      "applicationCategory": "DeveloperApplication, SEOTool",
      "operatingSystem": "All",
      "browserRequirements": "Requires WebGL for visual effects, CORS proxy for scanning.",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "SelectSEO",
        "url": "https://selectseo.in/"
      }
    }
  ];

  // State using Svelte 5 Runes
  let targetUrl = $state('https://carnav.in');
  let proxyUrl = $state('https://corsproxy.io/?url=');
  let selectedProxy = $state('https://corsproxy.io/?url=');
  let apiKey = $state('');

  $effect(() => {
    if (selectedProxy !== 'custom') {
      proxyUrl = selectedProxy;
    }
  });
  
  let isScanning = $state(false);
  let scanLogs = $state<string[]>([]);
  let auditResults = $state<AuditResults | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let consoleBodyEl = $state<HTMLDivElement | null>(null);

  // Auto-scroll console terminal to bottom on content updates
  $effect(() => {
    scanLogs;
    if (consoleBodyEl) {
      setTimeout(() => {
        if (consoleBodyEl) {
          consoleBodyEl.scrollTop = consoleBodyEl.scrollHeight;
        }
      }, 0);
    }
  });

  // Link checking state
  let isValidatingLinks = $state(false);
  let checkedLinksCount = $state(0);
  let totalLinksCount = $state(0);

  // Tabs state
  let activeTab = $state('overview'); // overview, onpage, links, pagespeed, sql

  // Update layout shared state reactively
  $effect(() => {
    appState.hasResults = !!auditResults;
  });

  // Crawl History state & logic
  let crawlHistory = $state<any[]>([]);

  function loadCrawlHistory() {
    const saved = localStorage.getItem('seo_crawl_history');
    if (saved) {
      try {
        crawlHistory = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse crawl history:', e);
      }
    }
  }

  function saveCrawlToHistory() {
    const results = auditResults;
    if (!results) return;
    
    let historyList: any[] = [];
    const saved = localStorage.getItem('seo_crawl_history');
    if (saved) {
      try {
        historyList = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse crawl history:', e);
      }
    }
    
    // Count errors and warnings
    const errCount = (results.onPage.title.status === 'missing' ? 1 : 0) +
      (results.onPage.description.status === 'missing' ? 1 : 0) +
      (results.onPage.headings.status === 'error' ? 1 : 0) +
      (results.onPage.imageAlts.status === 'error' ? 1 : 0) +
      results.links.filter(l => l.statusState === 'broken').length;

    const warnCount = (results.onPage.title.status === 'warning' ? 1 : 0) +
      (results.onPage.description.status === 'warning' ? 1 : 0) +
      (results.onPage.headings.status === 'warning' ? 1 : 0) +
      (results.onPage.imageAlts.status === 'warning' ? 1 : 0) +
      (results.onPage.canonical.status === 'missing' ? 1 : 0) +
      (results.onPage.openGraph.status === 'missing' ? 1 : 0);

    const historyItem = {
      url: results.url,
      timestamp: results.timestamp || new Date().toISOString(),
      score: results.score,
      grade: results.grade,
      errorCount: errCount,
      warningCount: warnCount,
      results: $state.snapshot(results)
    };
    
    historyList = historyList.filter(item => item.url !== results.url);
    historyList = [historyItem, ...historyList].slice(0, 6);
    
    try {
      localStorage.setItem('seo_crawl_history', JSON.stringify(historyList));
      crawlHistory = historyList;
    } catch (e) {
      console.warn('Failed to save crawl to history:', e);
      if (historyList.length > 1) {
        historyList = historyList.slice(0, historyList.length - 1);
        localStorage.setItem('seo_crawl_history', JSON.stringify(historyList));
        crawlHistory = historyList;
      }
    }
  }

  function deleteHistoryItem(url: string, event: Event) {
    event.stopPropagation();
    const updated = crawlHistory.filter(item => item.url !== url);
    localStorage.setItem('seo_crawl_history', JSON.stringify(updated));
    crawlHistory = updated;
  }

  function loadCrawlFromHistory(item: any) {
    targetUrl = item.url;
    // Deep clone to ensure reactivity binds cleanly
    auditResults = JSON.parse(JSON.stringify(item.results));
    
    // Auto query default SQL values
    runSQLQuery();
    
    // Scroll down to results dashboard
    setTimeout(() => {
      const el = document.getElementById('overview');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 60);
    
    log(`Restored previous crawl report for ${item.url} from local storage.`);
  }
  
  // PageSpeed states
  let isFetchingMobileSpeed = $state(false);
  let isFetchingDesktopSpeed = $state(false);
  let pageSpeedMobileError = $state('');
  let pageSpeedDesktopError = $state('');

  // SQL Console state
  let sqlQuery = $state('SELECT href, text, type FROM links WHERE status != 200');
  let sqlResult = $state<SQLQueryResult | null>(null);
  let sqlError = $state('');

  let sampleQueries = [
    { name: 'Broken Links', query: "SELECT href, text, status_state FROM links WHERE status_state = 'broken'" },
    { name: 'Images Missing Alt', query: "SELECT src, alt FROM images WHERE is_missing = 1" },
    { name: 'H1 & H2 Headings', query: "SELECT tag, text FROM headings WHERE tag = 'h1' OR tag = 'h2'" },
    { name: 'Meta Warning Issues', query: "SELECT name, content, status FROM meta WHERE status = 'warning' OR status = 'missing'" }
  ];

  // Log logger
  function log(message: string) {
    const timestamp = new Date().toLocaleTimeString();
    scanLogs = [...scanLogs, `[${timestamp}] ${message}`];
  }

  // WebGL Futuristic Shader
  function initShader() {
    if (!canvasEl) return null;
    const gl = canvasEl.getContext('webgl');
    if (!gl) {
      console.warn('WebGL not supported in this browser/environment');
      return null;
    }

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        
        // Scale for grid
        vec2 gridUv = uv * vec2(30.0, 18.0);
        vec2 gridId = floor(gridUv);
        vec2 gridFract = fract(gridUv);
        
        // Grid lines with neon glow
        float lineThickness = 0.03;
        float gridX = smoothstep(lineThickness, 0.0, abs(gridFract.x - 0.5));
        float gridY = smoothstep(lineThickness, 0.0, abs(gridFract.y - 0.5));
        float gridVal = max(gridX, gridY);
        
        // Cyber pulse glitches
        float pulse = noise(vec2(u_time * 1.5, gridId.y)) * step(0.93, hash(vec2(gridId.y, floor(u_time * 4.0))));
        
        // Smooth scanning glowing wave
        float wavePos = fract(u_time * 0.12) * 2.0 - 0.5;
        float wave = smoothstep(0.18, 0.0, abs(uv.y - wavePos));
        
        // Dynamic futuristic plasma background
        float slowTime = u_time * 0.3;
        float plasma = sin(uv.x * 5.0 + slowTime) * cos(uv.y * 4.0 - slowTime) * 0.5 + 0.5;
        
        // Modern yellow/cyber theme palette: deep slate-charcoal, glowing cyber yellow, gold/orange pulse
        vec3 spaceBg = mix(vec3(0.01, 0.01, 0.015), vec3(0.04, 0.04, 0.025), plasma);
        vec3 cyberYellow = vec3(0.98, 1.0, 0.41); // #faff69
        vec3 cyberOrange = vec3(1.0, 0.65, 0.0);
        
        vec3 color = spaceBg;
        
        // Blend grid and wave
        color += cyberYellow * gridVal * 0.15 * (1.0 - uv.y * 0.3);
        color += cyberYellow * wave * 0.28;
        
        // Add random gold/orange pulses
        color += cyberOrange * pulse * gridVal * 0.35;
        
        // Vignette
        float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        vignette = clamp(pow(16.0 * vignette, 0.5), 0.0, 1.0);
        color *= vignette;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return null;
    }

    const positionAttr = gl.getAttribLocation(program, 'position');
    const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
    const timeUniform = gl.getUniformLocation(program, 'u_time');

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    let animationId: number;
    const startTime = performance.now();

    function renderLoop() {
      if (!gl || !canvasEl) return;

      const width = canvasEl.clientWidth;
      const height = canvasEl.clientHeight;
      if (canvasEl.width !== width || canvasEl.height !== height) {
        canvasEl.width = width;
        canvasEl.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.enableVertexAttribArray(positionAttr);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionUniform, canvasEl.width, canvasEl.height);
      gl.uniform1f(timeUniform, (performance.now() - startTime) / 1000.0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationId = requestAnimationFrame(renderLoop);
    }

    renderLoop();

    return () => {
      cancelAnimationFrame(animationId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(positionBuffer);
    };
  }

  let typingActive = true;
  const initMessages = [
    "SYSTEM: Booting SelectSEO Neural Auditor...",
    "DATABASE: SQLite virtual schema mounted successfully.",
    "NETWORK: Proxy workers validation... ACTIVE (23ms)",
    "CONSOLE: Ready. Initializing user scanner interface..."
  ];

  // Persistance using localstorage on mount
  onMount(() => {
    loadCrawlHistory();
    initSqlEngine().catch(err => {
      console.error('Failed to load SQL engine:', err);
      log(`[ERROR] SQL Engine failure: ${err.message || err}`);
    });

    const handleNewCrawl = () => {
      auditResults = null;
    };
    window.addEventListener('new-crawl', handleNewCrawl);
    const savedProxy = localStorage.getItem('seo_proxy_url');
    const savedKey = localStorage.getItem('seo_pagespeed_key');
    
    if (savedProxy) {
      proxyUrl = savedProxy;
    }
    
    if (proxyUrl === 'https://corsproxy.io/?url=') {
      selectedProxy = 'https://corsproxy.io/?url=';
    } else if (proxyUrl === 'https://api.allorigins.win/raw?url=') {
      selectedProxy = 'https://api.allorigins.win/raw?url=';
    } else {
      selectedProxy = 'custom';
    }
    
    if (savedKey) apiKey = savedKey;

    const cleanupShader = initShader();

    // Start typewriter effect for terminal
    let msgIdx = 0;
    let charIdx = 0;
    let currentLine = "";
    const timestamp = new Date().toLocaleTimeString();
    
    function typeChar() {
      if (!typingActive) return;
      if (msgIdx >= initMessages.length) return;
      
      const targetText = initMessages[msgIdx];
      if (charIdx < targetText.length) {
        currentLine += targetText[charIdx];
        const formattedLine = `[${timestamp}] ${currentLine}`;
        if (scanLogs.length <= msgIdx) {
          scanLogs = [...scanLogs, formattedLine];
        } else {
          scanLogs[msgIdx] = formattedLine;
          scanLogs = [...scanLogs];
        }
        charIdx++;
        setTimeout(typeChar, 10 + Math.random() * 15);
      } else {
        msgIdx++;
        if (msgIdx < initMessages.length) {
          charIdx = 0;
          currentLine = "";
          setTimeout(typeChar, 150);
        }
      }
    }
    
    setTimeout(typeChar, 200);

    return () => {
      typingActive = false;
      if (cleanupShader) cleanupShader();
      window.removeEventListener('new-crawl', handleNewCrawl);
    };
  });

  function saveSettings() {
    localStorage.setItem('seo_proxy_url', proxyUrl);
    localStorage.setItem('seo_pagespeed_key', apiKey);
    log('Settings updated and stored locally.');
  }

  // Primary Scan Function
  async function handleScan() {
    if (!targetUrl) return;
    
    typingActive = false;
    
    // Normalize target URL prefix
    let urlToScan = targetUrl.trim();
    if (!/^https?:\/\//i.test(urlToScan)) {
      urlToScan = 'https://' + urlToScan;
      targetUrl = urlToScan;
    }

    isScanning = true;
    scanLogs = [];
    auditResults = null;
    sqlResult = null;
    sqlError = '';
    checkedLinksCount = 0;
    totalLinksCount = 0;

    log(`Initializing audit for target: ${urlToScan}`);
    
    try {
      // 1. Crawl & Run On-Page Audit
      const results = await runSEOAudit(urlToScan, proxyUrl, (msg) => log(msg));
      auditResults = results;
      
      // Auto query default SQL console values
      runSQLQuery();

      saveCrawlToHistory();

      // 2. Validate Hyperlinks Asynchronously
      totalLinksCount = results.links.length;
      if (totalLinksCount > 0) {
        log(`Found ${totalLinksCount} unique links to check. Starting validation...`);
        isValidatingLinks = true;
        
        validateLinks(
          results.links,
          proxyUrl,
          (updatedLink) => {
            // Update individual link item reactive state
            if (auditResults) {
              const idx = auditResults.links.findIndex(l => l.id === updatedLink.id);
              if (idx !== -1) {
                auditResults.links[idx] = updatedLink;
                // Force update row counts for SQL Queries if currently on SQL tab
                if (activeTab === 'sql') runSQLQuery();
              }
              checkedLinksCount = auditResults.links.filter(l => l.statusState !== 'pending' && l.statusState !== 'checking').length;
            }
          },
          () => {
            isValidatingLinks = false;
            log('Link checking completed.');
            recalculateOverallScore();
            saveCrawlToHistory();
          }
        );
      } else {
        log('No links found to validate.');
      }

      // 3. PageSpeed Audits (Automatically run in background)
      triggerPageSpeedAudits(urlToScan);

      log('SEO core analysis complete.');

    } catch (err: any) {
      log(`[ERROR] Audit aborted: ${err.message}`);
      console.error(err);
    } finally {
      isScanning = false;
    }
  }

  // Background PageSpeed crawler
  async function triggerPageSpeedAudits(url: string) {
    // Desktop speed audit
    isFetchingDesktopSpeed = true;
    pageSpeedDesktopError = '';
    log('Requesting Google PageSpeed Desktop report...');
    try {
      const desktopStats = await fetchPageSpeed(url, 'desktop', apiKey);
      if (auditResults) {
        auditResults.pageSpeedDesktop = desktopStats;
        log(`PageSpeed Desktop completed: Score ${desktopStats.score}/100`);
      }
    } catch (err: any) {
      pageSpeedDesktopError = err.message || 'Failed';
      log(`[WARN] PageSpeed Desktop audit failed: ${pageSpeedDesktopError}`);
    } finally {
      isFetchingDesktopSpeed = false;
      saveCrawlToHistory();
    }

    // Mobile speed audit
    isFetchingMobileSpeed = true;
    pageSpeedMobileError = '';
    log('Requesting Google PageSpeed Mobile report...');
    try {
      const mobileStats = await fetchPageSpeed(url, 'mobile', apiKey);
      if (auditResults) {
        auditResults.pageSpeedMobile = mobileStats;
        log(`PageSpeed Mobile completed: Score ${mobileStats.score}/100`);
      }
    } catch (err: any) {
      pageSpeedMobileError = err.message || 'Failed';
      log(`[WARN] PageSpeed Mobile audit failed: ${pageSpeedMobileError}`);
    } finally {
      isFetchingMobileSpeed = false;
      saveCrawlToHistory();
    }

    recalculateOverallScore();
    saveCrawlToHistory();
  }

  // Dynamic score updating based on checks (PageSpeed + Link statuses)
  function recalculateOverallScore() {
    if (!auditResults) return;
    
    let baseScore = auditResults.score;
    
    // Deduct for broken links
    const brokenLinks = auditResults.links.filter(l => l.statusState === 'broken').length;
    if (brokenLinks > 0) {
      baseScore -= Math.min(15, brokenLinks * 2); // subtract 2 points per broken link, max 15 points
    }

    // Average in PageSpeed metrics if available
    let performanceSum = 0;
    let perfCounts = 0;
    if (auditResults.pageSpeedDesktop) {
      performanceSum += auditResults.pageSpeedDesktop.score;
      perfCounts++;
    }
    if (auditResults.pageSpeedMobile) {
      performanceSum += auditResults.pageSpeedMobile.score;
      perfCounts++;
    }

    if (perfCounts > 0) {
      const avgPerformance = performanceSum / perfCounts;
      // SEO audit represents 60% of total score, performance represents 40%
      baseScore = Math.round((baseScore * 0.6) + (avgPerformance * 0.4));
    }

    auditResults.score = Math.max(0, Math.min(100, baseScore));
    auditResults.grade = calculateGrade(auditResults.score);
  }

  // Executing user-entered SQL queries
  function runSQLQuery() {
    if (!auditResults) return;
    sqlError = '';
    const res = executeSQLQuery(sqlQuery, auditResults);
    if (res.error) {
      sqlError = res.error;
      sqlResult = null;
    } else {
      sqlResult = res;
    }
  }

  function setSampleQuery(queryText: string) {
    sqlQuery = queryText;
    runSQLQuery();
  }

  function exportQueryToCSV() {
    if (!sqlResult || sqlResult.rows.length === 0) return;
    
    const headers = sqlResult.columns.join(',');
    const rows = sqlResult.rows.map(row => 
      sqlResult!.columns.map(col => {
        const val = row[col] === null ? 'NULL' : row[col];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sql-query-results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handlePDFExport() {
    if (!auditResults) return;
    log('Generating branded PDF report...');
    exportSEOReport(auditResults);
    log('PDF Report downloaded.');
  }

  function jumpToSection(tabName: string, elementSelector?: string) {
    activeTab = tabName;
    if (elementSelector) {
      setTimeout(() => {
        const el = document.querySelector(elementSelector);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('jump-highlight');
          setTimeout(() => el.classList.remove('jump-highlight'), 2000);
        }
      }, 60);
    }
  }

  // Counts for visual badges
  const errorCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'missing' ? 1 : 0) +
    (auditResults.onPage.description.status === 'missing' ? 1 : 0) +
    (auditResults.onPage.headings.status === 'error' ? 1 : 0) +
    (auditResults.onPage.imageAlts.status === 'error' ? 1 : 0) +
    auditResults.links.filter(l => l.statusState === 'broken').length
  : 0);

  const warningCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'warning' ? 1 : 0) +
    (auditResults.onPage.description.status === 'warning' ? 1 : 0) +
    (auditResults.onPage.headings.status === 'warning' ? 1 : 0) +
    (auditResults.onPage.imageAlts.status === 'warning' ? 1 : 0) +
    (auditResults.onPage.canonical.status === 'missing' ? 1 : 0) +
    (auditResults.onPage.openGraph.status === 'missing' ? 1 : 0)
  : 0);

  const passedCount = $derived(auditResults ? 
    (auditResults.onPage.title.status === 'ok' ? 1 : 0) +
    (auditResults.onPage.description.status === 'ok' ? 1 : 0) +
    (auditResults.onPage.headings.status === 'ok' ? 1 : 0) +
    (auditResults.onPage.imageAlts.status === 'ok' ? 1 : 0) +
    (auditResults.onPage.canonical.status === 'ok' ? 1 : 0) +
    (auditResults.onPage.openGraph.status === 'ok' ? 1 : 0) +
    auditResults.links.filter(l => l.statusState === 'ok').length
  : 0);
</script>

<SEO path="" schema={homeSchema} />

<div class="dashboard-page">
  {#if !auditResults}
    <!-- Hero / URL Input section -->
    <section class="hero-section">
      <div class="container hero-container">
        <div class="hero-left">
          <h1 class="display-md">High-Performance <span class="highlight-text">SEO Engine</span></h1>
          <p class="hero-sub">Analyze metadata, crawl link maps, run Core Web Vitals audits, and write client-side SQL queries to inspect results.</p>
          
          <!-- Search panel -->
          <div class="search-panel">
            <div class="search-box">
              <input 
                type="text" 
                class="search-input" 
                placeholder="Enter website URL (e.g. svelte.dev)" 
                bind:value={targetUrl}
                onkeydown={(e) => e.key === 'Enter' && handleScan()}
                disabled={isScanning}
              />
              <button class="btn btn-primary search-btn" onclick={handleScan} disabled={isScanning}>
                {#if isScanning}Scanning...{:else}Scan Target{/if}
              </button>
            </div>
            
            <!-- Quick settings disclosure -->
            <div class="settings-drawer card-dark">
              <h3 class="title-sm">Audit Configurations</h3>
              <div class="settings-grid">
                <div class="field proxy-field-group">
                  <div class="proxy-select-wrap">
                    <label for="proxy-select">CORS Proxy Choice</label>
                    <select id="proxy-select" class="text-input select-input" bind:value={selectedProxy}>
                      <option value="https://corsproxy.io/?url=">CORSProxy.io (Recommended)</option>
                      <option value="https://api.allorigins.win/raw?url=">AllOrigins (Raw)</option>
                      <option value="custom">Custom Proxy...</option>
                    </select>
                  </div>
                  {#if selectedProxy === 'custom'}
                    <div class="proxy-input-wrap animate-fade-in">
                      <label for="proxy-input">Custom Proxy URL</label>
                      <input id="proxy-input" type="text" class="text-input" bind:value={proxyUrl} placeholder="e.g. https://myproxy.com/?url=" />
                    </div>
                  {/if}
                </div>
                <div class="field">
                  <label for="pagespeed-input">PageSpeed API Key (Optional)</label>
                  <input id="pagespeed-input" type="password" class="text-input" bind:value={apiKey} placeholder="Google Cloud API Key" />
                </div>
                <button class="btn btn-secondary save-btn" onclick={saveSettings}>Save Settings</button>
              </div>
            </div>
          </div>
        </div>
  
        <!-- Live logs console block -->
        <div class="hero-right">
          <div class="console-card">
            <div class="console-header">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
              <span class="console-title">AUDIT_LOG_STREAM // selectseo_auditor</span>
            </div>
            <div class="console-viewport">
              <canvas bind:this={canvasEl} class="console-canvas"></canvas>
              <div bind:this={consoleBodyEl} class="console-body">
                {#if scanLogs.length === 0}
                  <div class="empty-console">
                    <span class="prompt">$</span> ready for input...
                    <br />
                    <span class="prompt">$</span> settings stored in localstorage
                  </div>
                {:else}
                  {#each scanLogs as logline}
                    <div class="log-line">{logline}</div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- Recent Audits History Section (Visible if results are null) -->
  {#if !auditResults}
    <section class="history-section animate-fade-in">
      <div class="container">
        <div class="history-header">
          <h2 class="title-md font-mono text-primary">// RECENT_AUDIT_HISTORY</h2>
          <p class="history-subtitle text-muted">Restore previously crawled domains instantly from your browser's local cache.</p>
        </div>

        {#if crawlHistory.length === 0}
          <!-- Empty State -->
          <div class="history-empty card-dark text-center font-mono">
            <div class="empty-icon text-primary">⚡</div>
            <h3 class="title-sm mt-2 text-ink">NO RECENT SCANS DETECTED</h3>
            <p class="text-muted text-xs mt-1">Ready for input. Enter a website URL above and click "Scan Target" to compile your first audit report.</p>
          </div>
        {:else}
          <!-- History Grid List -->
          <div class="history-grid">
            {#each crawlHistory as item}
              <div class="history-item-card card-dark" role="button" tabindex="0" onclick={() => loadCrawlFromHistory(item)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && loadCrawlFromHistory(item)}>
                <div class="card-left">
                  <div class="score-badge" class:score-green={item.score >= 90} class:score-orange={item.score >= 70 && item.score < 90} class:score-red={item.score < 70}>
                    <span class="score-num">{item.score}</span>
                    <span class="score-grade">{item.grade}</span>
                  </div>
                  <div class="item-meta">
                    <h3 class="item-url font-mono">{item.url}</h3>
                    <span class="item-time text-muted">Audited: {new Date(item.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                <div class="card-right">
                  <div class="stats-pills">
                    <span class="pill pill-error">{item.errorCount} Errors</span>
                    <span class="pill pill-warning">{item.warningCount} Warnings</span>
                  </div>
                  <button class="delete-history-btn" onclick={(e) => deleteHistoryItem(item.url, e)} title="Remove from history">×</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Results Dashboard (Conditional render) -->
  {#if auditResults}
    <section class="results-section" id="overview">
      <div class="container">
        <!-- Executive Dashboard Banner -->
        <div class="stats-row">
          <!-- Grade Circle Ring -->
          <div class="card-dark grade-card">
            <div class="grade-ring-container">
              <svg class="progress-ring" width="120" height="120">
                <circle class="progress-ring-bg" stroke="#1f1f1f" stroke-width="8" fill="transparent" r="50" cx="60" cy="60" />
                <circle 
                  class="progress-ring-fill" 
                  stroke="var(--color-primary)" 
                  stroke-width="8" 
                  stroke-dasharray="314.16"
                  stroke-dashoffset={314.16 - (314.16 * auditResults.score) / 100}
                  fill="transparent" 
                  r="50" 
                  cx="60" 
                  cy="60" 
                />
              </svg>
              <div class="grade-text-overlay">
                <span class="grade-letter">{auditResults.grade}</span>
                <span class="grade-score">{auditResults.score}/100</span>
              </div>
            </div>
            <div class="grade-info">
              <h2 class="title-lg">Crawl Summary</h2>
              <p>Target: <span class="monotext">{auditResults.url}</span></p>
              <p class="scan-time">Checked: {new Date(auditResults.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>

          <!-- Quick Metrics widgets -->
          <div class="quick-metrics-grid">
            <div class="metric-card card-dark">
              <span class="metric-num text-error">{errorCount}</span>
              <span class="metric-label">CRITICAL ERRORS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-warning">{warningCount}</span>
              <span class="metric-label">WARNINGS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-success">{passedCount}</span>
              <span class="metric-label">PASSED AUDITS</span>
            </div>
            <div class="metric-card card-dark">
              <span class="metric-num text-blue">{auditResults.links.length}</span>
              <span class="metric-label">TOTAL LINKS</span>
            </div>
          </div>
        </div>

        <!-- Floating PDF Export Trigger -->
        <div class="action-banner card-dark">
          <div class="banner-text">
            <h3 class="title-md">SEO Audit Report Completed</h3>
            <p>Generate a technical PDF report containing all heading outlines, broken link details, and PageSpeed metrics.</p>
          </div>
          <button class="btn btn-primary" onclick={handlePDFExport}>Export PDF Report</button>
        </div>

        <!-- Primary Tabs navigation -->
        <div class="tabs-nav">
          <button class="tab-btn" class:active={activeTab === 'overview'} onclick={() => activeTab = 'overview'}>Overview</button>
          <button class="tab-btn" class:active={activeTab === 'ai-chat'} onclick={() => activeTab = 'ai-chat'}>✨ AI Chat</button>
          <button class="tab-btn" class:active={activeTab === 'onpage'} onclick={() => activeTab = 'onpage'}>On-Page SEO</button>
          <button class="tab-btn" class:active={activeTab === 'links'} onclick={() => activeTab = 'links'}>Links Auditor</button>
          <button class="tab-btn" class:active={activeTab === 'pagespeed'} onclick={() => activeTab = 'pagespeed'}>PageSpeed</button>
          <button class="tab-btn sql-tab-btn" class:active={activeTab === 'sql'} onclick={() => activeTab = 'sql'}>SQL Console</button>
        </div>

        <!-- TAB CONTENT: OVERVIEW -->
        {#if activeTab === 'overview'}
          <div class="tab-content" id="overview-content">
            <DashboardTab 
              {auditResults} 
              {isValidatingLinks} 
              {checkedLinksCount} 
              {totalLinksCount} 
              jumpToSection={jumpToSection}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: ON-PAGE DETAIL -->
        {#if activeTab === 'onpage'}
          <div class="tab-content" id="onpage-content">
            <OnPageTab {auditResults} />
          </div>
        {/if}

        <!-- TAB CONTENT: LINKS MAP -->
        {#if activeTab === 'links'}
          <div class="tab-content" id="links-content">
            <LinksTab 
              {auditResults} 
              {isValidatingLinks} 
              {checkedLinksCount} 
              {totalLinksCount}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: PAGESPEED -->
        {#if activeTab === 'pagespeed'}
          <div class="tab-content" id="pagespeed-content">
            <PageSpeedTab 
              {auditResults}
              {isFetchingMobileSpeed}
              {isFetchingDesktopSpeed}
              {pageSpeedMobileError}
              {pageSpeedDesktopError}
              triggerPageSpeedAudits={triggerPageSpeedAudits}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: SQL CONSOLE -->
        {#if activeTab === 'sql'}
          <div class="tab-content" id="sql-content">
            <SqlConsoleTab 
              {auditResults}
              bind:sqlQuery={sqlQuery}
              {sqlResult}
              {sqlError}
              runSQLQuery={runSQLQuery}
            />
          </div>
        {/if}

        <!-- TAB CONTENT: AI CHAT -->
        {#if activeTab === 'ai-chat'}
          <div class="tab-content" id="ai-chat-content">
            <AiChatTab {auditResults} />
          </div>
        {/if}

      </div>
    </section>
  {/if}


</div>

<style>
  .dashboard-page {
    padding-bottom: 64px;
    background-color: var(--color-canvas);
  }

  /* History Section styling */
  .history-section {
    padding: 48px 0;
  }

  .history-header {
    margin-bottom: var(--spacing-lg);
  }

  .history-subtitle {
    font-size: 14px;
    margin-top: 4px;
  }

  .history-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xxl) var(--spacing-xl);
    border: 1px dashed rgba(250, 255, 105, 0.2);
    border-radius: var(--rounded-lg);
  }

  .empty-icon {
    font-size: 32px;
    text-shadow: 0 0 10px rgba(250, 255, 105, 0.4);
    animation: pulse-glow 2s infinite ease-in-out;
  }

  @keyframes pulse-glow {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.08); opacity: 1; }
  }

  .history-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .history-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    background-color: rgba(26, 26, 26, 0.3) !important;
    border: 1px solid var(--color-hairline) !important;
    cursor: pointer;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--rounded-lg);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .history-item-card:hover {
    border-color: rgba(250, 255, 105, 0.35) !important;
    background-color: rgba(250, 255, 105, 0.02) !important;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  .card-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .score-badge {
    width: 50px;
    height: 50px;
    border-radius: var(--rounded-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    line-height: 1.1;
    border: 1px solid transparent;
    flex-shrink: 0;
  }

  .score-green {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: var(--color-success);
  }

  .score-orange {
    background-color: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: var(--color-warning);
  }

  .score-red {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: var(--color-error);
  }

  .score-num {
    font-size: 16px;
  }

  .score-grade {
    font-size: 9px;
    text-transform: uppercase;
    opacity: 0.8;
  }

  .item-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-url {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-on-dark);
    word-break: break-all;
    margin: 0;
  }

  .item-time {
    font-size: 12px;
    color: var(--color-muted);
  }

  .card-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .stats-pills {
    display: flex;
    gap: var(--spacing-xs);
  }

  .pill {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: var(--rounded-pill);
    font-family: var(--font-family-mono);
  }

  .pill-error {
    background-color: rgba(239, 68, 68, 0.08);
    color: var(--color-error);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .pill-warning {
    background-color: rgba(245, 158, 11, 0.08);
    color: var(--color-warning);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .delete-history-btn {
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 22px;
    cursor: pointer;
    line-height: 1;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--rounded-full);
    transition: all 0.15s ease;
  }

  .delete-history-btn:hover {
    color: var(--color-error);
    background-color: rgba(239, 68, 68, 0.1);
  }

  .hero-section {
    padding: 64px 0;
    border-bottom: 1px solid var(--color-hairline);
  }

  .hero-container {
    display: grid;
    grid-template-columns: 7fr 5fr;
    gap: var(--spacing-xxl);
    align-items: center;
  }

  .hero-left {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .highlight-text {
    color: var(--color-primary);
  }

  .hero-sub {
    font-size: 16px;
    color: var(--color-body);
    line-height: 1.6;
    max-width: 580px;
  }

  /* Search Panel & Config fields */
  .search-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
  }

  .search-box {
    display: flex;
    gap: var(--spacing-sm);
  }

  .search-input {
    flex: 1;
    background-color: var(--color-surface-card);
    border: 1px solid var(--color-hairline);
    border-radius: var(--rounded-md);
    padding: 12px 16px;
    font-size: 15px;
    color: var(--color-on-dark);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    border-color: var(--color-primary);
  }

  .search-btn {
    height: 48px;
    padding: 0 var(--spacing-lg);
  }

  .settings-drawer {
    padding: var(--spacing-md);
  }

  .settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-top: var(--spacing-xs);
  }

  .settings-grid label {
    font-size: 12px;
    color: var(--color-muted);
    font-weight: 600;
    text-transform: uppercase;
    margin-bottom: var(--spacing-xxs);
    display: block;
  }

  .text-input {
    background-color: var(--color-surface-soft);
    border: 1px solid var(--color-hairline);
    border-radius: var(--rounded-sm);
    color: var(--color-on-dark);
    padding: 8px 12px;
    outline: none;
    width: 100%;
    font-size: 14px;
  }

  .text-input:focus {
    border-color: var(--color-primary);
  }

  .save-btn {
    height: 38px;
  }

  /* Logs terminal window with Futuristic HUD style */
  /* Logs terminal window with Futuristic HUD style */
  .console-card {
    position: relative;
    background-color: rgba(10, 10, 15, 0.95); /* Sleek deep cyber black */
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(250, 255, 105, 0.25); /* Yellow border */
    border-radius: var(--rounded-lg);
    overflow: hidden;
    font-family: var(--font-family-mono);
    box-shadow: 
      0 0 30px rgba(250, 255, 105, 0.08),
      inset 0 0 25px rgba(0, 0, 0, 0.8);
  }

  .console-header {
    background-color: rgba(16, 16, 24, 0.95);
    padding: 10px var(--spacing-md);
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(250, 255, 105, 0.2);
    position: relative;
    z-index: 12;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.red { background-color: var(--color-error); box-shadow: 0 0 6px var(--color-error); }
  .dot.yellow { background-color: var(--color-warning); box-shadow: 0 0 6px var(--color-warning); }
  .dot.green { background-color: var(--color-success); box-shadow: 0 0 6px var(--color-success); }

  .console-title {
    font-size: 11px;
    color: rgba(250, 255, 105, 0.6);
    margin-left: 8px;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-weight: 600;
  }

  .console-viewport {
    position: relative;
    height: 240px;
    overflow: hidden;
  }

  .console-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
  }

  .console-body {
    position: relative;
    padding: var(--spacing-md);
    height: 100%;
    overflow-y: auto;
    font-size: 12px;
    color: var(--color-primary); /* Electric Cyber Yellow */
    line-height: 1.6;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-shadow: 0 0 5px rgba(250, 255, 105, 0.5); /* HUD text glow */
    animation: HUD-breathing 4s ease-in-out infinite;
    z-index: 11;
    background: transparent;
  }

  /* Sci-fi laser sweep line - starts inside the viewport below the top bar */
  .console-viewport::before {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--color-primary), transparent);
    box-shadow: 0 0 8px var(--color-primary), 0 0 15px var(--color-primary);
    animation: laser-sweep 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    pointer-events: none;
    z-index: 13;
  }

  /* Sci-fi Tech corners overlay for the viewport content */
  .console-viewport::after {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: 
      /* Curved vignette border shading */
      radial-gradient(circle, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 0.4) 100%),
      /* Top-Left Corner */
      linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 0,
      linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 0 0,
      /* Top-Right Corner */
      linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 0,
      linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 100% 0,
      /* Bottom-Left Corner */
      linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 100%,
      linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 0 100%,
      /* Bottom-Right Corner */
      linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 100%,
      linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 100% 100%;
    background-size: 100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 14;
    opacity: 0.75;
  }

  /* HUD Animations */
  @keyframes HUD-breathing {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 0px rgba(250, 255, 105, 0)); }
    50% { filter: brightness(1.08) drop-shadow(0 0 2px rgba(250, 255, 105, 0.25)); }
  }

  @keyframes laser-sweep {
    0% { top: 0%; opacity: 0; }
    5% { opacity: 1; }
    95% { opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }

  .empty-console {
    color: rgba(250, 255, 105, 0.5);
    text-shadow: 0 0 3px rgba(250, 255, 105, 0.2);
  }

  .prompt {
    color: var(--color-primary); /* match yellow primary theme */
    font-weight: bold;
    text-shadow: 0 0 5px rgba(250, 255, 105, 0.5);
  }

  /* Results dashboard layout */
  .results-section {
    padding: 64px 0;
  }

  .stats-row {
    display: grid;
    grid-template-columns: 5fr 7fr;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
  }

  /* Grade summary scorecard */
  .grade-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
  }

  .grade-ring-container {
    position: relative;
    width: 120px;
    height: 120px;
  }

  .progress-ring-fill {
    transform: rotate(-90deg);
    transform-origin: 60px 60px;
    transition: stroke-dashoffset 0.35s;
  }

  .grade-text-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .grade-letter {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-ink);
    line-height: 1;
  }

  .grade-score {
    font-size: 11px;
    color: var(--color-muted);
    margin-top: 4px;
    font-family: var(--font-family-mono);
  }

  .grade-info p {
    font-size: 14px;
    color: var(--color-muted);
    margin-top: 4px;
  }

  .grade-info .scan-time {
    font-size: 12px;
    font-family: var(--font-family-mono);
  }

  .monotext {
    font-family: var(--font-family-mono);
  }

  /* Quick statistics widgets */
  .quick-metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-md);
  }

  .metric-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: var(--spacing-lg);
  }

  .metric-num {
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
    font-family: var(--font-family-sans);
  }

  .metric-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-muted);
    letter-spacing: 1px;
    margin-top: var(--spacing-xs);
  }

  .text-success { color: var(--color-success); }
  .text-warning { color: var(--color-warning); }
  .text-error { color: var(--color-error); }
  .text-blue { color: var(--color-accent-blue); }

  /* PDF export action bar */
  .action-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg) var(--spacing-xl);
    margin-bottom: var(--spacing-xxl);
    border-left: 4px solid var(--color-primary);
  }

  .banner-text p {
    font-size: 14px;
    color: var(--color-muted);
    margin-top: var(--spacing-xxs);
  }

  /* Primary tab layout selectors */
  .tabs-nav {
    display: flex;
    gap: var(--spacing-xs);
    border-bottom: 1px solid var(--color-hairline);
    margin-bottom: var(--spacing-xl);
  }

  .tab-btn {
    background: transparent;
    border: none;
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 600;
    padding: 12px 20px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--color-ink);
  }

  .tab-btn.active {
    color: var(--color-ink);
    border-bottom-color: var(--color-primary);
  }

  .sql-tab-btn {
    font-family: var(--font-family-mono);
    color: var(--color-primary);
  }

  .tab-content {
    animation: fadeIn 0.2s ease-in-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sect-title {
    margin-bottom: var(--spacing-lg);
  }

  /* Checklist grid details */
  .checklist-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-lg);
  }

  .checklist-item {
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .item-head {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .item-desc {
    font-size: 14px;
    color: var(--color-body);
  }

  .code-fragment {
    background-color: #030303;
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--rounded-xs);
    border: 1px solid var(--color-hairline);
    font-family: var(--font-family-mono);
    font-size: 12px;
    overflow-x: auto;
    color: #e6e6e6;
  }

  .tags-badge-row {
    display: flex;
    gap: var(--spacing-xs);
  }

  /* Border color helper class names */
  .border-left {
    border-left-width: 4px !important;
  }
  .border-success { border-left-color: var(--color-success); }
  .border-warning { border-left-color: var(--color-warning); }
  .border-error { border-left-color: var(--color-error); }

  /* ON-PAGE SUBPANELS */
  .onpage-detail-rows {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .detail-card-title {
    margin-bottom: var(--spacing-md);
  }

  .heading-tree {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    font-family: var(--font-family-mono);
    font-size: 13px;
  }

  .tree-item {
    background-color: var(--color-surface-soft);
    padding: 8px var(--spacing-md);
    border-left: 2px solid var(--color-muted-soft);
    border-radius: 0 var(--rounded-xs) var(--rounded-xs) 0;
  }

  .tree-tag {
    color: var(--color-primary);
    font-weight: bold;
    margin-right: 8px;
  }

  .tree-h1 { border-left-color: var(--color-primary); }
  .tree-h2 { margin-left: var(--spacing-md); }
  .tree-h3 { margin-left: var(--spacing-xxl); }

  .schema-summary {
    font-size: 14px;
    margin-bottom: var(--spacing-sm);
  }

  .schema-badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }

  /* DATATABLE CUSTOM DESIGNS */
  .content-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }

  .table-container {
    width: 100%;
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
  }

  .data-table th, .data-table td {
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-hairline);
  }

  .data-table th {
    color: var(--color-ink);
    font-weight: 600;
    background-color: var(--color-surface-soft);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
  }

  .data-table tbody tr:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .url-cell {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .anchor-text-cell {
    font-weight: 500;
    color: var(--color-on-dark);
  }

  .truncated-cell {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* PageSpeed stats styles */
  .pagespeed-cards-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
  }

  .pagespeed-card {
    padding: var(--spacing-xl);
  }

  .card-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-xl);
  }

  .score-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .score-display {
    font-size: 48px;
    font-weight: 700;
    line-height: 1;
  }

  .score-desc {
    font-size: 13px;
    color: var(--color-muted);
  }

  .vitals-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-xl);
  }

  .vital-item {
    background-color: var(--color-surface-soft);
    padding: var(--spacing-md);
    border-radius: var(--rounded-md);
    border: 1px solid var(--color-hairline);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .vital-label {
    font-size: 11px;
    color: var(--color-muted);
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .vital-val {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-ink);
  }

  .rec-section h4 {
    font-size: 12px;
    color: var(--color-muted);
    text-transform: uppercase;
    margin-bottom: var(--spacing-md);
    letter-spacing: 0.5px;
  }

  .rec-section ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .rec-section li {
    font-size: 13px;
    padding: 8px var(--spacing-md);
    background-color: var(--color-surface-soft);
    border-radius: var(--rounded-xs);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-left: 2px solid var(--color-warning);
  }

  .rec-title {
    color: var(--color-on-dark);
  }

  /* SQL Client Console Workspace styles */
  .sql-workspace {
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .sample-queries-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    align-items: center;
  }

  .row-label {
    font-size: 12px;
    color: var(--color-muted);
    font-weight: bold;
    margin-right: 4px;
  }

  .preset-btn {
    background-color: var(--color-surface-soft);
    border: 1px solid var(--color-hairline);
    color: var(--color-muted);
    font-family: var(--font-family-mono);
    font-size: 11px;
    padding: 4px 8px;
    border-radius: var(--rounded-xs);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .preset-btn:hover {
    color: var(--color-primary);
    border-color: var(--color-primary-disabled);
  }

  .sql-input-box {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background-color: #030303;
    border: 1px solid var(--color-hairline-strong);
    border-radius: var(--rounded-md);
    padding: 8px var(--spacing-md);
  }

  .terminal-prefix {
    font-family: var(--font-family-mono);
    font-size: 14px;
    color: var(--color-primary);
    font-weight: bold;
    white-space: nowrap;
  }

  .sql-input {
    flex: 1;
    background: none;
    border: none;
    font-family: var(--font-family-mono);
    font-size: 14px;
    color: var(--color-on-dark);
    outline: none;
  }

  .run-query-btn {
    height: 36px;
    font-size: 13px;
  }

  .sql-error-block {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-error);
    padding: var(--spacing-md);
    border-radius: var(--rounded-xs);
    font-family: var(--font-family-mono);
    font-size: 13px;
  }

  .error-prefix {
    font-weight: bold;
  }

  .sql-results-card {
    padding: var(--spacing-xl);
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .results-meta {
    font-size: 13px;
    color: var(--color-muted);
    font-weight: normal;
  }

  .font-mono {
    font-family: var(--font-family-mono);
  }

  .sql-data-table th {
    background-color: #070707;
  }

  .sql-cell {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ml-2 { margin-left: 8px; }

  /* Responsive collapses */
  @media (max-width: 1024px) {
    .hero-container {
      grid-template-columns: 1fr;
    }
    .stats-row {
      grid-template-columns: 1fr;
    }
    .pagespeed-cards-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .checklist-grid {
      grid-template-columns: 1fr;
    }
    .settings-grid {
      grid-template-columns: 1fr;
    }
    .action-banner {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-md);
    }
  }

  .proxy-field-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
  }

  .proxy-select-wrap, .proxy-input-wrap {
    width: 100%;
  }

  .select-input {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 14px;
    padding-right: 36px;
    cursor: pointer;
  }

  .select-input option {
    background-color: var(--color-surface-card);
    color: var(--color-on-dark);
  }

  .animate-fade-in {
    animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

</style>
