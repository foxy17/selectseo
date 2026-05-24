<script lang="ts">
  import '../index.css';
  import logo from '$lib/assets/logo.webp';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { appState } from '$lib/sharedState.svelte';

  let { children } = $props();

  function triggerNewCrawl() {
    if (page.url.pathname !== '/') {
      goto('/');
    } else {
      window.dispatchEvent(new CustomEvent('new-crawl'));
    }
  }
</script>

<svelte:head>
  <link rel="icon" href={logo} type="image/webp" />
</svelte:head>

<div class="app-layout">
  <!-- Top Navigation Bar -->
  <header class="top-nav">
    <div class="nav-container">
      <a href="/" class="brand-link">
        <div class="nav-left">
          <!-- Brand logo inline SVG -->
          <div class="logo-container">
            <img src={logo} alt="SelectSEO Logo" class="nav-logo-webp" width="28" height="28" />
          </div>
          <span class="nav-title">SelectSEO <span class="nav-subtitle">Auditor</span></span>
        </div>
      </a>

      <nav class="nav-center">
        <a href="/" class="nav-link" class:active={page.url.pathname === '/'}>Home</a>
        <a href="/what-this-does/" class="nav-link" class:active={page.url.pathname.startsWith('/what-this-does')}>What this does</a>
        <a href="/how-to-use/" class="nav-link" class:active={page.url.pathname.startsWith('/how-to-use')}>How to use</a>
        <a href="/faq/" class="nav-link" class:active={page.url.pathname.startsWith('/faq')}>FAQ</a>
      </nav>

      <div class="nav-right">
        {#if appState.hasResults}
          <button class="btn-new-crawl font-mono" onclick={triggerNewCrawl} title="Start a new website scan">
            <svg class="new-crawl-icon" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            New Crawl
          </button>
        {/if}
        <span class="status-indicator">
          <span class="indicator-dot"></span>
          Proxy Online
        </span>
      </div>
    </div>
  </header>

  <!-- Main Content Wrapper -->
  <main class="main-content">
    {@render children()}
  </main>

  <!-- Brand Footer -->
  <footer class="footer">
    <div class="footer-container">
      <div class="footer-left">
        <a href="/" class="brand-link">
          <div class="footer-brand-wrap">
            <div class="logo-container">
              <img src={logo} alt="SelectSEO Logo" class="nav-logo-webp" width="28" height="28" />
            </div>
            <span class="footer-brand">SelectSEO Auditor</span>
          </div>
        </a>
        <p class="footer-desc">High-performance, developer-first SEO scanner and analysis panel running entirely in your browser.</p>
      </div>
      <div class="footer-grid">
        <div class="footer-col">
          <h4>Auditor Features</h4>
          <ul>
            <li><a href="/#overview">Overview Dashboard</a></li>
            <li><a href="/#onpage-content">On-Page SEO</a></li>
            <li><a href="/#links-content">Links Auditor</a></li>
            <li><a href="/#pagespeed-content">PageSpeed Vitals</a></li>
            <li><a href="/#sql-content">Client-side SQL</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Information</h4>
          <ul>
            <li><a href="/what-this-does/">What this does</a></li>
            <li><a href="/how-to-use/">How to use</a></li>
            <li><a href="/faq/">FAQ</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Developer</h4>
          <ul>
            <li><a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a></li>
            <li><a href="https://github.com" target="_blank" rel="noreferrer">Documentation</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Other Stuff I Built</h4>
          <ul>
            <li><a href="https://carnav.in" target="_blank" rel="noopener">blog website</a></li>
            <li><a href="https://testmyiframe.in" target="_blank" rel="noopener">I-Frame testing</a></li>
          </ul>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 selectseo.in. Built with SvelteKit. Apache-2.0 Licensed.</span>
    </div>
  </footer>
</div>

<style>
  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--color-canvas);
  }

  .top-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    height: 64px;
    background-color: var(--color-canvas);
    border-bottom: 1px solid var(--color-hairline);
    display: flex;
    align-items: center;
  }

  .nav-container {
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  /* Brand logo inline SVG styling */
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .nav-logo-webp {
    display: block;
    border-radius: var(--rounded-xs);
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), filter 0.25s ease;
  }

  .logo-container:hover .nav-logo-webp {
    transform: scale(1.08) rotate(3deg);
    filter: drop-shadow(0 0 8px rgba(250, 255, 105, 0.3));
  }

  .nav-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-ink);
    letter-spacing: -0.5px;
  }

  .nav-subtitle {
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-center {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .nav-link {
    color: var(--color-muted);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .nav-link:hover {
    color: var(--color-ink);
  }

  .nav-right {
    display: flex;
    align-items: center;
  }

  .btn-new-crawl {
    margin-right: var(--spacing-md);
    background-color: var(--color-primary);
    color: var(--color-on-primary);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    height: 32px;
    padding: 0 var(--spacing-sm);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--rounded-md);
    border: none;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(250, 255, 105, 0.15);
    transition: all 0.15s ease;
  }

  .btn-new-crawl:hover {
    background-color: var(--color-primary-active);
    box-shadow: 0 0 15px rgba(250, 255, 105, 0.35);
  }

  .new-crawl-icon {
    display: inline-block;
    flex-shrink: 0;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-body);
    font-family: var(--font-family-mono);
    border: 1px solid var(--color-hairline);
    padding: 4px 10px;
    border-radius: var(--rounded-pill);
    background-color: var(--color-surface-soft);
  }

  .indicator-dot {
    width: 6px;
    height: 6px;
    background-color: var(--color-accent-emerald);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--color-accent-emerald);
  }

  .main-content {
    flex: 1 0 auto;
  }

  /* Footer */
  .footer {
    border-top: 1px solid var(--color-hairline);
    background-color: var(--color-canvas);
    padding: 64px 0 32px 0;
    color: var(--color-muted);
    flex-shrink: 0;
  }

  .footer-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--spacing-lg);
    display: grid;
    grid-template-columns: 2fr 3fr;
    gap: var(--spacing-xxl);
  }

  .footer-left {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .footer-brand {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-ink);
    letter-spacing: -0.3px;
  }

  .footer-desc {
    font-size: 14px;
    line-height: 1.6;
    max-width: 320px;
  }

  .footer-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--spacing-xl);
  }

  .brand-link {
    text-decoration: none;
    color: inherit;
  }

  .footer-brand-wrap {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .nav-link.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .footer-col h4 {
    color: var(--color-ink);
    font-size: 14px;
    margin-bottom: var(--spacing-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .footer-col ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .footer-col a {
    color: var(--color-muted);
    font-size: 14px;
    text-decoration: none;
  }

  .footer-col a:hover {
    color: var(--color-ink);
  }

  .footer-bottom {
    max-width: 1280px;
    margin: var(--spacing-xxl) auto 0 auto;
    padding: var(--spacing-lg) var(--spacing-lg) 0 var(--spacing-lg);
    border-top: 1px solid var(--color-hairline);
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: var(--color-muted-soft);
  }

  @media (max-width: 768px) {
    .nav-center {
      display: none;
    }
    .footer-container {
      grid-template-columns: 1fr;
      gap: var(--spacing-xl);
    }
    .footer-desc {
      max-width: 100%;
    }
  }
</style>
