// backend/models/BlogComment.js
// --- NEW FILE ---

const mongoose = require('mongoose');

const BlogCommentSchema = new mongoose.Schema({
    // Link to the BlogPost model
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'BlogPost'
    },
    username: {
        type: String,
        required: [true, 'Username is required.']
    },
    text: {
        type: String,
        required: [true, 'Comment text is required.']
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

const BlogComment = mongoose.model('BlogComment', BlogCommentSchema);

module.exports = BlogComment;