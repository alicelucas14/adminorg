// Draft / publish helpers shared by the blog, review, promotion and page admin routes.
// A document with isPublished:false is a draft: the public frontend API hides it everywhere
// (lists, single pages, sitemap, slug redirects), so the site serves a 404 for it, but nothing
// is deleted and it can be published again at any time.

const mongoose = require('mongoose');

const MAX_SLUGS = 500;

// Accepts a bare slug ("slot-rtp-guide"), a path ("/hi/blog/slot-rtp-guide/") or a full URL
// pasted from a spreadsheet, and returns the slug.
function slugFromInput(value) {
    let s = String(value ?? '').trim().replace(/^["']|["']$/g, '');
    if (!s) return '';
    try { s = new URL(s).pathname; } catch { /* not a full URL */ }
    const last = s.split(/[/?#]/).filter(Boolean).pop() || '';
    let slug = last;
    try { slug = decodeURIComponent(last); } catch { /* keep as typed */ }
    return slug.trim().toLowerCase();
}

// ?status=published | draft for the admin list endpoints; anything else = all.
function statusFilter(status) {
    if (status === 'published') return { isPublished: { $ne: false } };
    if (status === 'draft') return { isPublished: false };
    return {};
}

/**
 * PATCH /bulk-publish  body: { isPublished: boolean, ids?: string[], slugs?: string[] }
 * Either the ids selected in the list, or URLs/slugs pasted into the admin (one per line).
 * A slug that has since been renamed still matches through its slug history.
 */
function bulkPublishHandler(Model, noun) {
    return async (req, res) => {
        const { isPublished, ids, slugs } = req.body || {};
        if (typeof isPublished !== 'boolean') {
            return res.status(400).json({ message: 'isPublished must be true or false.' });
        }
        const idList = Array.isArray(ids) ? ids.filter((id) => mongoose.isValidObjectId(id)) : [];
        const slugList = Array.isArray(slugs) ? [...new Set(slugs.map(slugFromInput).filter(Boolean))] : [];
        if (!idList.length && !slugList.length) {
            return res.status(400).json({ message: 'Select some items, or paste at least one URL or slug.' });
        }
        if (slugList.length > MAX_SLUGS) {
            return res.status(400).json({ message: `Paste at most ${MAX_SLUGS} URLs at a time.` });
        }
        try {
            const or = [];
            if (idList.length) or.push({ _id: { $in: idList } });
            if (slugList.length) or.push({ slug: { $in: slugList } }, { slugHistory: { $in: slugList } });
            const docs = await Model.find({ $or: or }).select('_id slug +slugHistory').lean();
            const notFound = slugList.filter((s) => !docs.some((d) => d.slug === s || (d.slugHistory || []).includes(s)));
            // Only touch documents whose status actually changes: timestamps would otherwise bump
            // updatedAt on the rest and make them count as modified.
            const result = docs.length
                ? await Model.updateMany(
                    { _id: { $in: docs.map((d) => d._id) }, isPublished: isPublished ? false : { $ne: false } },
                    { $set: { isPublished } })
                : { modifiedCount: 0 };
            const verb = isPublished ? 'published' : 'moved to Draft';
            const already = docs.length - result.modifiedCount;
            res.json({
                message: `${result.modifiedCount} ${noun}(s) ${verb}` +
                    (already ? `, ${already} already ${isPublished ? 'published' : 'in Draft'}` : '') +
                    (notFound.length ? `, ${notFound.length} not found` : '') + '.',
                matched: docs.length,
                changed: result.modifiedCount,
                notFound,
            });
        } catch (error) {
            res.status(500).json({ message: 'Server Error', error: error.message });
        }
    };
}

module.exports = { bulkPublishHandler, statusFilter, slugFromInput, MAX_SLUGS };
