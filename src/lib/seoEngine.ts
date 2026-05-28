export interface TitleAudit {
  text: string;
  length: number;
  status: 'ok' | 'warning' | 'error' | 'missing';
  message: string;
}

export interface DescriptionAudit {
  text: string;
  length: number;
  status: 'ok' | 'warning' | 'error' | 'missing';
  message: string;
}

export interface HeadingAudit {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
  status: 'ok' | 'warning' | 'error';
  message: string;
}

export interface CanonicalAudit {
  url: string;
  status: 'ok' | 'warning' | 'error' | 'missing';
  message: string;
}

export interface ImageAltDetail {
  src: string;
  alt: string;
  isMissing: boolean;
}

export interface ImageAltsAudit {
  total: number;
  missing: number;
  details: ImageAltDetail[];
  status: 'ok' | 'warning' | 'error';
  message: string;
}

export interface OpenGraphAudit {
  title: string;
  description: string;
  image: string;
  type: string;
  status: 'ok' | 'missing';
  message: string;
}

export interface TwitterCardAudit {
  card: string;
  title: string;
  description: string;
  image: string;
  status: 'ok' | 'missing';
  message: string;
}

export interface GenericAudit {
  status: 'ok' | 'warning' | 'error' | 'missing';
  message: string;
}

export interface AIDiscoverabilityAudit {
  score: number;
  grade: string;
  qaFormatting: GenericAudit;
  scannability: GenericAudit;
  semanticHtml: GenericAudit;
  targetSchema: GenericAudit;
  robotsTxtAi: GenericAudit;
}

export interface ContentMetrics {
  wordCount: number;
  contentRatio: number;
  readingLevel: string;
  language: string;
}

export interface HreflangItem {
  hreflang: string;
  href: string;
}

export interface OnPageSEOResults {
  title: TitleAudit;
  description: DescriptionAudit;
  headings: HeadingAudit;
  canonical: CanonicalAudit;
  imageAlts: ImageAltsAudit;
  openGraph: OpenGraphAudit;
  twitterCard: TwitterCardAudit;
  contentMetrics: ContentMetrics;
  viewport: string;
  charset: string;
  favicon: string;
  hreflangs: HreflangItem[];
  robots: string;
  schemaTypes: string[];
  schemas: Array<{ type: string; code: string }>;
  htmlSize: number;
  viewportAudit: GenericAudit;
  languageAudit: GenericAudit;
  robotsMetaAudit: GenericAudit;
  faviconAudit: GenericAudit;
}

export interface LinkItem {
  id: number;
  href: string;
  text: string;
  isExternal: boolean;
  isSecure: boolean;
  status: number | null;
  statusText: string | null;
  statusState: 'pending' | 'checking' | 'ok' | 'broken';
  rel: string;
  responseTime: number | null; // in ms
  redirectDestination: string | null;
}

/** Minimal subset of a Lighthouse audit object actually read by this app. */
interface LighthouseAudit {
  id?: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  details?: { type?: string; overallSavingsMs?: number };
}

/** Minimal subset of the Lighthouse result actually read by this app. */
interface LighthouseResult {
  categories: { performance?: { score: number | null } };
  audits: Record<string, LighthouseAudit>;
}

/** Minimal subset of the PageSpeed Insights API response actually read by this app. */
interface PageSpeedApiResponse {
  lighthouseResult?: LighthouseResult;
}

export interface PageSpeedMetric {
  score: number; // 0 to 100
  lcp: string; // Largest Contentful Paint
  tbt: string; // Total Blocking Time
  cls: string; // Cumulative Layout Shift
  fcp: string; // First Contentful Paint
  speedIndex: string;
  ttfb?: string; // Time to First Byte
  passedAudits?: string[];
  recommendations: Array<{ title: string; description: string; displayValue?: string; impact?: number }>;
}

export interface AuditResults {
  url: string;
  timestamp: string;
  onPage: OnPageSEOResults;
  links: LinkItem[];
  pageSpeedMobile: PageSpeedMetric | null;
  pageSpeedDesktop: PageSpeedMetric | null;
  aiDiscoverability: AIDiscoverabilityAudit;
  score: number; // Overall SEO Score 0-100
  grade: string; // Overall Grade e.g. A+, B, F
}

/**
 * Normalizes URL relative paths relative to target base URL
 */
function normalizeUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/**
 * Helper to build correct proxy url. Detects if proxyUrl already ends with or contains 'url='
 */
export function buildProxyFetchUrl(proxyUrl: string, targetUrl: string): string {
  if (!proxyUrl) return targetUrl;
  
  // If the proxy URL already ends with a parameter pattern e.g. "url=" or "q="
  if (/[?&]\w+=$/.test(proxyUrl)) {
    return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
  }
  
  // If the proxy URL already contains "url=" or other query parameters
  if (proxyUrl.includes('url=')) {
    return proxyUrl;
  }
  
  const separator = proxyUrl.includes('?') ? '&' : '?';
  return `${proxyUrl}${separator}url=${encodeURIComponent(targetUrl)}`;
}

/**
 * fetch wrapper that aborts after `timeoutMs`. If the caller passes its own
 * AbortSignal in `init`, the request aborts when EITHER the timeout fires or
 * the external signal aborts. On timeout the returned promise rejects with the
 * abort error.
 */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Wire any caller-provided signal so it also aborts the internal controller.
  const externalSignal = init.signal;
  let onExternalAbort: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      onExternalAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort);
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

/**
 * Calculates letter grade based on numeric score
 */
export function calculateGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 60) return 'D';
  return 'F';
}

function getVisibleText(doc: Document): string {
  const clone = doc.cloneNode(true) as Document;
  const scripts = clone.querySelectorAll('script, style, noscript, iframe, svg, canvas, header, footer, nav');
  scripts.forEach(el => el.remove());
  return clone.body ? clone.body.textContent || '' : '';
}

function estimateReadingLevel(text: string): string {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 'N/A';
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  let syllableCount = 0;
  words.forEach(word => {
    const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanWord.length <= 3) {
      syllableCount += 1;
      return;
    }
    const vowelGroups = cleanWord.match(/[aeiouy]+/g);
    let count = vowelGroups ? vowelGroups.length : 1;
    if (cleanWord.endsWith('e')) count--;
    if (cleanWord.endsWith('es')) count--;
    if (cleanWord.endsWith('ed')) count--;
    syllableCount += Math.max(1, count);
  });
  const wordCount = words.length;
  const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  const score = Math.round(grade);
  if (score <= 5) return 'Easy (5th Grade or below)';
  if (score <= 8) return 'Average (6th-8th Grade)';
  if (score <= 12) return 'Medium (High School)';
  return 'Difficult (College/Graduate)';
}

/**
 * Runs SEO Audit on target page
 */
