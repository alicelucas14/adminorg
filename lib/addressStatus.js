// Asks the LIVE website what an address does right now, so the Redirects screen can warn when a redirect
// would never be used.
//
// A link redirect is only applied when the website would otherwise answer "page not found" (see
// uu7stars-frontend/src/middleware.ts). So the answer that matters is the website's own: a request for the
// address that comes back 200 is a live page (the redirect is inert), a 3xx means something already
// redirects it, and a 404 means the address is free for a redirect to take over. Asking the website beats
// re-implementing its routing here: it also covers fixed pages (/faq/, /terms/), tag and category pages and
// anything added to the website later.
//
// Only the PATH comes from the admin; the host is always FRONTEND_URL, so this cannot be pointed elsewhere.

const MAX_CHECK = 30;          // addresses checked per request (every one costs a page render on the website)
const CONCURRENCY = 5;
const TIMEOUT_MS = 8000;

function siteOrigin() {
    try { return new URL(process.env.FRONTEND_URL).origin; } catch { return ''; }
}

/** "/blog/x" -> "https://uu7stars.com/blog/x/" (the website ends pages with a slash and 301s the bare form). */
function siteUrl(origin, path) {
    let p = path.startsWith('/') ? path : `/${path}`;
    if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p.split('/').pop())) p += '/';
    return new URL(p.split('/').map(encodeURIComponent).join('/'), origin).href;
}

/** What the website answers for one address: { state: 'live'|'redirects'|'missing'|'unknown', status?, location? }. */
async function probeAddress(origin, path, fetchFn = fetch, timeoutMs = TIMEOUT_MS) {
    if (!origin) return { state: 'unknown' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchFn(siteUrl(origin, path), {
            method: 'HEAD',
            redirect: 'manual', // we want to SEE a redirect, not follow it
            signal: controller.signal,
            headers: { 'User-Agent': 'adminorg-redirect-check' },
        });
        const status = response.status;
        if (status >= 200 && status < 300) return { state: 'live', status };
        if (status >= 300 && status < 400) return { state: 'redirects', status, location: response.headers.get('location') || '' };
        if (status === 404 || status === 410) return { state: 'missing', status };
        return { state: 'unknown', status }; // 5xx, a Cloudflare challenge, ...: do not guess
    } catch {
        return { state: 'unknown' };
    } finally {
        clearTimeout(timer);
    }
}

const sameLink = (origin, a, b) => {
    try { return new URL(a, origin).href === new URL(b, origin).href; } catch { return false; }
};

/**
 * Turns one probe plus the redirect rule saved for that address (if any) into what the admin should see:
 *   live       the address is a live page: a redirect from it is never used
 *   working    the rule is in effect (the website redirects to the rule's destination)
 *   elsewhere  the website redirects it, but not by this rule (an old post address, another path rule)
 *   waiting    a rule is saved but the website still answers "not found" (it picks new rules up within ~20 s)
 *   free       no rule and nothing there: a redirect would apply
 *   unknown    could not tell
 */
function verdictFor(probe, rule, origin) {
    switch (probe.state) {
        case 'live': return 'live';
        case 'redirects':
            return rule && sameLink(origin, rule.to, probe.location) ? 'working' : 'elsewhere';
        case 'missing': return rule ? 'waiting' : 'free';
        default: return 'unknown';
    }
}

/**
 * Probes `addresses` (already normalised) and returns [{ from, verdict, status, location }] in the same order.
 * `rules` maps an address to its saved LinkRedirect.
 */
async function checkAddresses(addresses, rules = new Map(), { origin = siteOrigin(), fetchFn = fetch } = {}) {
    const results = new Array(addresses.length);
    let next = 0;
    const worker = async () => {
        while (next < addresses.length) {
            const i = next++;
            const from = addresses[i];
            const probe = await probeAddress(origin, from, fetchFn);
            results[i] = { from, verdict: verdictFor(probe, rules.get(from), origin), status: probe.status || null, location: probe.location || '' };
        }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, addresses.length) }, worker));
    return results;
}

module.exports = { checkAddresses, probeAddress, verdictFor, siteUrl, siteOrigin, MAX_CHECK };
