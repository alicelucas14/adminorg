// backend/routes/admin/blog-comments.js
// --- NEW FILE ---

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../../middleware/authMiddleware');
const { BlogPost, BlogComment } = require('../../models');
const mongoose = require('mongoose');


//==============================================
// AI BLOG COMMENT GENERATION LOGIC
//==============================================

// --- OpenAI Logic ---
async function generateCommentsWithOpenAI(post, count, prompt) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) throw new Error('OpenAI API key is not configured.');
    const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        response_format: { type: "json_object" },
    });
    const content = JSON.parse(response.choices[0].message.content);
    const commentsArray = Array.isArray(content) ? content : Object.values(content)[0];
    if (!Array.isArray(commentsArray)) throw new Error('AI response was not a valid JSON array.');
    return commentsArray;
}

// --- Google Gemini Logic ---
async function generateCommentsWithGemini(post, count, prompt) {
    if (!process.env.GOOGLE_GEMINI_API_KEY) throw new Error('Google Gemini API key is not configured.');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = await response.text();
    text = text.replace(/^```json\s*/, '').replace(/```$/, '');
    const parsedJson = JSON.parse(text);
    const commentsArray = Array.isArray(parsedJson) ? parsedJson : Object.values(parsedJson)[0];
    if (!Array.isArray(commentsArray)) throw new Error('AI response was not a valid JSON array.');
    return commentsArray;
}


// --- AI Router ---
async function generateAiBlogComments(post, count) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  const prompt = `
    You are an AI assistant generating realistic user comments for a blog post on an Indian real-money gaming app's website.
    The blog post title is: "${post.title.en}".
    
    Based on this topic, generate ${count} user comments.
    Your output MUST be a valid JSON object with a single key "comments" which holds an array of comment objects. Each object in the array MUST have the following two keys and nothing else:
    1. "username": A realistic-sounding Indian name (e.g., "Ravi K.", "Sunita Gupta").
    2. "text": The comment text. The comment should sound like a real user reacting to the blog post. It can be a question, a thank you, or an observation related to the topic. Comments should be in English but can use common Indian-English phrasing. Keep comments concise, between 1-3 sentences.

    Example of the required JSON output format:
    {
      "comments": [
        {
          "username": "Vikram Singh",
          "text": "Great article! These tips are really helpful for a beginner like me. I'm going to try the bluffing strategy tonight."
        },
        {
          "username": "Anjali M.",
          "text": "Thanks for sharing. Can you write another post about advanced Rummy strategies?"
        }
      ]
    }

    Now, generate the JSON object for the given blog post.
  `;

  console.log(`Using ${provider} to generate comments for post: ${post.title.en}`);
  if (provider === 'gemini') {
    return generateCommentsWithGemini(post, count, prompt);
  }
  return generateCommentsWithOpenAI(post, count, prompt);
}

router.use(protect);


// --- ROUTES ---

/**
 * @route   POST /api/admin/blog-comments/generate
 * @desc    Generate and save AI comments for a SINGLE blog post.
 * @access  Private (Admin)
 */
router.post('/generate', async (req, res) => {
  const { postId, count = 5 } = req.body;

  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return res.status(400).json({ message: 'A valid Post ID is required.' });
  }

  try {
    const post = await BlogPost.findById(postId);
    if (!post) { return res.status(404).json({ message: 'Blog post not found.' }); }

    const generatedComments = await generateAiBlogComments(post, count);
    if (!generatedComments || generatedComments.length === 0) {
        return res.status(500).json({ message: 'AI failed to generate comments.' });
    }

    const commentsToSave = generatedComments.map(comment => ({
      postId: post._id, username: comment.username, text: comment.text,
    }));
    const savedComments = await BlogComment.insertMany(commentsToSave);

    res.status(201).json({
      message: `${savedComments.length} comments generated and saved for post "${post.title.en}".`,
      data: savedComments,
    });

  } catch (error) {
    console.error('Error in single blog comment generation route:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});


/**
 * @route   POST /api/admin/blog-comments/bulk-generate
 * @desc    Generate AI comments for MULTIPLE blog posts at once.
 * @access  Private (Admin)
 */
router.post('/bulk-generate', async (req, res) => {
    const { postIds, count = 3 } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
        return res.status(400).json({ message: 'An array of postIds is required.' });
    }

    let allCommentsToSave = [];
    let successfulPosts = 0;
    let failedPosts = [];

    for (const postId of postIds) {
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            failedPosts.push({ id: postId, reason: 'Invalid ID format' });
            continue;
        }
        
        try {
            const post = await BlogPost.findById(postId);
            if (!post) {
                failedPosts.push({ id: postId, reason: 'Post not found' });
                continue;
            }

            const generatedComments = await generateAiBlogComments(post, count);
            if (generatedComments && generatedComments.length > 0) {
                const comments = generatedComments.map(c => ({
                    postId: post._id, username: c.username, text: c.text
                }));
                allCommentsToSave.push(...comments);
                successfulPosts++;
            } else {
                failedPosts.push({ id: postId, reason: 'AI returned no comments' });
            }
        } catch (error) {
            console.error(`Failed to generate comments for post ${postId}:`, error.message);
            failedPosts.push({ id: postId, reason: error.message });
        }
    }

    if (allCommentsToSave.length > 0) {
        await BlogComment.insertMany(allCommentsToSave);
    }

    res.status(201).json({
        message: `Bulk generation complete. Successfully generated ${allCommentsToSave.length} comments for ${successfulPosts} post(s).`,
        failures: failedPosts.length,
        failedPosts: failedPosts
    });
});

module.exports = router;