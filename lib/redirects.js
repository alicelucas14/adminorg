// Manual redirects for slug-addressed content: "old URL -> this post".
//
// They are stored in the same `slugHistory` list that renames write to (see slugHistory.js), so the
// frontend needs no change: when a URL's slug matches no published item it asks
// /frontend-api/slug-redirect/:type/:slug and answers with a 301 to the item that lists it. That works
// for English and Hindi URLs alike, and only while the target is published.
//
// slugHistory is select:false and its plugin discards client-supplied values on findOneAndUpdate,
// so this writes with updateOne (not hooked), and with timestamps off: adding a redirect is not a
// content change, so "Last Updated" and the sitemap lastmod stay as they were.

const mongoose = require('mongoose');
const { slugFromInput, MAX_SLUGS } = require('./publishing');

const MAX_SLUG_LENGTH = 200;

/** For the admin lists: the documents as JSON, each with `redirectCount` (slugHistory is select:false, so it is counted in the DB). */
async function withRedirectCounts(Model, docs) {
    const rows = docs.length
        ? await Model.aggregate([
            { $match: { _id: { $in: docs.map((d) => d._id) } } },
            { $project: { n: { $size: { $ifNull: ['$slugHistory', []] } } } },
        ])
        : [];
    const counts = new Map(rows.map((r) => [String(r._id), r.n]));
    return docs.map((d) => ({ ...d.toJSON(), redirectCount: counts.get(String(d._id)) || 0 }));
}

/** ?redirects=1 on an admin list: only items that have at least one redirect. */
function redirectFilter(flag) {
    return flag === '1' || flag === 'true' ? { 'slugHistory.0': { $exists: true } } : {};
}

function redirectHandlers(Model) {
    const loadDoc = async (id) => {
        if (!mongoose.isValidObjectId(id)) return null;
        return Model.findById(id).select('slug isPublished +slugHistory').lean();
    };

    /** GET /:id/redirects -> { slug, isPublished, redirects: [old slugs] } */
    const list = async (req, res) => {
        try {
            const doc = await loadDoc(req.params.id);
            if (!doc) return res.status(404).json({ message: 'Not found.' });
            res.json({ slug: doc.slug, isPublished: doc.isPublished !== false, redirects: doc.slugHistory || [] });
        } catch (error) {
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    };

    /**
     * PUT /:id/redirects  body: { redirects: string[] }  (URLs, paths or slugs)
     * Replaces this item's redirect list. Entries already on the list are always kept as sent;
     * new ones are skipped (and reported) when they could never take effect or would take over
     * another item's redirect:
     *   - this item's own URL,
     *   - a URL a published item is serving (the item wins over any redirect),
     *   - a URL that already redirects to a different item.
     * A URL held by a Draft is fine: that is the "retire a duplicate" case.
     */
    const save = async (req, res) => {
        try {
            const input = req.body && req.body.redirects;
            if (!Array.isArray(input)) return res.status(400).json({ message: 'redirects must be a list of URLs or slugs.' });
            const wanted = [...new Set(input.map(slugFromInput).filter(Boolean))];
            if (wanted.length > MAX_SLUGS) return res.status(400).json({ message: `At most ${MAX_SLUGS} redirects per post.` });

            const doc = await loadDoc(req.params.id);
            if (!doc) return res.status(404).json({ message: 'Not found.' });

            const current = new Set(doc.slugHistory || []);
            const fresh = wanted.filter((s) => !current.has(s));
            const skipped = [];
            const accepted = new Set();

            if (fresh.length) {
                const [serving, redirecting] = await Promise.all([
                    Model.find({ _id: { $ne: doc._id }, slug: { $in: fresh }, isPublished: { $ne: false } }).select('slug').lean(),
                    Model.find({ _id: { $ne: doc._id }, slugHistory: { $in: fresh } }).select('slug +slugHistory').lean(),
                ]);
                const servedBy = new Set(serving.map((d) => d.slug));
                const redirectedBy = new Map();
                for (const d of redirecting) for (const s of d.slugHistory || []) if (!redirectedBy.has(s)) redirectedBy.set(s, d.slug);

                for (const s of fresh) {
                    if (s === doc.slug) skipped.push({ slug: s, reason: 'this is the post\'s own URL' });
                    else if (s.length > MAX_SLUG_LENGTH) skipped.push({ slug: s.slice(0, 60) + '…', reason: 'too long' });
                    else if (servedBy.has(s)) skipped.push({ slug: s, reason: 'a published post already uses this URL (unpublish it first)' });
                    else if (redirectedBy.has(s)) skipped.push({ slug: s, reason: `already redirects to "${redirectedBy.get(s)}"` });
                    else accepted.add(s);
                }
            }

            const redirects = wanted.filter((s) => current.has(s) || accepted.has(s));
            const added = redirects.filter((s) => !current.has(s));
            const removed = [...current].filter((s) => !redirects.includes(s));

            if (added.length || removed.length) {
                await Model.updateOne({ _id: doc._id }, { $set: { slugHistory: redirects } }, { timestamps: false });
            }

            const parts = [];
            if (added.length) parts.push(`${added.length} added`);
            if (removed.length) parts.push(`${removed.length} removed`);
            if (skipped.length) parts.push(`${skipped.length} skipped`);
            res.json({
                message: parts.length ? `Redirects saved: ${parts.join(', ')}.` : 'No changes.',
                redirects, added, removed, skipped,
            });
        } catch (error) {
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    };

    return { list, save };
}

module.exports = { redirectHandlers, withRedirectCounts, redirectFilter };
