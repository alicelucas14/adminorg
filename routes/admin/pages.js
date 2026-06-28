// backend/routes/admin/pages.js

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Page } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

//==============================================
// AI PAGE CONTENT GENERATION LOGIC
//==============================================

async function generatePageWithOpenAI(topic, lang) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const language = lang === 'hi' ? 'Hindi' : 'English';
  const prompt = `
    You are an expert website designer and content writer for an Indian real-money gaming app called Starsuu7.
    Your task is to write high-quality, professional, and SEO-optimized content in Markdown format for a website page.
    The topic/purpose of the page is: "${topic}".
    The tone should be professional, clear, and trustworthy.
    Use Markdown headings, paragraphs, bullet points, and bold text to structure the content beautifully.
    The content should be detailed and thorough.
    The language of the page content MUST be ${language}.
    Return a single JSON object with one key: "body". The value should be the complete Markdown content of the webpage.
  `;
  const response = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    response_format: { type: "json_object" },
  });
  const content = JSON.parse(response.choices[0].message.content);
  return content;
}

async function generatePageWithGemini(topic, lang) {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const language = lang === 'hi' ? 'Hindi' : 'English';
  const prompt = `
    You are an expert website designer and content writer for an Indian real-money gaming app called Starsuu7.
    Your task is to write high-quality, professional, and SEO-optimized content in Markdown format for a website page.
    The topic/purpose of the page is: "${topic}".
    The tone should be professional, clear, and trustworthy.
    Use Markdown headings, paragraphs, bullet points, and bold text to structure the content beautifully.
    The content should be detailed and thorough.
    The language of the page content MUST be ${language}.
    Return a single JSON object with one key: "body". The value should be the complete Markdown content of the webpage. Do not wrap the JSON in markdown backticks.
  `;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();
  return JSON.parse(text);
}

async function generateAiPageContent(topic, lang) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  console.log(`Generating custom page content for topic "${topic}" using ${provider}...`);

  if (provider === 'gemini') {
    return generatePageWithGemini(topic, lang);
  }
  return generatePageWithOpenAI(topic, lang);
}

/**
 * @route   POST /api/admin/pages/generate-content
 * @desc    Generate body content for a custom page using AI
 * @access  Private (Admin)
 */
router.post('/generate-content', async (req, res) => {
    const { topic, lang = 'en' } = req.body;
    if (!topic) {
        return res.status(400).json({ message: 'A topic is required to generate content.' });
    }
    try {
        const generatedContent = await generateAiPageContent(topic, lang);
        res.json(generatedContent);
    } catch (error) {
        console.error("Error generating page content:", error);
        res.status(500).json({ message: 'Failed to generate content from AI service.', error: error.message });
    }
});


//==============================================
// CRUD ROUTES
//==============================================

/**
 * @route   GET /api/admin/pages
 * @desc    Get all custom pages with pagination and search
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
        const [pages, totalItems] = await Promise.all([
            Page.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Page.countDocuments(filter)
        ]);
        res.json({ data: pages, totalItems, currentPage: page, totalPages: Math.ceil(totalItems / limit) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/pages/bulk-delete
 * @desc    Delete multiple pages at once
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of page IDs.' });
    }
    try {
        const result = await Page.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No pages found with the provided IDs.' });
        }
        res.json({ message: `${result.deletedCount} page(s) deleted successfully.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/pages
 * @desc    Create a new custom page
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    const {
        slug, title, body, isPublished,
        metaTitle, metaDescription, focusKeyword, canonicalUrl, robotsIndex, robotsFollow,
        openGraphTitle, openGraphDescription, openGraphImage, twitterTitle, twitterDescription
    } = req.body;
    if (!slug || !title || !body) {
        return res.status(400).json({ message: 'Please provide slug, title, and body.' });
    }
    const requiredFields = ['title', 'body'];
    for (const field of requiredFields) {
        if (typeof req.body[field] !== 'object' || !req.body[field].en || !req.body[field].hi) {
            return res.status(400).json({ message: `Field '${field}' must be an object with 'en' and 'hi' properties.` });
        }
    }
    try {
        const newPage = new Page({
            slug, title, body, isPublished,
            metaTitle, metaDescription, focusKeyword, canonicalUrl, robotsIndex, robotsFollow,
            openGraphTitle, openGraphDescription, openGraphImage, twitterTitle, twitterDescription
        });
        const savedPage = await newPage.save();
        res.status(201).json(savedPage);
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ message: `A page with slug '${slug}' already exists.` });
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/pages/:id
 * @desc    Get a single page by its MongoDB _id for editing
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const page = await Page.findById(req.params.id);
        if (!page) { return res.status(404).json({ message: 'Page not found' }); }
        res.json(page);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/pages/:id
 * @desc    Update a custom page
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedPage = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedPage) { return res.status(404).json({ message: 'Page not found' }); }
        res.json(updatedPage);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/pages/:id
 * @desc    Delete a custom page
 * @access  Private (Admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedPage = await Page.findByIdAndDelete(req.params.id);
        if (!deletedPage) { return res.status(404).json({ message: 'Page not found' }); }
        res.json({ message: 'Page deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
