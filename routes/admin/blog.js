// backend/routes/admin/blog.js
// --- UPDATED: Added AI content generation for blog posts ---

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai'); // <-- IMPORT OpenAI
const { GoogleGenerativeAI } = require('@google/generative-ai'); // <-- IMPORT Gemini
const { BlogPost } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

//==============================================
// AI BLOG POST GENERATION LOGIC
//==============================================

// --- OpenAI Logic ---
async function generateBlogPostWithOpenAI(topic, lang) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const language = lang === 'hi' ? 'Hindi' : 'English';
  const prompt = `
    You are an expert content writer for an Indian real-money gaming app called Starsuu7.
    Your task is to write an engaging and informative blog post body in Markdown format.
    The topic for the post is: "${topic}".
    The tone should be enthusiastic, helpful, and targeted towards gamers in India.
    Use Markdown headings, bullet points, and bold text to structure the content and make it highly readable.
    The post should be approximately 3-5 paragraphs long.
    The language of the post MUST be ${language}.
    Return a single JSON object with one key: "body". The value should be the complete Markdown content of the blog post.
  `;
  const response = await openai.chat.completions.create({
    model: "gpt-5", // Using the model name you provided
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  const content = JSON.parse(response.choices[0].message.content);
  return content;
}

// --- Google Gemini Logic ---
async function generateBlogPostWithGemini(topic, lang) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Using the model name you provided
  const language = lang === 'hi' ? 'Hindi' : 'English';
  const prompt = `
    You are an expert content writer for an Indian real-money gaming app called Starsuu7.
    Your task is to write an engaging and informative blog post body in Markdown format.
    The topic for the post is: "${topic}".
    The tone should be enthusiastic, helpful, and targeted towards gamers in India.
    Use Markdown headings, bullet points, and bold text to structure the content and make it highly readable.
    The post should be approximately 3-5 paragraphs long.
    The language of the post MUST be ${language}.
    Return a single JSON object with one key: "body". The value should be the complete Markdown content of the blog post. Do not wrap the JSON in markdown backticks.
  `;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();
  return JSON.parse(text);
}

// --- AI Router ---
async function generateAiBlogPost(topic, lang) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  console.log(`Generating blog content for topic "${topic}" using ${provider}...`);

  if (provider === 'gemini') {
    return generateBlogPostWithGemini(topic, lang);
  }
  return generateBlogPostWithOpenAI(topic, lang);
}


/**
 * @route   POST /api/admin/blog/generate-content
 * @desc    Generate body content for a blog post using AI
 * @access  Private (Admin)
 */
router.post('/generate-content', async (req, res) => {
    const { topic, lang = 'en' } = req.body;
    if (!topic) {
        return res.status(400).json({ message: 'A topic is required to generate content.' });
    }
    try {
        const generatedContent = await generateAiBlogPost(topic, lang);
        res.json(generatedContent);
    } catch (error) {
        console.error("Error generating blog content:", error);
        res.status(500).json({ message: 'Failed to generate content from AI service.', error: error.message });
    }
});


// --- Existing CRUD Routes (unchanged) ---

/**
 * @route   GET /api/admin/blog
 * @desc    Get all blog posts with pagination and search for the admin panel
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
            filter.$or = [ { 'title.en': regex }, { 'title.hi': regex }, { slug: regex } ];
        }
        const [posts, totalItems] = await Promise.all([
            BlogPost.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit),
            BlogPost.countDocuments(filter)
        ]);
        res.json({ data: posts, totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/blog/bulk-delete
 * @desc    Delete multiple blog posts at once
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of item IDs.' });
    }
    try {
        const result = await BlogPost.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No blog posts found with the provided IDs.' });
        }
        res.json({ message: `${result.deletedCount} post(s) deleted successfully.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/blog
 * @desc    Create a new blog post
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    const { slug, title, excerpt, body, author, image, tags, publishedAt, isPublished, metaTitle, metaDescription } = req.body;
    if (!slug || !title || !excerpt || !body || !image) {
        return res.status(400).json({ message: 'Please provide slug, title, excerpt, body, and image.' });
    }
    const requiredFields = ['title', 'excerpt', 'body'];
    for (const field of requiredFields) {
        if (typeof req.body[field] !== 'object' || !req.body[field].en || !req.body[field].hi) {
            return res.status(400).json({ message: `Field '${field}' must be an object with 'en' and 'hi' properties.` });
        }
    }
    try {
        const newPost = new BlogPost({ slug, title, excerpt, body, author, image, tags, publishedAt: publishedAt || new Date(), isPublished, metaTitle, metaDescription });
        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: `A blog post with slug '${slug}' already exists.` });
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/blog/:id
 * @desc    Get a single blog post by its MongoDB _id for editing
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) { return res.status(404).json({ message: 'Blog post not found' }); }
        res.json(post);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/blog/:id
 * @desc    Update a blog post
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedPost = await BlogPost.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedPost) { return res.status(404).json({ message: 'Blog post not found' }); }
        res.json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/blog/:id
 * @desc    Delete a blog post
 * @access  Private (Admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedPost = await BlogPost.findByIdAndDelete(req.params.id);
        if (!deletedPost) { return res.status(404).json({ message: 'Blog post not found' }); }
        res.json({ message: 'Blog post deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;