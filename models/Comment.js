// ===== backend/models/Comment.js =====

const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  // Reference to the Review this comment belongs to.
  // This is crucial for fetching comments for a specific review.
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true,
    index: true, // Index for faster querying
  },
  // The randomized user name, e.g., "Rohan S."
  username: {
    type: String,
    required: true,
    trim: true,
  },
  // The star rating given by the "user".
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  // The actual text of the comment.
  text: {
    type: String,
    required: true,
    trim: true,
  },
  // The date the comment was created.
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;