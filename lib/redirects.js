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

/**
 * Which of `fresh` (URLs that should start redirecting to `doc`) can actually take effect.
 * Returns { accepted: Set, skipped: [{ slug, reason }] }. A URL is skipped when it is
 *   - `doc`'s own URL,
 *   - one a published item is serving (the item wins over any redirect),
 *   - one that already redirects to a different item.
 * A URL held by a Draft is fine: that is the "retire a duplicate" case.
 * `ignoreIds`: items whose claims on a URL do not count as conflicts (the item being moved).
 */
async function classify(Model, noun, doc, fresh, ignoreIds = []) {
    const accepted = new Set();
    const skipped = [];
    if (!fresh.length) return { accepted, skipped };

    const ids = [doc._id, ...ignoreIds];
    const [serving, redirecting] = await Promise.all([
        Model.find({ _id: { $nin: ids }, slug: { $in: fresh }, isPublished: { $ne: false } }).select('slug').lean(),
        Model.find({ _id: { $nin: ids }, slugHistory: { $in: fresh } }).select('slug +slugHistory').lean(),
    ]);
    const servedBy = new Set(serving.map((d) => d.slug));
    const redirectedBy = new Map();
    for (const d of redirecting) for (const s of d.slugHistory || []) if (!redirectedBy.has(s)) redirectedBy.set(s, d.slug);

    for (const s of fresh) {
        if (s === doc.slug) skipped.push({ slug: s, reason: `this is the ${noun}'s own URL` });
        else if (s.length > MAX_SLUG_LENGTH) skipped.push({ slug: s.slice(0, 60) + '…', reason: 'too long' });
        else if (servedBy.has(s)) skipped.push({ slug: s, reason: `a published ${noun} already uses this URL (unpublish it first)` });
        else if (redirectedBy.has(s)) skipped.push({ slug: s, reason: `already redirects to "${redirectedBy.get(s)}"` });
        else accepted.add(s);
    }
    return { accepted, skipped };
}

function redirectHandlers(Model, noun = 'post') {
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
            const { accepted, skipped } = await classify(Model, noun, doc, fresh);

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

    /**
     * PUT /:id/redirect-to  body: { targetId, unpublish? }
     * The other direction: send THIS item's URL (and every old URL it had) to another item.
     * That is what you want for a duplicate: it records this item's slug + slug history on the
     * target's list and removes them from this one, so the whole set moves together.
     * The target must be published (a redirect to a Draft would just 404). If this item is
     * published its own URL would keep showing it, so it has to be moved to Draft too:
     * pass unpublish:true to confirm that.
     */
    const redirectTo = async (req, res) => {
        try {
            const { targetId, unpublish } = req.body || {};
            if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: `Pick the ${noun} to redirect to.` });
            if (String(targetId) === String(req.params.id)) return res.status(400).json({ message: `A ${noun} can't redirect to itself.` });

            const [source, target] = await Promise.all([loadDoc(req.params.id), loadDoc(targetId)]);
            if (!source) return res.status(404).json({ message: 'Not found.' });
            if (!target) return res.status(404).json({ message: `The ${noun} to redirect to was not found.` });
            if (target.isPublished === false) {
                return res.status(400).json({ message: `"${target.slug}" is a Draft, so a redirect to it would lead to a 404. Publish it first.` });
            }
            const sourceLive = source.isPublished !== false;
            if (sourceLive && unpublish !== true) {
                return res.status(400).json({ message: `This ${noun} is published, so its own URL would keep showing it. Move it to Draft as well.` });
            }

            const onTarget = new Set(target.slugHistory || []);
            const mine = [...new Set([source.slug, ...(source.slugHistory || [])])];
            const candidates = mine.filter((s) => s !== target.slug && !onTarget.has(s));
            const { accepted, skipped } = await classify(Model, noun, target, candidates, [source._id]);

            const mainSkip = skipped.find((s) => s.slug === source.slug);
            if (mainSkip) return res.status(409).json({ message: `Can't redirect this ${noun}'s URL: ${mainSkip.reason}.`, skipped });

            if (accepted.size) {
                await Model.updateOne({ _id: target._id }, { $addToSet: { slugHistory: { $each: [...accepted] } } }, { timestamps: false });
            }
            // Everything that now lives on the target leaves this item, so no URL is claimed twice.
            const leaving = mine.filter((s) => s !== source.slug && (accepted.has(s) || onTarget.has(s)));
            const update = {};
            if (sourceLive) update.$set = { isPublished: false };
            if (leaving.length) update.$pullAll = { slugHistory: leaving };
            if (Object.keys(update).length) await Model.updateOne({ _id: source._id }, update);

            const moved = [...accepted];
            res.json({
                message: `${moved.length} URL${moved.length === 1 ? '' : 's'} now redirect to "${target.slug}"` +
                    (sourceLive ? `; this ${noun} was moved to Draft.` : '.') +
                    (skipped.length ? ` ${skipped.length} skipped.` : ''),
                moved, skipped, unpublished: sourceLive, target: { id: String(target._id), slug: target.slug },
            });
        } catch (error) {
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    };

    return { list, save, redirectTo };
}

module.exports = { redirectHandlers, withRedirectCounts, redirectFilter };
