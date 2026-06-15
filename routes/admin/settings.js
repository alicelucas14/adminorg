// backend/routes/admin/settings.js
// --- REVERTED: Removed the rebuild trigger for simplification ---

const express = require('express');
const router = express.Router();
// fetch is no longer needed
const { Setting } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

// Protect all routes in this file
router.use(protect);

// --- REMOVED: The triggerRebuild function is no longer needed ---

/**
 * @route   GET /api/admin/settings
 * @desc    Get the current site settings. It will create the settings document if it doesn't exist.
 * @access  Private (Admin)
 */
router.get('/', async (request, response) => {
    try {
        const settings = await Setting.findOneAndUpdate(
            { key: 'siteSettings' },
            { $setOnInsert: { key: 'siteSettings' } },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );
        response.json(settings);
    } catch (error) {
        console.error('Error fetching/creating settings:', error);
        response.status(500).json({ message: 'Server Error while fetching settings.', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/settings
 * @desc    Update the site settings.
 * @access  Private (Admin)
 */
router.put('/', async (request, response) => {
    try {
        const updatedSettings = await Setting.findOneAndUpdate(
            { key: 'siteSettings' },
            request.body,
            { new: true, runValidators: true }
        );

        if (!updatedSettings) {
            return response.status(404).json({ message: 'Settings document not found. Please reload the page and try again.' });
        }
        
        // --- Rebuild trigger removed ---

        response.json({
            message: 'Settings updated successfully!',
            settings: updatedSettings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        response.status(500).json({ message: 'Server Error while updating settings.', error: error.message });
    }
});

module.exports = router;