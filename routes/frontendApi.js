// ===== backend/routes/frontendApi.js =====
// --- CONSOLIDATED: Now contains all read-only routes, protected by API Key ---

const express = require('express');
const router = express.Router();
const { Promotion, Setting, Game, BlogPost, Review, Page, PopupBanner } = require('../models');
const { requireApiKey } = require('../middleware/apiKeyMiddleware');

// Protect all routes in this file with the API Key middleware.
router.use(requireApiKey);

// --- Translation helpers ---------------------------------------------------
const hasText = (v) => typeof v === 'string' && v.trim().length > 0;

// Languages in which every required field has real text (empty placeholders don't count).
const availableLangs = (doc, fields) =>
    ['en', 'hi'].filter((l) => fields.every((field) => hasText(doc[field] && doc[field][l])));

// Untranslated Hindi text is stored as "[HI] <english text>". Such a page exists but must not be
// indexed or advertised as a translation until a real Hindi version replaces the placeholder.
const PLACEHOLDER_RE = /\[HI\]/;
const hasPlaceholder = (value) => {
    if (typeof value === 'string') return PLACEHOLDER_RE.test(value);
    if (Array.isArray(value)) return value.some(hasPlaceholder);
    return false;
};
const isPlaceholderLang = (doc, lang, fields) =>
    lang === 'hi' && fields.some((field) => hasPlaceholder(doc[field] && doc[field][lang]));

// Languages that are both real and worth indexing (no placeholder text).
const indexableLangs = (doc, requiredFields, localizedFields) =>
    availableLangs(doc, requiredFields).filter((l) => !isPlaceholderLang(doc, l, localizedFields));

// Shape a full (lean) document for one language: drop the other language's text,
// the internal slug history, and report which languages actually exist.
function forLang(doc, lang, requiredFields, strippedFields) {
    const other = lang === 'hi' ? 'en' : 'hi';
    const out = {
        ...doc,
        availableLangs: availableLangs(doc, requiredFields),
        indexableLangs: indexableLangs(doc, requiredFields, strippedFields),
    };
    for (const field of strippedFields) {
        if (out[field]) { out[field] = { ...out[field] }; delete out[field][other]; }
    }
    delete out.slugHistory;
    return out;
}

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
                updatedAt: promo.updatedAt,
                translated: hasText(promo.title && promo.title[langKey]) && hasText(promo.description && promo.description[langKey])
                    && !isPlaceholderLang(promo, langKey, ['title', 'subtitle', 'description', 'details', 'ctaText', 'badgeText']),
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
            schemaMarkup: game.schemaMarkup || '',
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
            updatedAt: post.updatedAt,
            translated: hasText(post.title && post.title[lang]) && hasText(post.body && post.body[lang])
                && !isPlaceholderLang(post, lang, ['title', 'excerpt', 'body']),
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
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true }).lean();
        if (!post) {
            return res.status(404).json({ message: 'Blog post not found.' });
        }
        res.json(forLang(post, lang, ['title', 'body'], ['title', 'excerpt', 'body']));
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
            .select('slug title excerpt body pros cons gameName rating image updatedAt')
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
            updatedAt: review.updatedAt,
            translated: hasText(review.title && review.title[lang]) && hasText(review.body && review.body[lang])
                && !isPlaceholderLang(review, lang, ['title', 'excerpt', 'body', 'pros', 'cons']),
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
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const review = await Review.findOne({ slug: req.params.slug, isPublished: true }).lean();
        if (!review) {
            return res.status(404).json({ message: 'Review not found.' });
        }
        res.json(forLang(review, lang, ['title', 'body'], ['title', 'excerpt', 'body', 'pros', 'cons']));
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
            updatedAt: p.updatedAt,
            robotsIndex: p.robotsIndex,
            translated: hasText(p.title && p.title[lang === 'hi' ? 'hi' : 'en']) && hasText(p.body && p.body[lang === 'hi' ? 'hi' : 'en'])
                && !isPlaceholderLang(p, lang === 'hi' ? 'hi' : 'en', ['title', 'body']),
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
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const page = await Page.findOne({ slug: req.params.slug, isPublished: true }).lean();
        if (!page) {
            return res.status(404).json({ message: 'Page not found.' });
        }
        res.json(forLang(page, lang, ['title', 'body'], ['title', 'body']));
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching page.' });
    }
});

/**
 * @route   GET /frontend-api/popup-banners
 * @desc    Get all active popup banners.
 * @access  Private (API Key)
 */
router.get('/popup-banners', async (req, res) => {
    try {
        const lang = req.query.lang === 'hi' ? 'hi' : 'en';
        const banners = await PopupBanner.find({ isActive: true }).sort({ displayOrder: 1, createdAt: -1 });
        const formattedBanners = banners.map(banner => ({
            _id: banner._id,
            title: banner.title[lang] || banner.title.en,
            imageUrl: banner.imageUrl,
            linkUrl: banner.linkUrl
        }));
        res.json(formattedBanners);
    } catch (err) {
        res.status(500).json({ message: 'Server error while fetching popup banners.' });
    }
});

/**
 * @route   GET /frontend-api/slug-redirect/:type/:slug
 * @desc    Resolve a retired slug to its current slug (for 301 redirects).
 *          type: blog | reviews | promotions | pages. 404 if the slug was never used.
 * @access  Private (API Key)
 */
const REDIRECT_MODELS = { blog: BlogPost, reviews: Review, promotions: Promotion, pages: Page };
router.get('/slug-redirect/:type/:slug', async (req, res) => {
    try {
        const Model = REDIRECT_MODELS[req.params.type];
        if (!Model) return res.status(404).json({ message: 'Unknown content type.' });
        const doc = await Model.findOne({ slugHistory: String(req.params.slug).trim().toLowerCase(), isPublished: true })
            .select('slug')
            .lean();
        if (!doc) return res.status(404).json({ message: 'No redirect for this slug.' });
        res.json({ slug: doc.slug });
    } catch (err) {
        res.status(500).json({ message: 'Server error while resolving slug redirect.' });
    }
});

module.exports = router;