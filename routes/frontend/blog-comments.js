// backend/routes/frontend/blog-comments.js
// --- NEW FILE ---

const express = require('express');
const router = express.Router();
const { BlogComment } = require('../../models');
const mongoose = require('mongoose');

/**
 * @route   GET /api/frontend/blog-comments/:postId
 * @desc    Get all comments for a specific blog post, sorted by newest first.
 * @access  Public
 */
router.get('/:postId', async (req, res) => {
    try {
        const { postId } = req.params;

        // Validate that the provided ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ message: 'Invalid Post ID format.' });
        }

        const comments = await BlogComment.find({ postId: postId })
            .sort({ createdAt: -1 }) // Show newest comments first
            .limit(50); // Limit to a reasonable number

        // It is acceptable to return an empty array if there are no comments.
        res.json(comments);

    } catch (error) {
        console.error('Error fetching blog comments:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;