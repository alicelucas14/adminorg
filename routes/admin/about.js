// backend/routes/admin/about.js
// Admin > About page: edit the website "About us" page (English + Hindi). See lib/about.js.
// The website reads it through GET /frontend-api/about and picks up a save within about 30 seconds.

const express = require('express');
const router = express.Router();
const { AboutPage } = require('../../models');
const { sanitizeAbout, defaultAbout, AboutValidationError, LIMITS } = require('../../lib/about');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

const STALE = 'Someone else saved the About page while you were editing. Reload the page to see their changes, then make yours again.';

/**
 * @route   GET /api/admin/about
 * @desc    The page as saved, or - when nothing was ever saved - the starting content (isDefault: true).
 *          `updatedAt` is echoed back on save so two people editing at once cannot overwrite each other.
 */
router.get('/', async (req, res) => {
    try {
        const doc = await AboutPage.findOne({ key: 'siteAbout' }).lean();
        if (!doc) return res.json({ ...defaultAbout(), isDefault: true, updatedAt: null, limits: LIMITS });
        res.json({ content: doc.content, isDefault: false, updatedAt: doc.updatedAt, limits: LIMITS });
    } catch (error) {
        console.error('Error loading the About page:', error);
        res.status(500).json({ message: 'Server Error while loading the About page.' });
    }
});

/**
 * @route   GET /api/admin/about/defaults
 * @desc    The starting content (what the screen's "Start over" button loads into the editor; nothing is saved).
 */
router.get('/defaults', (req, res) => res.json(defaultAbout()));

/**
 * @route   PUT /api/admin/about
 * @body    { content, updatedAt }  updatedAt = the value GET returned (null if it was the starting content)
 * @desc    Replaces the whole page. 400 = something to fix (message says what); 409 = saved by someone else meanwhile.
 */
router.put('/', async (req, res) => {
    try {
        let clean;
        try {
            clean = sanitizeAbout(req.body);
        } catch (error) {
            if (error instanceof AboutValidationError) return res.status(400).json({ message: error.message });
            throw error;
        }

        const existing = await AboutPage.findOne({ key: 'siteAbout' }).select('updatedAt').lean();
        const seen = req.body.updatedAt ? new Date(req.body.updatedAt).getTime() : null;
        const current = existing ? new Date(existing.updatedAt).getTime() : null;
        if (current !== seen) return res.status(409).json({ message: STALE });

        let saved;
        if (existing) {
            // matching on updatedAt too makes the check above atomic with the write
            saved = await AboutPage.findOneAndUpdate(
                { key: 'siteAbout', updatedAt: existing.updatedAt },
                { $set: { content: clean.content } },
                { new: true }
            ).lean();
            if (!saved) return res.status(409).json({ message: STALE });
        } else {
            try {
                saved = (await AboutPage.create({ key: 'siteAbout', content: clean.content })).toObject();
            } catch (error) {
                if (error && error.code === 11000) return res.status(409).json({ message: STALE });
                throw error;
            }
        }
        res.json({ message: 'About page saved. The website shows it within about 30 seconds.', content: saved.content, isDefault: false, updatedAt: saved.updatedAt });
    } catch (error) {
        console.error('Error saving the About page:', error);
        res.status(500).json({ message: 'Server Error while saving the About page.' });
    }
});

module.exports = router;
