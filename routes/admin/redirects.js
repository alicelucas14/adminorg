// backend/routes/admin/redirects.js
// Link redirects: any address on the website -> any page on the site or an outside link.
// See lib/linkRedirects.js. The website reads them through GET /frontend-api/redirects.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { LinkRedirect } = require('../../models');
const { escapeRegex } = require('../../lib/escapeRegex');
const { normalizeTo, normalizeFrom, saveLinkRedirects, expandAddresses, MAX_FROMS } = require('../../lib/linkRedirects');
const { checkAddresses, MAX_CHECK } = require('../../lib/addressStatus');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

const summary = (r) => {
    const parts = [];
    if (r.created) parts.push(`${r.created} added`);
    if (r.updated) parts.push(`${r.updated} updated`);
    if (r.unchanged) parts.push(`${r.unchanged} already set`);
    if (r.skipped.length) parts.push(`${r.skipped.length} skipped`);
    return parts.length ? `Redirects saved: ${parts.join(', ')}.` : 'Nothing to save.';
};

/**
 * @route   GET /api/admin/redirects?page=&limit=&search=
 * @desc    List link redirects (newest first); search matches the old or the new address
 */
router.get('/', async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
        const filter = {};
        if (req.query.search) {
            const regex = new RegExp(escapeRegex(String(req.query.search).slice(0, 200)), 'i');
            filter.$or = [{ from: regex }, { to: regex }];
        }
        const [data, totalItems] = await Promise.all([
            LinkRedirect.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            LinkRedirect.countDocuments(filter),
        ]);
        res.json({ data, totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/redirects/check
 * @body    { froms: string[], includeHindi?: boolean }
 * @desc    Asks the live website what each address does right now, so the screen can warn that a redirect
 *          would never be used (the address is a live page, or something else already redirects it).
 *          verdict: live | working | elsewhere | waiting | free | unknown (see lib/addressStatus.js).
 *          At most MAX_CHECK addresses are checked per call; `total` says how many there were.
 */
router.post('/check', async (req, res) => {
    try {
        const froms = Array.isArray(req.body && req.body.froms) ? req.body.froms : [];
        if (!froms.length) return res.status(400).json({ message: 'Enter at least one address.' });
        if (froms.length > MAX_FROMS) return res.status(400).json({ message: `At most ${MAX_FROMS} addresses at a time.` });
        const all = expandAddresses(froms, req.body.includeHindi !== false);
        const addresses = all.slice(0, MAX_CHECK);
        const rules = await LinkRedirect.find({ from: { $in: addresses } }).lean();
        const results = await checkAddresses(addresses, new Map(rules.map((r) => [r.from, r])));
        res.json({ results, checked: addresses.length, total: all.length });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/redirects
 * @body    { froms: string[] (or from: string), to, status?: 301|302, includeHindi?: boolean }
 * @desc    Send every listed address to `to`. An address that already redirects is changed to the new destination.
 */
router.post('/', async (req, res) => {
    try {
        const { from, to, status, includeHindi } = req.body || {};
        const froms = Array.isArray(req.body && req.body.froms) ? req.body.froms : (from ? [from] : []);
        if (!froms.length) return res.status(400).json({ message: 'Enter at least one old address.' });
        if (froms.length > MAX_FROMS) return res.status(400).json({ message: `At most ${MAX_FROMS} addresses at a time.` });
        let result;
        try {
            result = await saveLinkRedirects(LinkRedirect, { froms, to, status, includeHindi: includeHindi !== false });
        } catch (error) {
            return res.status(400).json({ message: error.message }); // bad destination
        }
        res.json({ message: summary(result), ...result });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/redirects/bulk
 * @body    { ids: string[] }
 */
router.delete('/bulk', async (req, res) => {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.filter((id) => mongoose.isValidObjectId(id)) : [];
    if (!ids.length) return res.status(400).json({ message: 'Select some redirects first.' });
    try {
        const result = await LinkRedirect.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${result.deletedCount} redirect(s) deleted.`, deleted: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/redirects/:id
 * @body    { to, status? }   Change where one redirect goes.
 */
router.put('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Redirect not found.' });
    try {
        const current = await LinkRedirect.findById(req.params.id).lean();
        if (!current) return res.status(404).json({ message: 'Redirect not found.' });
        let dest;
        try { dest = normalizeTo(req.body && req.body.to); } catch (error) { return res.status(400).json({ message: error.message }); }
        if (!dest.external && dest.path === current.from) return res.status(400).json({ message: 'That would send the page to itself.' });
        if (!dest.external) {
            const back = await LinkRedirect.findOne({ from: dest.path }).lean();
            if (back && !/^https?:\/\//i.test(back.to) && normalizeFrom(back.to) === current.from) {
                return res.status(400).json({ message: `That would loop: ${dest.path} already redirects back here.` });
            }
        }
        const status = Number(req.body && req.body.status) === 302 ? 302 : 301;
        const updated = await LinkRedirect.findByIdAndUpdate(req.params.id, { $set: { to: dest.to, status } }, { new: true }).lean();
        res.json({ message: 'Redirect updated.', redirect: updated });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/redirects/:id
 */
router.delete('/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Redirect not found.' });
    try {
        const deleted = await LinkRedirect.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Redirect not found.' });
        res.json({ message: 'Redirect deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
