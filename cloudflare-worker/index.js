/**
 * Cloudflare Worker SEO proxy.
 * Resolves CORS limitations when fetching target HTML and verifying link status codes from the browser.
 */

export default {
  async fetch(request, env) {
    // Enable CORS for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const urlObj = new URL(request.url);
    const targetUrl = urlObj.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing "url" parameter.' }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    try {
      // Validate url format
      const parsedTargetUrl = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedTargetUrl.protocol)) {
        throw new Error('Unsupported protocol. Only HTTP and HTTPS are allowed.');
      }

      // Check request type (GET vs HEAD)
      const fetchMethod = request.method === 'HEAD' ? 'HEAD' : 'GET';

      // Perform fetch through the worker
      const targetResponse = await fetch(parsedTargetUrl.toString(), {
        method: fetchMethod,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEO-Auditor/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        redirect: 'follow'
      });

      // Gather content
      let responseBody = null;
      if (fetchMethod === 'GET') {
        responseBody = await targetResponse.arrayBuffer();
      }

      // Extract only safe content headers to forward
      const headersToForward = new Headers({
        ...corsHeaders,
        'X-Status-Code': targetResponse.status.toString(),
        'X-Final-Url': targetResponse.url,
      });

      const contentType = targetResponse.headers.get('content-type');
      if (contentType) {
        headersToForward.set('Content-Type', contentType);
      } else {
        headersToForward.set('Content-Type', 'text/html; charset=utf-8');
      }

      return new Response(responseBody, {
        status: targetResponse.status,
        headers: headersToForward
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: `Proxy Error: ${err.message}` }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
