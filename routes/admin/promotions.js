// backend/routes/admin/promotions.js
// --- REVERTED: Removed the unnecessary rebuild trigger for SSR mode ---

const express = require('express');
const router = express.Router();
// fetch is no longer needed
const { Promotion } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

// Protect all routes in this file
router.use(protect);

// --- REMOVED: The triggerRebuild function is no longer needed ---

/**
 * @route   GET /api/admin/promotions
 * @desc    Get all promotions with pagination and search for the admin panel
 * @access  Private (Admin)
 */
router.get('/', async (request, response) => {
    try {
        const page = parseInt(request.query.page) || 1;
        const limit = parseInt(request.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchQuery = request.query.search;

        const filter = {};
        if (searchQuery) {
            const regex = new RegExp(searchQuery, 'i');
            filter.$or = [
                { 'title.en': regex },
                { 'title.hi': regex },
                { slug: regex }
            ];
        }

        const [promotions, totalItems] = await Promise.all([
            Promotion.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
            Promotion.countDocuments(filter)
        ]);

        response.json({
            data: promotions,
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        });
    } catch (error) {
        response.status(500).json({ message: 'Server Error while fetching promotions.', error: error.message });
    }
});

/**
 * @route   POST /api/admin/promotions
 * @desc    Create a new promotion
 * @access  Private (Admin)
 */
router.post('/', async (request, response) => {
    const { slug, title, description, imageUrl, displayOrder } = request.body;

    if (!slug || !title || !description || !imageUrl) {
        return response.status(400).json({ message: 'Please provide slug, title, description, and imageUrl.' });
    }

    try {
        const newPromotion = new Promotion({
            ...request.body
        });
        const savedPromotion = await newPromotion.save();
        response.status(201).json(savedPromotion);
        // --- Rebuild trigger removed ---
    } catch (error) {
        if (error.code === 11000) {
            return response.status(400).json({ message: `A promotion with slug '${slug}' already exists.` });
        }
        response.status(500).json({ message: 'Server Error while creating promotion.', error: error.message });
    }
});

/**
 * @route   GET /api/admin/promotions/:id
 * @desc    Get a single promotion by its MongoDB _id for editing
 * @access  Private (Admin)
 */
router.get('/:id', async (request, response) => {
    try {
        const promotion = await Promotion.findById(request.params.id);
        if (!promotion) {
            return response.status(404).json({ message: 'Promotion not found' });
        }
        response.json(promotion);
    } catch (error) {
        response.status(500).json({ message: 'Server Error while fetching promotion.', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/promotions/:id
 * @desc    Update a promotion
 * @access  Private (Admin)
 */
router.put('/:id', async (request, response) => {
    try {
        const updatedPromotion = await Promotion.findByIdAndUpdate(
            request.params.id,
            request.body,
            { new: true, runValidators: true }
        );
        if (!updatedPromotion) {
            return response.status(404).json({ message: 'Promotion not found' });
        }
        response.json(updatedPromotion);
        // --- Rebuild trigger removed ---
    } catch (error) {
        response.status(500).json({ message: 'Server Error while updating promotion.', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/promotions/bulk-delete
 * @desc    Delete multiple promotions at once
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (request, response) => {
    const { ids } = request.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return response.status(400).json({ message: 'Please provide an array of item IDs.' });
    }

    try {
        const result = await Promotion.deleteMany({ _id: { $in: ids } });
        response.json({ message: `${result.deletedCount} promotion(s) deleted successfully.` });
        // --- Rebuild trigger removed ---
    } catch (error) {
        response.status(500).json({ message: 'Server Error while bulk deleting promotions.', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/promotions/:id
 * @desc    Delete a single promotion
 * @access  Private (Admin)
 */
router.delete('/:id', async (request, response) => {
    try {
        const deletedPromotion = await Promotion.findByIdAndDelete(request.params.id);
        if (!deletedPromotion) {
            return response.status(404).json({ message: 'Promotion not found' });
        }
        response.json({ message: 'Promotion deleted successfully.' });
        // --- Rebuild trigger removed ---
    } catch (error) {
        response.status(500).json({ message: 'Server Error while deleting promotion.', error: error.message });
    }
});

module.exports = router;