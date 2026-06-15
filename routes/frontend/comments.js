// ===== backend/routes/frontend/comments.js =====

const express = require('express');
const router = express.Router();
const { Comment } = require('../../models');
const mongoose = require('mongoose');

/**
 * @route   GET /api/frontend/comments/:reviewId
 * @desc    Get all comments for a specific review, sorted by newest first.
 * @access  Public
 */
router.get('/:reviewId', async (req, res) => {
    try {
        const { reviewId } = req.params;

        // Validate that the provided ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ message: 'Invalid Review ID format.' });
        }

        const comments = await Comment.find({ reviewId: reviewId })
            .sort({ createdAt: -1 }) // Show newest comments first
            .limit(50); // Limit to a reasonable number of comments per page load

        // It's okay to return an empty array if there are no comments yet
        res.json(comments);

    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;