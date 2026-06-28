// backend/routes/admin/popup-banners.js
const express = require('express');
const router = express.Router();
const { PopupBanner } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

/**
 * @route   GET /api/admin/popup-banners
 * @desc    Get all popup banners with pagination and search
 * @access  Private (Admin)
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search;
        const filter = {};
        
        if (searchQuery) {
            const regex = new RegExp(searchQuery, 'i');
            filter.$or = [ { 'title.en': regex }, { 'title.hi': regex } ];
        }
        
        const [banners, totalItems] = await Promise.all([
            PopupBanner.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip(skip).limit(limit),
            PopupBanner.countDocuments(filter)
        ]);
        
        res.json({ data: banners, totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/popup-banners/bulk-delete
 * @desc    Delete multiple popup banners
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of item IDs.' });
    }
    try {
        const result = await PopupBanner.deleteMany({ _id: { $in: ids } });
        res.json({ message: `${result.deletedCount} banner(s) deleted.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/popup-banners
 * @desc    Create a new popup banner
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    const { title, imageUrl, linkUrl, isActive, displayOrder } = req.body;
    if (!title || !imageUrl) {
        return res.status(400).json({ message: 'Please provide title and banner image.' });
    }
    if (typeof title !== 'object' || !title.en || !title.hi) {
        return res.status(400).json({ message: "Title must be localized with 'en' and 'hi' properties." });
    }
    try {
        const newBanner = new PopupBanner({
            title, imageUrl, linkUrl, isActive, displayOrder: displayOrder || 0
        });
        const savedBanner = await newBanner.save();
        res.status(201).json(savedBanner);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/popup-banners/:id
 * @desc    Get a single popup banner
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const banner = await PopupBanner.findById(req.params.id);
        if (!banner) { return res.status(404).json({ message: 'Banner not found' }); }
        res.json(banner);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/popup-banners/:id
 * @desc    Update an existing popup banner
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedBanner = await PopupBanner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedBanner) { return res.status(404).json({ message: 'Banner not found' }); }
        res.json(updatedBanner);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/popup-banners/:id
 * @desc    Delete a popup banner
 * @access  Private (Admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedBanner = await PopupBanner.findByIdAndDelete(req.params.id);
        if (!deletedBanner) { return res.status(404).json({ message: 'Banner not found' }); }
        res.json({ message: 'Banner deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