export async function runSEOAudit(
  targetUrl: string,
  proxyUrl: string,
  onProgress: (message: string) => void
): Promise<AuditResults> {
  onProgress('Initiating crawl through CORS proxy...');
  
  const response = await fetchWithTimeout(buildProxyFetchUrl(proxyUrl, targetUrl), {}, 10000);
  if (!response.ok) {
    throw new Error(`Failed to crawl URL: ${response.status} ${response.statusText}`);
  }

  const finalUrl = response.headers.get('X-Final-Url') || targetUrl;
  const htmlText = await response.text();
  const htmlSize = htmlText.length;
  
  onProgress(`Crawl complete (${(htmlSize / 1024).toFixed(1)} KB). Parsing DOM...`);
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // AI: robots.txt check
  onProgress('Checking robots.txt for AI bots...');
  let robotsTxtAi: GenericAudit = { status: 'ok', message: 'No AI bots explicitly blocked in robots.txt.' };
  try {
    const parsedUrl = new URL(targetUrl);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;
    const robotsRes = await fetchWithTimeout(buildProxyFetchUrl(proxyUrl, robotsUrl), {}, 5000);
    if (robotsRes.ok) {
      const robotsContent = await robotsRes.text();
      const lowerRobots = robotsContent.toLowerCase();
      if (lowerRobots.includes('user-agent: gptbot') || 
          lowerRobots.includes('user-agent: chatgpt-user') || 
          lowerRobots.includes('user-agent: oai-searchbot') || 
          lowerRobots.includes('user-agent: google-extended') || 
          lowerRobots.includes('user-agent: perplexitybot') ||
          lowerRobots.includes('user-agent: anthropic-ai')) {
        
        if (lowerRobots.includes('disallow: /')) {
           robotsTxtAi = { status: 'warning', message: 'robots.txt appears to block one or more AI crawlers (e.g. GPTBot, Google-Extended, PerplexityBot). This prevents inclusion in some AI chat results.' };
        }
      }
    } else {
      robotsTxtAi = { status: 'ok', message: 'robots.txt not found or unreachable, assuming AI bots are allowed.' };
    }
  } catch {
    robotsTxtAi = { status: 'warning', message: 'Failed to fetch robots.txt to verify AI crawler permissions.' };
  }

  // 1. Audit Title
  onProgress('Analyzing meta tags...');
  const titleEl = doc.querySelector('title');
  const titleText = titleEl ? titleEl.textContent?.trim() || '' : '';
  const titleLength = titleText.length;
  let titleStatus: TitleAudit['status'] = 'ok';
  let titleMessage = 'Title tag is present and well-formed.';
  
  if (titleLength === 0) {
    titleStatus = 'missing';
    titleMessage = 'Title tag is missing or empty. Crucial for SEO!';
  } else if (titleLength < 30) {
    titleStatus = 'warning';
    titleMessage = `Title is too short (${titleLength} chars). Aim for 50-60 characters.`;
  } else if (titleLength > 60) {
    titleStatus = 'warning';
    titleMessage = `Title is too long (${titleLength} chars). Aim for 50-60 characters to avoid truncation.`;
  }

  const titleAudit: TitleAudit = { text: titleText, length: titleLength, status: titleStatus, message: titleMessage };

  // 2. Audit Description
  const descEl = doc.querySelector('meta[name="description"]');
  const descText = descEl ? descEl.getAttribute('content')?.trim() || '' : '';
  const descLength = descText.length;
  let descStatus: DescriptionAudit['status'] = 'ok';
  let descMessage = 'Meta description is present and well-proportioned.';

  if (descLength === 0) {
    descStatus = 'missing';
    descMessage = 'Meta description tag is missing. Search engines may use random snippets instead.';
  } else if (descLength < 110) {
    descStatus = 'warning';
    descMessage = `Description is too short (${descLength} chars). Aim for 150-160 characters.`;
  } else if (descLength > 160) {
    descStatus = 'warning';
    descMessage = `Description is too long (${descLength} chars). Aim for 150-160 characters to avoid truncation.`;
  }

  const descriptionAudit: DescriptionAudit = { text: descText, length: descLength, status: descStatus, message: descMessage };

  // 3. Audit Canonical
  const canonicalEl = doc.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalEl ? canonicalEl.getAttribute('href') || '' : '';
  let canonicalStatus: CanonicalAudit['status'] = 'ok';
  let canonicalMessage = 'Canonical URL is set correctly.';

  if (!canonicalUrl) {
    canonicalStatus = 'missing';
    canonicalMessage = 'Canonical link is missing. Risk of duplicate content issues.';
  }

  const canonicalAudit: CanonicalAudit = { url: canonicalUrl, status: canonicalStatus, message: canonicalMessage };

  // 4. Audit Headings
  onProgress('Auditing header structure...');
  const h1Elements = Array.from(doc.querySelectorAll('h1')).map(el => el.textContent?.trim() || '');
  const h2Elements = Array.from(doc.querySelectorAll('h2')).map(el => el.textContent?.trim() || '');
  const h3Elements = Array.from(doc.querySelectorAll('h3')).map(el => el.textContent?.trim() || '');
  const h4Elements = Array.from(doc.querySelectorAll('h4')).map(el => el.textContent?.trim() || '');
  const h5Elements = Array.from(doc.querySelectorAll('h5')).map(el => el.textContent?.trim() || '');
  const h6Elements = Array.from(doc.querySelectorAll('h6')).map(el => el.textContent?.trim() || '');

  let headingsStatus: HeadingAudit['status'] = 'ok';
  let headingsMessage = 'Heading structure is logical and contains exactly one H1.';

  if (h1Elements.length === 0) {
    headingsStatus = 'error';
    headingsMessage = 'Missing H1 heading. Every page needs exactly one H1 to state its primary topic.';
  } else if (h1Elements.length > 1) {
    headingsStatus = 'warning';
    headingsMessage = `Multiple H1 headings detected (${h1Elements.length}). It is recommended to have exactly one H1 per page.`;
  }

  const headingAudit: HeadingAudit = {
    h1: h1Elements,
    h2: h2Elements,
    h3: h3Elements,
    h4: h4Elements,
    h5: h5Elements,
    h6: h6Elements,
    status: headingsStatus,
    message: headingsMessage
  };

  // 5. Audit Image Alts
  onProgress('Checking image alt attributes...');
  const images = Array.from(doc.querySelectorAll('img'));
  const totalImages = images.length;
  const imageDetails: ImageAltDetail[] = [];
  let missingAltCount = 0;

  images.forEach(img => {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt');
    const isMissing = alt === null || alt.trim() === '';
    if (isMissing) missingAltCount++;
    imageDetails.push({
      src: normalizeUrl(src, finalUrl),
      alt: alt || '',
      isMissing
    });
  });

  let imageAltsStatus: ImageAltsAudit['status'] = 'ok';
  let imageAltsMessage = 'All images have alternative text attributes.';

  if (missingAltCount > 0) {
    imageAltsStatus = missingAltCount === totalImages ? 'error' : 'warning';
    imageAltsMessage = `${missingAltCount} out of ${totalImages} images are missing alt attributes. Alt text is essential for screen readers and image search SEO.`;
  }

  const imageAltsAudit: ImageAltsAudit = {
    total: totalImages,
    missing: missingAltCount,
    details: imageDetails,
    status: imageAltsStatus,
    message: imageAltsMessage
  };

  // 6. Audit OpenGraph & Socials
  const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"]')?.getAttribute('content') || '';
  const ogDesc = doc.querySelector('meta[property="og:description"], meta[name="og:description"]')?.getAttribute('content') || '';
  const ogImage = doc.querySelector('meta[property="og:image"], meta[name="og:image"]')?.getAttribute('content') || '';
  const ogType = doc.querySelector('meta[property="og:type"], meta[name="og:type"]')?.getAttribute('content') || '';

  const ogStatus: OpenGraphAudit['status'] = (ogTitle && ogDesc && ogImage) ? 'ok' : 'missing';
  const ogMessage = ogStatus === 'ok' 
    ? 'Open Graph meta tags are configured properly.' 
    : 'Some key Open Graph tags (og:title, og:description, or og:image) are missing. Social shares will look plain.';

  const openGraphAudit: OpenGraphAudit = {
    title: ogTitle,
    description: ogDesc,
    image: ogImage ? normalizeUrl(ogImage, finalUrl) : '',
    type: ogType,
    status: ogStatus,
    message: ogMessage
  };

  // 6b. Twitter Card Audit
  const twitterCardTag = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content') || '';
  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';
  const twitterDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || '';
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') || '';

  const twitterStatus: TwitterCardAudit['status'] = (twitterCardTag && twitterTitle && twitterDesc) ? 'ok' : 'missing';
  const twitterMessage = twitterStatus === 'ok'
    ? 'Twitter Card meta tags are present.'
    : 'Some key Twitter Card tags (twitter:card, twitter:title, or twitter:description) are missing.';

  const twitterCardAudit: TwitterCardAudit = {
    card: twitterCardTag,
    title: twitterTitle,
    description: twitterDesc,
    image: twitterImage ? normalizeUrl(twitterImage, finalUrl) : '',
    status: twitterStatus,
    message: twitterMessage
  };

  // 6c. Content Metrics
  const visibleText = getVisibleText(doc);
  const words = visibleText.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const contentRatio = parseFloat(((visibleText.length / htmlSize) * 100).toFixed(1)) || 0;
  const readingLevel = estimateReadingLevel(visibleText);
  const language = doc.documentElement.getAttribute('lang') || 'unknown';

  const contentMetrics: ContentMetrics = {
    wordCount,
    contentRatio,
    readingLevel,
    language
  };

  // 6d. Additional meta tags
  const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
  const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || 
                  doc.querySelector('meta[http-equiv="content-type"]')?.getAttribute('content') || '';
  const faviconEl = doc.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
  const favicon = faviconEl ? normalizeUrl(faviconEl.getAttribute('href') || '', finalUrl) : '';
  
  const hreflangs = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map(el => ({
    hreflang: el.getAttribute('hreflang') || '',
    href: normalizeUrl(el.getAttribute('href') || '', finalUrl)
  }));

  // 7. Robots Meta Tag
  const robotsText = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || 'None detected (default: index, follow)';

  // 8. Schema Structured Data
  const schemaElements = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  const schemaTypes: string[] = [];
  const schemas: Array<{ type: string; code: string }> = [];

  schemaElements.forEach(script => {
    try {
      const content = script.textContent || '';
      if (!content.trim()) return;
      const parsed = JSON.parse(content);
      
      const addSchema = (item: any) => {
        const type = item['@type'];
        if (type) {
          schemaTypes.push(String(type));
          schemas.push({
            type: String(type),
            code: JSON.stringify(item, null, 2)
          });
        }
      };

      if (Array.isArray(parsed)) {
        parsed.forEach(addSchema);
      } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        parsed['@graph'].forEach(addSchema);
      } else {
        addSchema(parsed);
      }
    } catch {
      // Ignored malformed schema script tags
    }
  });

  // New Client-Side Audits
  let viewportStatus: GenericAudit['status'] = 'ok';
  let viewportMessage = 'Viewport meta tag is configured correctly for mobile devices.';
  if (!viewport) {
    viewportStatus = 'error';
    viewportMessage = 'Missing viewport meta tag. Page will not be mobile-friendly.';
  } else if (!viewport.includes('width=device-width')) {
    viewportStatus = 'warning';
    viewportMessage = 'Viewport tag is missing "width=device-width".';
  }
  const viewportAudit: GenericAudit = { status: viewportStatus, message: viewportMessage };

  let languageStatus: GenericAudit['status'] = 'ok';
  let languageMessage = `HTML language attribute is set to "${language}".`;
  if (language === 'unknown' || !language) {
    languageStatus = 'error';
    languageMessage = 'Missing HTML lang attribute. Crucial for screen readers and regional SEO.';
  }
  const languageAudit: GenericAudit = { status: languageStatus, message: languageMessage };

  let robotsMetaStatus: GenericAudit['status'] = 'ok';
  let robotsMetaMessage = 'Robots meta tag allows indexing.';
  const robotsLower = robotsText.toLowerCase();
  if (robotsLower.includes('noindex') || robotsLower.includes('none')) {
    robotsMetaStatus = 'error';
    robotsMetaMessage = 'Robots meta tag contains "noindex". This page will NOT appear in search engines.';
  } else if (robotsLower.includes('nofollow')) {
    robotsMetaStatus = 'warning';
    robotsMetaMessage = 'Robots meta tag contains "nofollow". Search engines will not follow links on this page.';
  }
  const robotsMetaAudit: GenericAudit = { status: robotsMetaStatus, message: robotsMetaMessage };

  let faviconStatus: GenericAudit['status'] = 'ok';
  let faviconMessage = 'Favicon is present.';
  if (!favicon) {
    faviconStatus = 'warning';
    faviconMessage = 'Missing favicon. Search results look less professional without a branded icon.';
  }
  const faviconAudit: GenericAudit = { status: faviconStatus, message: faviconMessage };

  // AI Discoverability (AEO) Metrics
  const qsRegex = /^(how|what|why|where|when|who|is|are|can|do|does)\b/i;
  const allH2H3 = [...h2Elements, ...h3Elements];
  const hasQA = allH2H3.some(h => qsRegex.test(h) || h.endsWith('?'));
  const qaFormatting: GenericAudit = hasQA 
    ? { status: 'ok', message: 'Page uses Question/Answer style headings which AI models favor for extracting facts.' }
    : { status: 'warning', message: 'No question-based headings found. AI engines prefer explicit Q&A structures (e.g. "How does X work?").' };

  const lists = doc.querySelectorAll('ul, ol, dl').length;
  const tables = doc.querySelectorAll('table').length;
  const scannability: GenericAudit = (lists > 0 || tables > 0)
    ? { status: 'ok', message: `Found ${lists} lists and ${tables} tables. These structured elements are highly preferred by AI models for summarization.` }
    : { status: 'warning', message: 'No lists or tables found. AI models struggle to extract facts from unstructured text.' };

  const semantics = doc.querySelectorAll('article, section, main, nav, aside').length;
  const semanticHtml: GenericAudit = semantics > 0
    ? { status: 'ok', message: `Found ${semantics} semantic HTML5 elements. This helps AI build an accurate knowledge graph of your page.` }
    : { status: 'warning', message: 'Lacking semantic HTML5 tags (<article>, <section>, <main>). Heavy reliance on <div> makes AI parsing difficult.' };

  const hasTargetSchema = schemaTypes.some(t => ['faqpage', 'article', 'newsarticle', 'organization', 'product', 'how-to', 'howto'].includes(t.toLowerCase()));
  const targetSchema: GenericAudit = hasTargetSchema
    ? { status: 'ok', message: 'Detected high-value AEO schemas (e.g. Article, FAQ, Product, Organization) that AI engines actively consume.' }
    : { status: 'warning', message: 'Missing high-value AEO schemas (FAQPage, Article, Organization, etc.).' };

  let aiScore = 100;
  if (qaFormatting.status === 'warning') aiScore -= 20;
  if (scannability.status === 'warning') aiScore -= 20;
  if (semanticHtml.status === 'warning') aiScore -= 15;
  if (targetSchema.status === 'warning') aiScore -= 25;
  if (robotsTxtAi.status === 'warning') aiScore -= 20;

  const aiDiscoverability: AIDiscoverabilityAudit = {
    score: Math.max(0, aiScore),
    grade: calculateGrade(Math.max(0, aiScore)),
    qaFormatting,
    scannability,
    semanticHtml,
    targetSchema,
    robotsTxtAi
  };

  const onPageResults: OnPageSEOResults = {
    title: titleAudit,
    description: descriptionAudit,
    headings: headingAudit,
    canonical: canonicalAudit,
    imageAlts: imageAltsAudit,
    openGraph: openGraphAudit,
    twitterCard: twitterCardAudit,
    contentMetrics,
    viewport,
    charset,
    favicon,
    hreflangs,
    robots: robotsText,
    schemaTypes,
    schemas,
    htmlSize,
    viewportAudit,
    languageAudit,
    robotsMetaAudit,
    faviconAudit
  };

  // 9. Links collection (CORS validation runs separately or asynchronously)
  onProgress('Collecting hyperlinks...');
  const anchorTags = Array.from(doc.querySelectorAll('a'));
  const linkItems: LinkItem[] = [];
  const processedHrefs = new Set<string>();
  let linkId = 0;

  anchorTags.forEach(anchor => {
    const rawHref = anchor.getAttribute('href');
    if (!rawHref) return;

    // Filter out anchors, mailto, tel, javascript links
    if (rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) {
      return;
    }

    const fullHref = normalizeUrl(rawHref, finalUrl);
    
    // De-duplicate links to avoid flooding status checkers
    if (processedHrefs.has(fullHref)) return;
    processedHrefs.add(fullHref);

    let isExternal: boolean;
    try {
      const targetHost = new URL(fullHref).host;
      const baseHost = new URL(finalUrl).host;
      isExternal = targetHost !== baseHost;
    } catch {
      isExternal = true;
    }

    linkItems.push({
      id: linkId++,
      href: fullHref,
      text: anchor.textContent?.trim() || '[Empty Anchor Link]',
      isExternal,
      isSecure: fullHref.startsWith('https:'),
      status: null,
      statusText: null,
      statusState: 'pending',
      rel: anchor.getAttribute('rel') || '',
      responseTime: null,
      redirectDestination: null
    });
  });

  // Calculate Initial Numeric Score
  let score = 100;
  
  if (titleAudit.status === 'missing') score -= 15;
  else if (titleAudit.status === 'warning') score -= 5;

  if (descriptionAudit.status === 'missing') score -= 12;
  else if (descriptionAudit.status === 'warning') score -= 4;

  if (canonicalAudit.status === 'missing') score -= 8;

  if (headingAudit.status === 'error') score -= 10;
  else if (headingAudit.status === 'warning') score -= 4;

  if (imageAltsAudit.status === 'error') score -= 10;
  else if (imageAltsAudit.status === 'warning') score -= 5;

  if (openGraphAudit.status === 'missing') score -= 5;

  if (schemaTypes.length === 0) score -= 3;

  if (viewportAudit.status === 'error') score -= 10;
  if (languageAudit.status === 'error') score -= 5;
  if (robotsMetaAudit.status === 'error') score -= 50;
  if (robotsMetaAudit.status === 'warning') score -= 10;
  if (faviconAudit.status === 'warning') score -= 2;

  score = Math.max(0, Math.min(100, score));

  return {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    onPage: onPageResults,
    links: linkItems,
    pageSpeedMobile: null,
    pageSpeedDesktop: null,
    aiDiscoverability,
    score,
    grade: calculateGrade(score)
  };
}

