// ===== backend/routes/admin/ui.js =====
// --- UPDATED to re-introduce the route for the new AI review generation page ---

const express = require('express');
const router = express.Router();
const { Game, BlogPost, Review, Promotion, Setting } = require('../../models');

const frontendUrl = process.env.FRONTEND_URL;

// --- Dashboard and other routes are unchanged ---
router.get('/dashboard', async (request, response) => {
    try {
        const [ gameCount, postCount, reviewCount, promotionCount, recentGames, recentPosts ] = await Promise.all([
            Game.countDocuments(),
            BlogPost.countDocuments(),
            Review.countDocuments(),
            Promotion.countDocuments(),
            Game.find({}).sort({ createdAt: -1 }).limit(5).select('name.en gameId createdAt _id'),
            BlogPost.find({}).sort({ publishedAt: -1 }).limit(5).select('title.en slug publishedAt _id')
        ]);
        response.render('dashboard', { user: request.user, counts: { games: gameCount, posts: postCount, reviews: reviewCount, promotions: promotionCount }, recentItems: { games: recentGames, posts: recentPosts }, page: 'dashboard', title: 'Dashboard', frontendUrl: frontendUrl });
    } catch (error) {
        response.status(500).send('Server Error');
    }
});

// --- Game, Blog, Promotion UI Routes (unchanged) ---
router.get('/games', (req, res) => res.render('manage-content', { user: req.user, page: 'games', title: 'Games', apiEndpoint: '/api/admin/games', frontendUrl }));
router.get('/games/new', (req, res) => res.render('edit-game', { user: req.user, page: 'games', title: 'Create New Game', game: null, apiEndpoint: '/api/admin/games', frontendUrl }));
router.get('/games/edit/:id', async (req, res) => { try { const game = await Game.findById(req.params.id); if (!game) return res.status(404).send('Game not found'); res.render('edit-game', { user: req.user, page: 'games', title: 'Edit Game', game, apiEndpoint: `/api/admin/games/${game._id}`, frontendUrl }); } catch (e) { res.status(500).send('Server Error'); } });
router.get('/blog', (req, res) => res.render('manage-content', { user: req.user, page: 'blog', title: 'Blog Posts', apiEndpoint: '/api/admin/blog', frontendUrl }));
router.get('/blog/new', (req, res) => res.render('edit-blog', { user: req.user, page: 'blog', title: 'Create New Post', post: null, apiEndpoint: '/api/admin/blog', frontendUrl }));
router.get('/blog/edit/:id', async (req, res) => { try { const post = await BlogPost.findById(req.params.id); if (!post) return res.status(404).send('Post not found'); res.render('edit-blog', { user: req.user, page: 'blog', title: 'Edit Blog Post', post, apiEndpoint: `/api/admin/blog/${post._id}`, frontendUrl }); } catch (e) { res.status(500).send('Server Error'); } });
router.get('/promotions', (req, res) => res.render('manage-content', { user: req.user, page: 'promotions', title: 'Promotions', apiEndpoint: '/api/admin/promotions', frontendUrl }));
router.get('/promotions/new', (req, res) => res.render('edit-promotion', { user: req.user, page: 'promotions', title: 'Create New Promotion', promotion: null, apiEndpoint: '/api/admin/promotions', frontendUrl }));
router.get('/promotions/edit/:id', async (req, res) => { try { const promotion = await Promotion.findById(req.params.id); if (!promotion) return res.status(404).send('Promotion not found'); res.render('edit-promotion', { user: req.user, page: 'promotions', title: 'Edit Promotion', promotion, apiEndpoint: `/api/admin/promotions/${promotion._id}`, frontendUrl }); } catch (e) { res.status(500).send('Server Error'); } });

//==============================================
// REVIEW UI ROUTES (UPDATED)
//==============================================
router.get('/reviews', (req, res) => res.render('manage-content', { user: req.user, page: 'reviews', title: 'Reviews', apiEndpoint: '/api/admin/reviews', frontendUrl }));
router.get('/reviews/new', (req, res) => res.render('edit-review', { user: req.user, page: 'reviews', title: 'Create New Review', review: null, apiEndpoint: '/api/admin/reviews', frontendUrl }));
// --- NEW ROUTE for AI generation page ---
router.get('/reviews/generate', (req, res) => res.render('generate-review', { user: req.user, page: 'reviews', title: 'Generate with AI', frontendUrl }));
router.get('/reviews/edit/:id', async (req, res) => { try { const review = await Review.findById(req.params.id); if (!review) return res.status(404).send('Review not found'); res.render('edit-review', { user: req.user, page: 'reviews', title: 'Edit Review', review, apiEndpoint: `/api/admin/reviews/${review._id}`, frontendUrl }); } catch (e) { res.status(500).send('Server Error'); } });


//==============================================
// SETTINGS UI ROUTE (unchanged)
//==============================================
router.get('/settings', async (request, response) => {
    try {
        const settings = await Setting.findOneAndUpdate(
            { key: 'siteSettings' },
            { $setOnInsert: { key: 'siteSettings' } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        response.render('settings', { user: request.user, page: 'settings', title: 'Site Settings', settings: settings, apiEndpoint: '/api/admin/settings', frontendUrl: frontendUrl });
    } catch (error) {
        response.status(500).send('Server Error');
    }
});

module.exports = router;