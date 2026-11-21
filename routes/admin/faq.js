// backend/routes/admin/faq.js
// Admin > FAQ: edit the website FAQ page (English + Hindi). See lib/faq.js.
// The website reads it through GET /frontend-api/faq and picks up a save within about 30 seconds.

const express = require('express');
const router = express.Router();
const { Faq } = require('../../models');
const { sanitizeFaq, defaultFaq, FaqValidationError, LIMITS } = require('../../lib/faq');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

/**
 * @route   GET /api/admin/faq
 * @desc    The FAQ as saved, or - when nothing was ever saved - the starting FAQ (isDefault: true).
 *          `updatedAt` is echoed back on save so two people editing at once cannot overwrite each other.
 */
router.get('/', async (req, res) => {
    try {
        const doc = await Faq.findOne({ key: 'siteFaq' }).lean();
        if (!doc) return res.json({ ...defaultFaq(), isDefault: true, updatedAt: null, limits: LIMITS });
        res.json({ sections: doc.sections, isDefault: false, updatedAt: doc.updatedAt, limits: LIMITS });
    } catch (error) {
        console.error('Error loading the FAQ:', error);
        res.status(500).json({ message: 'Server Error while loading the FAQ.' });
    }
});

/**
 * @route   GET /api/admin/faq/defaults
 * @desc    The starting FAQ (what the screen's "Start over" button loads into the editor; nothing is saved).
 */
router.get('/defaults', (req, res) => res.json(defaultFaq()));

/**
 * @route   PUT /api/admin/faq
 * @body    { sections, updatedAt }  updatedAt = the value GET returned (null if it was the starting FAQ)
 * @desc    Replaces the whole FAQ. 400 = something to fix (message says what); 409 = saved by someone else meanwhile.
 */
router.put('/', async (req, res) => {
    try {
        let clean;
        try {
            clean = sanitizeFaq(req.body);
        } catch (error) {
            if (error instanceof FaqValidationError) return res.status(400).json({ message: error.message });
            throw error;
        }

        const existing = await Faq.findOne({ key: 'siteFaq' }).select('updatedAt').lean();
        const seen = req.body.updatedAt ? new Date(req.body.updatedAt).getTime() : null;
        const current = existing ? new Date(existing.updatedAt).getTime() : null;
        if (current !== seen) {
            return res.status(409).json({ message: 'Someone else saved the FAQ while you were editing. Reload the page to see their changes, then make yours again.' });
        }

        let saved;
        if (existing) {
            // matching on updatedAt too makes the check above atomic with the write
            saved = await Faq.findOneAndUpdate(
                { key: 'siteFaq', updatedAt: existing.updatedAt },
                { $set: { sections: clean.sections } },
                { new: true }
            ).lean();
            if (!saved) return res.status(409).json({ message: 'Someone else saved the FAQ while you were editing. Reload the page to see their changes, then make yours again.' });
        } else {
            try {
                saved = (await Faq.create({ key: 'siteFaq', sections: clean.sections })).toObject();
            } catch (error) {
                if (error && error.code === 11000) return res.status(409).json({ message: 'Someone else saved the FAQ while you were editing. Reload the page to see their changes, then make yours again.' });
                throw error;
            }
        }
        res.json({ message: 'FAQ saved. The website shows it within about 30 seconds.', sections: saved.sections, isDefault: false, updatedAt: saved.updatedAt });
    } catch (error) {
        console.error('Error saving the FAQ:', error);
        res.status(500).json({ message: 'Server Error while saving the FAQ.' });
    }
});

module.exports = router;