/**
 * Pure summary of an audit's error / warning / passed counts. This is the
 * single source of truth shared by the dashboard's live metric widgets and the
 * counts persisted to crawl history, so the saved numbers always equal what is
 * shown on screen.
 */
export function summarizeAudit(results: AuditResults): {
  errorCount: number;
  warningCount: number;
  passedCount: number;
} {
  const { onPage, links } = results;

  const errorCount =
    (onPage.title.status === 'missing' ? 1 : 0) +
    (onPage.description.status === 'missing' ? 1 : 0) +
    (onPage.headings.status === 'error' ? 1 : 0) +
    (onPage.imageAlts.status === 'error' ? 1 : 0) +
    links.filter(l => l.statusState === 'broken').length;

  const warningCount =
    (onPage.title.status === 'warning' ? 1 : 0) +
    (onPage.description.status === 'warning' ? 1 : 0) +
    (onPage.headings.status === 'warning' ? 1 : 0) +
    (onPage.imageAlts.status === 'warning' ? 1 : 0) +
    (onPage.canonical.status === 'missing' ? 1 : 0) +
    (onPage.openGraph.status === 'missing' ? 1 : 0);

  const passedCount =
    (onPage.title.status === 'ok' ? 1 : 0) +
    (onPage.description.status === 'ok' ? 1 : 0) +
    (onPage.headings.status === 'ok' ? 1 : 0) +
    (onPage.imageAlts.status === 'ok' ? 1 : 0) +
    (onPage.canonical.status === 'ok' ? 1 : 0) +
    (onPage.openGraph.status === 'ok' ? 1 : 0) +
    links.filter(l => l.statusState === 'ok').length;

  return { errorCount, warningCount, passedCount };
}

