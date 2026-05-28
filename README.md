# SelectSEO Auditor

High-performance, developer-first SEO scanner, auditor, and analysis panel running entirely in your browser. Powered by SvelteKit, SQLite (via `sql.js`), and Cloudflare Workers.

## 🚀 Features

- **Local SQLite Engine:** Your crawl history, page performance, and audit records are saved locally inside an in-browser SQLite database. No tracking, completely private.
- **On-Page SEO Auditing:** Automated checking of headings hierarchy, meta descriptions, image alt tags, canonical links, open graph tags, and key indexing issues.
- **CORS Scraper Proxy:** Built-in Cloudflare Worker CORS proxy to safely fetch website source code directly from the browser.
- **Interactive SQL Console:** Directly run raw SQL queries against your local crawler database to analyze audit reports and extract custom data.
- **AI Chat Auditor:** Interactive chatbot interface to audit and query your pages with AI guidance.
- **PDF Report Exporter:** Export comprehensive, beautifully formatted PDF audit reports of your website's SEO health.
- **PageSpeed & Link Analysis:** Analyzes internal/external link networks and core performance metrics.

---

## 🛠️ Tech Stack

- **Frontend:** [SvelteKit](https://kit.svelte.dev/) (Static Adapter)
- **Database:** [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly)
- **Styling:** Vanilla CSS (Dark mode optimized, HSL-based branding system)
- **Proxy Scraper:** [Cloudflare Workers](https://workers.cloudflare.com/)

---

## 💻 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or your preferred package manager

### Installation

1. Clone the repository:

   ```bash
   git clone git@github.com:foxy17/selectseo.git
   cd selectseo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev -- --open
   ```

### Building for Production

To create a static production bundle:

```bash
npm run build
```

The output will be placed in the `build/` directory, ready to be hosted on any static hosting provider (e.g., GitHub Pages, Cloudflare Pages, Netlify).

---

## ☁️ Cloudflare Worker Scraper Setup

The CORS proxy scraper code is located in the `cloudflare-worker/` directory.

To deploy the scraper proxy to your own Cloudflare account:

1. Make sure you have the [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated.
2. Initialize wrangler inside `cloudflare-worker/`:
   ```bash
   cd cloudflare-worker
   npx wrangler deploy
   ```

---

## 🔧 GitHub Actions Deployment

This repository includes a GitHub Actions workflow to automatically build and deploy your main branch to GitHub Pages.

To enable deployment:

1. Go to your repository settings on GitHub: **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Push your code to the `main` branch, and the deployment workflow will trigger automatically.
