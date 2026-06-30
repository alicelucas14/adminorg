// backend/server.js
// --- UPDATED to register the new admin and frontend blog comment routes ---

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const connectDB = require('./db');
const { protect, adminOnly } = require('./middleware/authMiddleware');

// Route Imports
const adminUiRoutes = require('./routes/admin/ui');
const authRoutes = require('./routes/auth');
const adminGameRoutes = require('./routes/admin/games');
const adminBlogRoutes = require('./routes/admin/blog');
const adminReviewRoutes = require('./routes/admin/reviews');
const adminPromotionRoutes = require('./routes/admin/promotions');
const adminSettingsRoutes = require('./routes/admin/settings');
const adminUploadRoutes = require('./routes/admin/upload');
const adminCommentRoutes = require('./routes/admin/comments');
const adminBlogCommentRoutes = require('./routes/admin/blog-comments'); // <-- IMPORT new admin route
const adminPageRoutes = require('./routes/admin/pages');
const adminLinkCheckerRoutes = require('./routes/admin/linkChecker');
const adminPopupBannerRoutes = require('./routes/admin/popup-banners'); // <-- IMPORT popup-banners route
const adminUserRoutes = require('./routes/admin/users'); // <-- IMPORT user management route
const frontendApiRoutes = require('./routes/frontendApi');
const commentFrontendRoutes = require('./routes/frontend/comments');
const blogCommentFrontendRoutes = require('./routes/frontend/blog-comments'); // <-- IMPORT new frontend route

const app = express();
const ADMIN_BASE = process.env.ADMIN_BASE || 'adminorg';

// --- App Locals ---
app.locals.frontendUrl = process.env.FRONTEND_URL;
app.locals.adminBase = '/' + ADMIN_BASE;

// --- Core Middleware ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// --- Health Check Endpoint ---
app.get('/healthz', (req, res) => res.send('ok'));

// --- Admin UI Routes ---
app.get(`/${ADMIN_BASE}`, (req, res) => {
  if (req.cookies.token) return res.redirect(`/${ADMIN_BASE}/dashboard`);
  res.render('login');
});
app.get(`/${ADMIN_BASE}/register`, (req, res) => {
  if (req.cookies.token) return res.redirect(`/${ADMIN_BASE}/dashboard`);
  res.render('register');
});
app.use(`/${ADMIN_BASE}`, protect, adminUiRoutes);
app.use('/admin', (req, res) => res.redirect(`/${ADMIN_BASE}` + req.url)); // Legacy redirect

// --- API Routes ---
app.use('/auth', authRoutes);
// Admin APIs
app.use('/api/admin/games', protect, adminOnly, adminGameRoutes);
app.use('/api/admin/blog', protect, adminOnly, adminBlogRoutes);
app.use('/api/admin/reviews', protect, adminOnly, adminReviewRoutes);
app.use('/api/admin/promotions', protect, adminOnly, adminPromotionRoutes);
app.use('/api/admin/settings', protect, adminOnly, adminSettingsRoutes);
app.use('/api/admin/upload', protect, adminOnly, adminUploadRoutes);
app.use('/api/admin/comments', protect, adminOnly, adminCommentRoutes);
app.use('/api/admin/blog-comments', protect, adminOnly, adminBlogCommentRoutes); // <-- REGISTER new admin route
app.use('/api/admin/pages', protect, adminOnly, adminPageRoutes);
app.use('/api/admin/link-checker', protect, adminOnly, adminLinkCheckerRoutes);
app.use('/api/admin/popup-banners', protect, adminOnly, adminPopupBannerRoutes); // <-- REGISTER popup-banners admin API
app.use('/api/admin/users', protect, adminOnly, adminUserRoutes); // <-- REGISTER users admin API
// Frontend APIs
app.use('/frontend-api', frontendApiRoutes);
app.use('/api/frontend/comments', commentFrontendRoutes);
app.use('/api/frontend/blog-comments', blogCommentFrontendRoutes); // <-- REGISTER new frontend route

app.get('/', (_req, res) => res.json({ message: 'Welcome to the UU7Game Backend API!' }));

// --- Server Startup ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on ${PORT}`);
  connectDB({
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  }).then(() => console.log('Mongo connected'))
    .catch(err => console.error('Mongo connect error:', err.message));
});