/**
 * Pure recalculation of the overall numeric score, blending the existing
 * on-page score with broken-link penalties and (when available) the average
 * PageSpeed performance score. Returns the new clamped score WITHOUT mutating
 * `results`; callers assign the result and update the grade themselves.
 */
export function recalculateOverallScore(results: AuditResults): number {
  let baseScore = results.score;

  const brokenLinks = results.links.filter(l => l.statusState === 'broken').length;
  if (brokenLinks > 0) {
    baseScore -= Math.min(15, brokenLinks * 2);
  }

  let performanceSum = 0;
  let perfCounts = 0;
  if (results.pageSpeedDesktop) {
    performanceSum += results.pageSpeedDesktop.score;
    perfCounts++;
  }
  if (results.pageSpeedMobile) {
    performanceSum += results.pageSpeedMobile.score;
    perfCounts++;
  }

  if (perfCounts > 0) {
    const avgPerformance = performanceSum / perfCounts;
    baseScore = Math.round((baseScore * 0.6) + (avgPerformance * 0.4));
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Parses the effective HTTP status from a proxied response (preferring the
 * X-Status-Code header set by the CORS proxy) and applies the result to the
 * link. Shared by both the HEAD and GET fallback paths.
 */
function applyResponseStatus(link: LinkItem, response: Response, startTime: number): void {
  link.responseTime = Math.round(performance.now() - startTime);

  const parsed = parseInt(response.headers.get('X-Status-Code') || '', 10);
  const realStatus = Number.isNaN(parsed) ? response.status : parsed;

  link.status = realStatus;
  link.statusText = response.statusText;
  link.statusState = realStatus >= 200 && realStatus < 400 ? 'ok' : 'broken';

  if (realStatus >= 300 && realStatus < 400) {
    link.redirectDestination =
      response.headers.get('Location') || response.headers.get('X-Final-Url') || 'Redirected';
  }
}

/**
 * Validates a list of links asynchronously through the CORS proxy using a
 * fixed-size pool of concurrent promise-workers.
 */
export async function validateLinks(
  links: LinkItem[],
  proxyUrl: string,
  onLinkUpdated: (link: LinkItem) => void,
  onComplete: () => void,
  signal?: AbortSignal
): Promise<void> {
  const CONCURRENCY = 4; // limit parallel connections

  async function checkOneLink(link: LinkItem): Promise<void> {
    link.statusState = 'checking';
    onLinkUpdated(link);

    const startFetch = performance.now();
    try {
      // Primary attempt: lightweight HEAD request.
      const response = await fetchWithTimeout(
        buildProxyFetchUrl(proxyUrl, link.href),
        { method: 'HEAD', signal },
        8000
      );
      applyResponseStatus(link, response, startFetch);
    } catch {
      try {
        // Fallback: full GET (some servers/proxies reject HEAD).
        const startGet = performance.now();
        const getResponse = await fetchWithTimeout(
          buildProxyFetchUrl(proxyUrl, link.href),
          { signal },
          8000
        );
        applyResponseStatus(link, getResponse, startGet);
      } catch {
        // Both attempts failed (network failure, abort, CORS, DNS): the link
        // is unreachable. Do NOT fabricate a 500 status.
        link.responseTime = Math.round(performance.now() - startFetch);
        link.status = null;
        link.statusText = 'Unreachable';
        link.statusState = 'broken';
      }
    }

    onLinkUpdated(link);
  }

  const queue = [...links];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      (async () => {
        while (queue.length) {
          if (signal?.aborted) break;
          const link = queue.shift();
          if (!link) break;
          await checkOneLink(link);
        }
      })()
    )
  );

  onComplete();
}

