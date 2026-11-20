// Link redirects: any address on the website -> any other address (a page on the site, or an outside link).
//
// Unlike slug redirects (lib/redirects.js), these are not tied to a post. The website consults them only
// when a URL would otherwise be a 404 (uu7stars-frontend/src/middleware.ts), so a redirect can never hide
// live content, and a URL that comes back to life simply stops redirecting.
//
// Addresses are compared normalised: decoded, lowercase, one slash between segments, no trailing slash,
// no query string. normalizeFrom() here and normalizePath() in the frontend's lib/linkRedirect.ts must agree.

const MAX_FROMS = 500;
const MAX_LENGTH = 500;

function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}

function ownHosts() {
    try {
        const host = new URL(process.env.FRONTEND_URL).hostname.toLowerCase();
        return new Set([host, host.startsWith('www.') ? host.slice(4) : `www.${host}`]);
    } catch {
        return new Set();
    }
}

const LOOKS_LIKE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(?=[/?#]|$)/i;

/** "https://uu7stars.com/Hi/Blog/Old-Post/?utm=1" | "/blog/old-post/" | "blog/old-post" -> "/hi/blog/old-post". '' if unusable. */
function normalizeFrom(value) {
    let s = String(value ?? '').trim().replace(/^["']|["']$/g, '');
    if (!s) return '';
    if (LOOKS_LIKE_HOST.test(s)) s = `https://${s}`;
    try { s = new URL(s).pathname; } catch { /* a bare path */ }
    s = safeDecode(s.split(/[?#]/)[0]).toLowerCase().replace(/\/{2,}/g, '/');
    if (!s.startsWith('/')) s = `/${s}`;
    s = s.replace(/\/+$/, '');
    return s.length > MAX_LENGTH ? '' : s; // '' also when it was just "/"
}

/**
 * Validates and normalises the destination.
 * Returns { to, external, path } where `path` is the normalised internal address (for loop checks), or
 * throws an Error with a message fit to show the admin.
 *   "/blog/new-post"            -> "/blog/new-post/"   (the site always ends pages with a slash)
 *   "https://uu7stars.com/x"    -> "/x/"               (a link to this site is kept as a plain path)
 *   "https://example.com/page"  -> "https://example.com/page"
 */
function normalizeTo(value) {
    let s = String(value ?? '').trim();
    if (!s) throw new Error('Enter the link to send visitors to.');
    if (s.length > 2000 || /[\u0000-\u001f\u007f\\]/.test(s)) throw new Error('That link contains characters that are not allowed.');
    if (LOOKS_LIKE_HOST.test(s)) s = `https://${s}`;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) throw new Error('Only http:// or https:// links, or a page on this site starting with /, are allowed.');

    if (/^https?:\/\//i.test(s)) {
        let u;
        try { u = new URL(s); } catch { throw new Error('That does not look like a valid link.'); }
        if (u.username || u.password) throw new Error('Links with a username or password are not allowed.');
        if (!ownHosts().has(u.hostname.toLowerCase())) return { to: u.href, external: true, path: '' };
        s = u.pathname + u.search + u.hash; // a link to our own site: keep it as a path
    } else if (s.startsWith('//')) {
        throw new Error('Start the link with https:// for another website, or a single / for a page on this site.');
    } else if (!s.startsWith('/')) {
        s = `/${s}`;
    }

    const u = new URL(s, 'https://site.invalid');
    let path = safeDecode(u.pathname).replace(/\/{2,}/g, '/');
    if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path.split('/').pop())) path += '/';
    return { to: path + u.search + u.hash, external: false, path: normalizeFrom(path) || '/' };
}

const isHindi = (p) => p === '/hi' || p.startsWith('/hi/');

/** [from, to] plus the Hindi twin ("/hi" + from -> "/hi" + to; an outside link stays the same). */
function withHindi(pairs, external, enabled) {
    if (!enabled) return pairs;
    const out = [...pairs];
    for (const [from, to] of pairs) {
        if (isHindi(from)) continue;
        out.push([`/hi${from}`, external || isHindi(to) ? to : `/hi${to}`]);
    }
    return out;
}

/**
 * Creates or updates redirects: every address in `froms` -> `to`.
 * Returns { created, updated, unchanged, skipped: [{ from, reason }] }; throws Error for a bad destination.
 * An existing redirect for the same address is overwritten (that is "change where it goes").
 */
async function saveLinkRedirects(LinkRedirect, { froms, to, status = 301, includeHindi = true }) {
    const dest = normalizeTo(to);
    const code = Number(status) === 302 ? 302 : 301;
    const skipped = [];

    const seen = new Set();
    const base = [];
    for (const raw of froms) {
        const from = normalizeFrom(raw);
        if (!from) { skipped.push({ from: String(raw).trim().slice(0, 80) || '(empty)', reason: 'not a usable address (the home page itself cannot be redirected)' }); continue; }
        if (seen.has(from)) continue;
        seen.add(from);
        base.push([from, dest.to]);
    }

    // Hindi twins are added on top, never replacing an address the admin listed explicitly.
    const pairs = withHindi(base, dest.external, includeHindi).filter(([from], i, all) => all.findIndex(([f]) => f === from) === i);

    const existing = new Map((await LinkRedirect.find({ from: { $in: pairs.map(([f]) => f) } }).lean()).map((d) => [d.from, d]));
    const targetPaths = [...new Set(pairs.filter(() => !dest.external).map(([, t]) => normalizeFrom(t)))];
    const reverse = targetPaths.length ? await LinkRedirect.find({ from: { $in: targetPaths } }).lean() : [];
    const reverseTo = new Map(reverse.map((d) => [d.from, d.to]));

    const ops = [];
    let created = 0, updated = 0, unchanged = 0;
    for (const [from, target] of pairs) {
        if (!dest.external) {
            const targetPath = normalizeFrom(target);
            if (targetPath === from) { skipped.push({ from, reason: 'would send the page to itself' }); continue; }
            const back = reverseTo.get(targetPath);
            if (back && !/^https?:\/\//i.test(back) && normalizeFrom(back) === from) {
                skipped.push({ from, reason: `would loop: ${targetPath} already redirects back here` });
                continue;
            }
        }
        const current = existing.get(from);
        if (current && current.to === target && current.status === code) { unchanged++; continue; }
        if (current) updated++; else created++;
        ops.push({ updateOne: { filter: { from }, update: { $set: { to: target, status: code } }, upsert: true } });
    }
    if (ops.length) await LinkRedirect.bulkWrite(ops, { ordered: false });
    return { created, updated, unchanged, skipped, to: dest.to, status: code };
}

/** The normalised addresses a save would touch, in the order the admin listed them, each followed by its Hindi twin. */
function expandAddresses(froms, includeHindi = true) {
    const out = [];
    const seen = new Set();
    const add = (a) => { if (a && !seen.has(a)) { seen.add(a); out.push(a); } };
    for (const raw of froms) {
        const from = normalizeFrom(raw);
        add(from);
        if (from && includeHindi && !isHindi(from)) add(`/hi${from}`);
    }
    return out;
}

module.exports = { normalizeFrom, normalizeTo, saveLinkRedirects, expandAddresses, MAX_FROMS };
