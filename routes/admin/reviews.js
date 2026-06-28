// backend/routes/admin/reviews.js
// --- UPDATED: Replaced the manual AI endpoint with an automatic, one-click generator ---

const express = require('express');
const router = express.Router();
const { Review, Comment, Game } = require('../../models'); // <-- IMPORT Game model
const { protect } = require('../../middleware/authMiddleware');
const { generateReviewWithAI, generateCommentsForReview } = require('../../lib/aiContent');

// Helper to create a URL-friendly slug from a string
const slugify = (text) => {
    if (!text) return '';
    return text.toString().toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

//==============================================
// ROUTES
//==============================================

router.use(protect);

/**
 * @route   POST /api/admin/reviews/generate-from-game/:gameId
 * @desc    Generate a new review and comments automatically from an existing game.
 * @access  Private (Admin)
 */
router.post('/generate-from-game/:gameId', async (req, res) => {
    try {
        // Step 1: Find the game in the database using its ID
        const game = await Game.findById(req.params.gameId);
        if (!game) {
            return res.status(404).json({ message: 'Game not found.' });
        }

        const { name, provider, image } = game;

        // Step 2: Generate the core review content from AI
        const aiContent = await generateReviewWithAI(name.en, provider);

        // Step 3: Check if a review with this slug already exists to prevent duplicates
        const slug = slugify(aiContent.title.en);
        const existingReview = await Review.findOne({ slug });
        if (existingReview) {
            return res.status(409).json({ message: `A review with a similar title ('${aiContent.title.en}') already exists.` });
        }

        // Step 4: Create and save the new Review document
        const newReview = new Review({
            ...aiContent,
            gameName: name.en, // Use the game's actual name
            developer: provider, // Use the game's actual provider
            image: image, // Use the game's actual image
            slug: slug,
            isPublished: true,
        });
        const savedReview = await newReview.save();

        // Step 5: Generate comments for the newly created review
        const generatedComments = await generateCommentsForReview(savedReview, 5);

        // Step 6: Save the comments to the database
        const commentsToSave = generatedComments.map(comment => ({
            reviewId: savedReview._id,
            username: comment.username,
            rating: comment.rating,
            text: comment.text,
        }));
        await Comment.insertMany(commentsToSave);

        res.status(201).json({ 
            message: `Successfully generated a new review for "${name.en}" with ${generatedComments.length} comments.`,
            review: savedReview 
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error during AI generation.', error: error.message });
    }
});


/**
 * @route   GET /api/admin/reviews
 * @desc    Get all reviews with pagination and search for the admin panel
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
            filter.$or = [
                { 'title.en': regex },
                { 'title.hi': regex },
                { slug: regex },
                { gameName: regex }
            ];
        }

        const [reviews, totalItems] = await Promise.all([
            Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Review.countDocuments(filter)
        ]);

        res.json({
            data: reviews,
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/reviews/bulk-delete
 * @desc    Delete multiple reviews at once
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of item IDs.' });
    }

    try {
        await Review.deleteMany({ _id: { $in: ids } });
        await Comment.deleteMany({ reviewId: { $in: ids } });
        res.json({ message: `${ids.length} review(s) and associated comments deleted successfully.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});


/**
 * @route   POST /api/admin/reviews
 * @desc    Create a new review (Manual)
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    const { slug, title, excerpt, body, gameName, developer, rating, image, pros, cons, isPublished, metaTitle, metaDescription, schemaMarkup } = req.body;
    if (!slug || !title || !excerpt || !body || !gameName || !developer || !rating || !image) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }
    const requiredTextFields = ['title', 'excerpt', 'body'];
    for (const field of requiredTextFields) {
        if (typeof req.body[field] !== 'object' || !req.body[field].en || !req.body[field].hi) {
            return res.status(400).json({ message: `Field '${field}' must be an object with 'en' and 'hi' properties.` });
        }
    }

    try {
        const newReview = new Review({
            slug, title, excerpt, body, gameName, developer, rating, image, pros, cons, isPublished, metaTitle, metaDescription, schemaMarkup
        });
        const savedReview = await newReview.save();
        res.status(201).json(savedReview);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: `A review with slug '${slug}' already exists.` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/reviews/:id
 * @desc    Get a single review by its MongoDB _id for editing
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) { return res.status(404).json({ message: 'Review not found' }); }
        res.json(review);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/reviews/:id
 * @desc    Update a review
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedReview = await Review.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedReview) { return res.status(404).json({ message: 'Review not found' }); }
        res.json(updatedReview);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Delete a review
 * @access  Private (Admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedReview = await Review.findByIdAndDelete(req.params.id);
        if (!deletedReview) { return res.status(404).json({ message: 'Review not found' }); }
        await Comment.deleteMany({ reviewId: req.params.id });
        res.json({ message: 'Review and associated comments deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;