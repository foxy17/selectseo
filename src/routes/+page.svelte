<script lang="ts">
  import { onMount } from 'svelte';
  import { initSqlEngine } from '$lib/sqlEngine';
  import SEO from '$lib/components/SEO.svelte';
  import { appState } from '$lib/sharedState.svelte';
  import { goto } from '$app/navigation';

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
  
  let scanLogs = $state<string[]>([]);
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

  // Reset layout shared state on landing page
  $effect(() => {
    appState.hasResults = false;
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

  function deleteHistoryItem(url: string, event: Event) {
    event.stopPropagation();
    const updated = crawlHistory.filter(item => item.url !== url);
    localStorage.setItem('seo_crawl_history', JSON.stringify(updated));
    crawlHistory = updated;
  }

  function loadCrawlFromHistory(item: any) {
    goto(`/crawl-detail/${item.url}`);
  }

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

  // Persistence using localstorage on mount
  onMount(() => {
    loadCrawlHistory();
    
    // Check if new-crawl event triggered to reset input fields
    const handleNewCrawl = () => {
      targetUrl = '';
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

  // Handle Scan Navigation Route
  function handleScan() {
    if (!targetUrl) return;
    
    let urlToScan = targetUrl.trim();
    if (!/^https?:\/\//i.test(urlToScan)) {
      urlToScan = 'https://' + urlToScan;
    }

    goto(`/crawl-detail/${urlToScan}`);
  }
</script>

<SEO path="" schema={homeSchema} />

<div class="dashboard-page">
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
            />
            <button class="btn btn-primary search-btn font-mono" onclick={handleScan}>
              Scan Target
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
              <button class="btn btn-secondary save-btn font-mono" onclick={saveSettings}>Save Settings</button>
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

  <!-- Recent Audits History Section -->
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
</div>

<style>
  .dashboard-page {
    padding-bottom: 80px;
  }

  .history-section {
    padding: 64px 0;
  }

  .history-header {
    margin-bottom: var(--spacing-xl);
  }

  .history-subtitle {
    margin-top: var(--spacing-xs);
    font-size: 14px;
  }

  .history-empty {
    padding: var(--spacing-xxl) var(--spacing-lg);
  }

  .empty-icon {
    font-size: 32px;
  }

  .history-grid {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .history-item-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--rounded-lg);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
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

  .console-card {
    position: relative;
    background-color: rgba(10, 10, 15, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(250, 255, 105, 0.25);
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
    color: var(--color-primary);
    line-height: 1.6;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-shadow: 0 0 5px rgba(250, 255, 105, 0.5);
    animation: HUD-breathing 4s ease-in-out infinite;
    z-index: 11;
    background: transparent;
  }

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

  .console-viewport::after {
    content: " ";
    display: block;
    position: absolute;
    top: 0; left: 0; bottom: 0; right: 0;
    background: 
      radial-gradient(circle, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 0.4) 100%),
      linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 0,
      linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 0 0,
      linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 0,
      linear-gradient(to bottom, var(--color-primary) 2px, transparent 2px) 100% 0,
      linear-gradient(to right, var(--color-primary) 2px, transparent 2px) 0 100%,
      linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 0 100%,
      linear-gradient(to left, var(--color-primary) 2px, transparent 2px) 100% 100%,
      linear-gradient(to top, var(--color-primary) 2px, transparent 2px) 100% 100%;
    background-size: 100% 100%, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px, 8px 8px;
    background-repeat: no-repeat;
    pointer-events: none;
    z-index: 14;
    opacity: 0.75;
  }

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
    color: var(--color-primary);
    font-weight: bold;
    text-shadow: 0 0 5px rgba(250, 255, 105, 0.5);
  }

  @media (max-width: 1024px) {
    .hero-container {
      grid-template-columns: 1fr;
      gap: var(--spacing-xl);
    }
  }

  @media (max-width: 768px) {
    .settings-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