/**
 * Fetches PageSpeed Insight metrics from Google API
 */
export async function fetchPageSpeed(
  targetUrl: string,
  strategy: 'mobile' | 'desktop',
  apiKey?: string
): Promise<PageSpeedMetric> {
  let endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(targetUrl)}&category=performance&strategy=${strategy}`;
  if (apiKey) {
    endpoint += `&key=${apiKey}`;
  }

  const res = await fetchWithTimeout(endpoint, {}, 60000);
  if (!res.ok) {
    let errMsg = `Status ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // ignore parse error
    }
    
    if (res.status === 429) {
      throw new Error(`PageSpeed API rate limit exceeded (429). Please provide an API Key in settings.`);
    } else if (res.status === 400 && !apiKey) {
      throw new Error(`PageSpeed API request failed (400). An API Key may be required for this domain.`);
    }
    throw new Error(`PageSpeed API error: ${errMsg}`);
  }

  const data = (await res.json()) as PageSpeedApiResponse;
  const lighthouse = data?.lighthouseResult;
  if (!lighthouse?.categories?.performance) {
    throw new Error('PageSpeed returned no Lighthouse performance data.');
  }
  const perfCategory = lighthouse.categories.performance;
  const score = Math.round((perfCategory.score || 0) * 100);

  // Extract core performance vitals
  const fcp = lighthouse.audits['first-contentful-paint']?.displayValue || 'N/A';
  const lcp = lighthouse.audits['largest-contentful-paint']?.displayValue || 'N/A';
  const cls = lighthouse.audits['cumulative-layout-shift']?.displayValue || 'N/A';
  const speedIndex = lighthouse.audits['speed-index']?.displayValue || 'N/A';
  
  // Total Blocking Time
  const tbt = lighthouse.audits['total-blocking-time']?.displayValue || 'N/A';
  
  // Time to First Byte (TTFB)
  const ttfb = lighthouse.audits['server-response-time']?.displayValue || 'N/A';

  const audits = lighthouse.audits;

  // Lighthouse flags optimization "opportunity" audits via details.type. We use that
  // documented signal instead of fragile id substring matching. 'critical-opportunity'
  // covers the same concept for higher-impact items.
  const isOpportunity = (audit: LighthouseAudit): boolean =>
    audit.details?.type === 'opportunity' || audit.details?.type === 'critical-opportunity';

  // Extract passed audits list (opportunities the page already handles well)
  const passedAudits: string[] = [];
  for (const id in audits) {
    const audit = audits[id];
    if (audit.score !== null && audit.score >= 0.9 && isOpportunity(audit)) {
      passedAudits.push(audit.title);
    }
  }

  // Extract key failing recommendations (opportunities the page is failing)
  const recommendations: PageSpeedMetric['recommendations'] = [];
  for (const id in audits) {
    const audit = audits[id];
    if (audit.score !== null && audit.score < 0.9 && isOpportunity(audit)) {
      recommendations.push({
        title: audit.title,
        description: audit.description ?? '',
        displayValue: audit.displayValue || '',
        impact: audit.details?.overallSavingsMs || audit.numericValue || 0
      });
    }
  }

  // Sort recommendations by impact descending
  recommendations.sort((a, b) => (b.impact || 0) - (a.impact || 0));

  return {
    score,
    lcp,
    tbt, // Total Blocking Time
    cls,
    fcp,
    speedIndex,
    ttfb,
    passedAudits: passedAudits.slice(0, 15),
    recommendations: recommendations.slice(0, 10)
  };
}
