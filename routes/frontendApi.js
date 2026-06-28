// ===== backend/routes/frontendApi.js =====
// --- CONSOLIDATED: Now contains all read-only routes, protected by API Key ---

const express = require('express');
const router = express.Router();
const { Promotion, Setting, Game, BlogPost, Review, Page } = require('../models');
const { requireApiKey } = require('../middleware/apiKeyMiddleware');

// Protect all routes in this file with the API Key middleware.
router.use(requireApiKey);

/**
 * @route   GET /frontend-api/settings
 * @desc    Get the global site settings.
 * @access  Private (API Key)
 */
router.get('/settings', async (request, response) => {
    try {
        const settings = await Setting.findOne({ key: 'siteSettings' });
        if (!settings) {
            return response.status(404).json({ message: 'Site settings not found.' });
        }
        response.json(settings);
    } catch (error) {
        response.status(500).json({ message: 'Server error while fetching settings.' });
    }
});

/**
 * @route   GET /frontend-api/promotions
 * @desc    Get all published promotions.
 * @access  Private (API Key)
 */
router.get('/promotions', async (request, response) => {
    try {
        const lang = request.query.lang || 'en';
        const promotions = await Promotion.find({ isPublished: true }).sort({ displayOrder: 1, createdAt: -1 });

        const translatedPromotions = promotions.map(promo => {
            const langKey = lang === 'hi' ? 'hi' : 'en';
            return {
                _id: promo._id,
                slug: promo.slug,
                title: promo.title[langKey],
                subtitle: promo.subtitle ? promo.subtitle[langKey] : '',
                description: promo.description[langKey],
                details: promo.details ? promo.details[langKey] : [],
                ctaText: promo.ctaText ? promo.ctaText[langKey] : '',
                badgeText: promo.badgeText ? promo.badgeText[langKey] : '',
                imageUrl: promo.imageUrl,
                ctaLink: promo.ctaLink,
                badgeColor: promo.badgeColor,
            };
        });
            
        response.json(translatedPromotions);
    } catch (error) {
        response.status(500).json({ message: 'Server error while fetching promotions.' });
    }
});

/**
 * @route   GET /frontend-api/games
 * @desc    Get all active games.
 * @access  Private (API Key)
 */
router.get('/games', async (req, res) => {
    try {
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const gamesFromDb = await Game.find({ isActive: true }).sort({ createdAt: -1 });
        const formattedGames = gamesFromDb.map(game => ({
            _id: game._id,
            gameId: game.gameId,
            name: game.name[lang],
            category: game.category,
            provider: game.provider,
            image: game.image,
            isNew: game.isNew,
            isHot: game.isHot,
        }));
        res.json(formattedGames);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching games.' });
    }
});

/**
 * @route   GET /frontend-api/blog
 * @desc    Get all published blog posts.
 * @access  Private (API Key)
 */
router.get('/blog', async (req, res) => {
    try {
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const postsFromDb = await BlogPost.find({ isPublished: true }).sort({ publishedAt: -1 });
        const formattedPosts = postsFromDb.map(post => ({
            _id: post._id,
            slug: post.slug,
            title: post.title[lang],
            excerpt: post.excerpt[lang],
            author: post.author,
            image: post.image,
            tags: post.tags,
            publishedAt: post.publishedAt,
            focusKeyword: post.focusKeyword,
            canonicalUrl: post.canonicalUrl,
            robotsIndex: post.robotsIndex,
            robotsFollow: post.robotsFollow,
            openGraphTitle: post.openGraphTitle,
            openGraphDescription: post.openGraphDescription,
            openGraphImage: post.openGraphImage,
            twitterTitle: post.twitterTitle,
            twitterDescription: post.twitterDescription
        }));
        res.json(formattedPosts);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching blog posts.' });
    }
});

/**
 * @route   GET /frontend-api/blog/:slug
 * @desc    Get a single blog post by its slug.
 * @access  Private (API Key)
 */
router.get('/blog/:slug', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true })
            .select({
                [`title.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`excerpt.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`body.${lang === 'en' ? 'hi' : 'en'}`]: 0,
            });
        if (!post) {
            return res.status(404).json({ message: 'Blog post not found.' });
        }
        res.json(post);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching blog post.' });
    }
});

/**
 * @route   GET /frontend-api/reviews
 * @desc    Get all published reviews.
 * @access  Private (API Key)
 */
router.get('/reviews', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        
        // --- THE FIX STARTS HERE ---
        // 1. Fetch the documents, selecting the full title and excerpt objects.
        const reviewsFromDb = await Review.find({ isPublished: true })
            .select('slug title excerpt gameName rating image')
            .sort({ createdAt: -1 })
            .lean(); // Use .lean() for better performance as we don't need Mongoose methods.

        // 2. Manually transform the data into the simple format the frontend needs.
        const formattedReviews = reviewsFromDb.map(review => ({
            _id: review._id,
            slug: review.slug,
            title: review.title ? review.title[lang] : '', // Safely access the language key
            excerpt: review.excerpt ? review.excerpt[lang] : '', // Safely access the language key
            gameName: review.gameName,
            rating: review.rating,
            image: review.image,
        }));
        // --- THE FIX ENDS HERE ---

        res.json(formattedReviews);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching reviews.' });
    }
});

/**
 * @route   GET /frontend-api/reviews/:slug
 * @desc    Get a single review by its slug.
 * @access  Private (API Key)
 */
router.get('/reviews/:slug', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const review = await Review.findOne({ slug: req.params.slug, isPublished: true })
            .select({
                [`title.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`excerpt.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`body.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`pros.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`cons.${lang === 'en' ? 'hi' : 'en'}`]: 0,
            });
        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        res.json(review);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching review.' });
    }
});

/**
 * @route   GET /frontend-api/pages
 * @desc    Get all published custom pages.
 * @access  Private (API Key)
 */
router.get('/pages', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const pagesFromDb = await Page.find({ isPublished: true }).sort({ createdAt: -1 });
        const formattedPages = pagesFromDb.map(p => ({
            _id: p._id,
            slug: p.slug,
            title: p.title ? p.title[lang === 'hi' ? 'hi' : 'en'] : '',
            updatedAt: p.updatedAt
        }));
        res.json(formattedPages);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching pages.' });
    }
});

/**
 * @route   GET /frontend-api/pages/:slug
 * @desc    Get a single custom page by its slug.
 * @access  Private (API Key)
 */
router.get('/pages/:slug', async (req, res) => {
    try {
        const lang = req.query.lang || 'en';
        const page = await Page.findOne({ slug: req.params.slug, isPublished: true })
            .select({
                [`title.${lang === 'en' ? 'hi' : 'en'}`]: 0,
                [`body.${lang === 'en' ? 'hi' : 'en'}`]: 0,
            });
        if (!page) {
            return res.status(404).json({ message: 'Page not found.' });
        }
        res.json(page);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching page.' });
    }
});

module.exports = router;