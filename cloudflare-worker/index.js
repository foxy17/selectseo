/**
 * Cloudflare Worker SEO proxy.
 * Resolves CORS limitations when fetching target HTML and verifying link status codes from the browser.
 *
 * SECURITY HARDENING:
 *  - CORS is restricted to a fixed origin allowlist (no wildcard) — see ALLOWED_ORIGINS.
 *  - Target hosts are screened against an SSRF blocklist (loopback / private / link-local
 *    / cloud-metadata addresses) — see isBlockedHost().
 *  - The forwarded X-Final-Url header is sanitized (control chars stripped, length capped,
 *    encodeURI'd) so a hostile target cannot inject headers or oversized values.
 *
 * RATE LIMITING: This worker does not implement rate limiting in code. Configure a
 * Cloudflare dashboard "Rate Limiting" rule on the worker route (Security > WAF >
 * Rate limiting rules) to cap requests per IP — there is no code change required here.
 */

// Origins permitted to use this proxy. CORS headers echo the specific matching origin
// rather than '*', so credentials/identity cannot be leveraged from arbitrary sites.
const ALLOWED_ORIGINS = ['https://selectseo.in', 'http://localhost:5173', 'http://localhost:4173'];

/**
 * SSRF guard: returns true when `hostname` should NOT be fetched because it points at the
 * local machine, a private network, a link-local address, or the cloud metadata endpoint.
 *
 * Pure and exported so it can be unit-tested in isolation.
 *
 * @param {string} hostname - URL hostname (no brackets for IPv6, as produced by `new URL()`).
 * @returns {boolean} true if the host is blocked.
 */
export function isBlockedHost(hostname) {
  if (!hostname) return true;

  // Normalize: lower-case, strip a trailing dot (FQDN root) and any IPv6 brackets.
  const host = hostname.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');

  // --- Named loopbacks ---------------------------------------------------------------
  // `localhost` and any `*.localhost` subdomain resolve to the loopback interface.
  if (host === 'localhost' || host.endsWith('.localhost')) return true;

  // --- Bare special-case strings -----------------------------------------------------
  if (host === '127.0.0.1' || host === '::1' || host === '0.0.0.0') return true;

  // --- Cloud metadata endpoint -------------------------------------------------------
  // 169.254.169.254 is the AWS/GCP/Azure instance metadata service — a classic SSRF target.
  if (host === '169.254.169.254') return true;

  // --- IPv4 literals -----------------------------------------------------------------
  // Match a dotted-quad and range-check octets against private/loopback/link-local blocks.
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number);
    // Reject anything that isn't a valid 0-255 octet (defensive — treat as blocked).
    if (octets.some((o) => o > 255)) return true;
    const [a, b] = octets;
    if (a === 127) return true; // 127.0.0.0/8   loopback
    if (a === 10) return true; // 10.0.0.0/8    private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    return false; // public IPv4
  }

  // --- IPv6 literals -----------------------------------------------------------------
  // Loopback (::1) is handled above. Block unique-local (fc00::/7 → starts fc/fd) and
  // link-local (fe80::/10). A colon distinguishes an IPv6 literal from a normal hostname.
  if (host.includes(':')) {
    if (host.startsWith('fc') || host.startsWith('fd')) return true; // fc00::/7 unique-local
    if (host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb'))
      return true; // fe80::/10 link-local
    // IPv4-mapped/embedded IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1): if a trailing
    // dotted-quad is present, re-check it against the IPv4 blocklist so loopback/private
    // addresses can't be smuggled through the IPv6 form.
    const embedded = host.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (embedded && isBlockedHost(embedded[1])) return true;
    return false; // other (public) IPv6
  }

  // Regular DNS hostname — allowed (note the redirect-based SSRF caveat documented below).
  return false;
}

/**
 * Build the CORS header set for a given request Origin.
 *  - Allowed origin  -> echo it back + `Vary: Origin`.
 *  - Disallowed origin (non-null) -> caller should 403; we still return base headers.
 *  - No Origin header (same-origin / non-browser) -> omit ACAO entirely (no wildcard).
 *
 * @param {string|null} origin
 * @returns {{ headers: Record<string,string>, allowed: boolean, hasOrigin: boolean }}
 */
function buildCorsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };

  const hasOrigin = typeof origin === 'string' && origin.length > 0;
  const allowed = !hasOrigin || ALLOWED_ORIGINS.includes(origin);

  // Only echo a specific, allow-listed origin. Never a wildcard.
  if (hasOrigin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return { headers, allowed, hasOrigin };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const { headers: corsHeaders, allowed, hasOrigin } = buildCorsHeaders(origin);

    // Reject browser requests from origins outside the allowlist.
    if (hasOrigin && !allowed) {
      return new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle OPTIONS preflight requests (same origin policy applied above).
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

      // SSRF guard: refuse to fetch internal / private / metadata hosts.
      if (isBlockedHost(parsedTargetUrl.hostname)) {
        return new Response(
          JSON.stringify({ error: 'Target host is not permitted (private, loopback, or metadata address).' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Check request type (GET vs HEAD)
      const fetchMethod = request.method === 'HEAD' ? 'HEAD' : 'GET';

      // Perform fetch through the worker.
      //
      // RESIDUAL RISK (SSRF-via-redirect): we use `redirect: 'follow'`, so a public URL can
      // 30x-redirect to a private/internal address AFTER the initial isBlockedHost() check,
      // bypassing it. Fully closing this would require `redirect: 'manual'` plus re-running
      // isBlockedHost() on every Location hop and following redirects by hand — that is out of
      // scope here because it would also break the X-Final-Url (post-redirect URL) detection the
      // app depends on. Cloudflare's egress and the host blocklist mitigate but do not eliminate it.
      const targetResponse = await fetch(parsedTargetUrl.toString(), {
        method: fetchMethod,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEO-Auditor/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        },
        redirect: 'follow'
      });

      // Gather content
      let responseBody = null;
      if (fetchMethod === 'GET') {
        responseBody = await targetResponse.arrayBuffer();
      }

      // Sanitize the post-redirect URL before forwarding it as a response header so a hostile
      // target cannot inject extra headers (CR/LF), emit control chars, or bloat the header.
      // Defaults to the originally requested target if anything goes wrong.
      let finalUrl = targetUrl;
      try {
        const raw = targetResponse.url || targetUrl;
        finalUrl = encodeURI(
          // Strip CR (\x0D), LF (\x0A), all other C0 control chars (\x00-\x1F)
          // and DEL (\x7F), then cap length to keep the header bounded.
          raw.replace(/[\x00-\x1F\x7F]/g, '').slice(0, 2048)
        )
      } catch {
        finalUrl = targetUrl;
      }

      // Extract only safe content headers to forward.
      // Build defensively so a bad header value can never escalate to a 500.
      let headersToForward;
      try {
        headersToForward = new Headers({
          ...corsHeaders,
          'X-Status-Code': targetResponse.status.toString(),
          'X-Final-Url': finalUrl
        });
      } catch {
        headersToForward = new Headers({
          ...corsHeaders,
          'X-Status-Code': targetResponse.status.toString(),
          'X-Final-Url': targetUrl
        });
      }

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
