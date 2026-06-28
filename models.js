// backend/models.js
// --- UPDATED: Now correctly imports and exports the Comment model ---

const mongoose = require('mongoose');
const User = require('./models/User');
const Comment = require('./models/Comment'); // <-- IMPORT the Comment model
const BlogComment = require('./models/BlogComment');

/**
 * Defines a schema for storing text in multiple languages.
 */
const localizedStringSchema = new mongoose.Schema({
    en: { type: String, required: true, trim: true },
    hi: { type: String, required: true, trim: true }
}, { _id: false });

/**
 * =============================================================================
 *  GAME SCHEMA (No changes needed)
 * =============================================================================
 */
const gameSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true, trim: true, lowercase: true }, 
    name: { type: localizedStringSchema, required: true },
    category: { type: String, required: true, enum: ['slots', 'live-casino', 'card-games', 'quick-games', 'fishing', 'sports'], trim: true },
    provider: { type: String, required: true, trim: true },
    image: { type: String, required: true },
    isNew: { type: Boolean, default: false },
    isHot: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });


/**
 * =============================================================================
 *  BLOG POST SCHEMA (UPDATED with SEO)
 * =============================================================================
 */
const blogPostSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedStringSchema, required: true },
    excerpt: { type: localizedStringSchema, required: true },
    body: { type: localizedStringSchema, required: true },

    // --- SEO FIELDS ---
    metaTitle: { type: localizedStringSchema, required: false },
    metaDescription: { type: localizedStringSchema, required: false },
    focusKeyword: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    robotsIndex: { type: Boolean, default: true },
    robotsFollow: { type: Boolean, default: true },
    openGraphTitle: { type: localizedStringSchema, required: false },
    openGraphDescription: { type: localizedStringSchema, required: false },
    openGraphImage: { type: String, trim: true, default: '' },
    twitterTitle: { type: localizedStringSchema, required: false },
    twitterDescription: { type: localizedStringSchema, required: false },
    // --- END SEO FIELDS ---

    author: { type: String, required: true, default: 'Starsuu7 Expert' },
    image: { type: String, required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    publishedAt: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true, index: true }
}, { timestamps: true });


/**
 * =============================================================================
 *  REVIEW SCHEMA (UPDATED with SEO)
 * =============================================================================
 */
const reviewSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game', required: false },
    title: { type: localizedStringSchema, required: true },
    excerpt: { type: localizedStringSchema, required: true },
    body: { type: localizedStringSchema, required: true },

    // --- NEW SEO FIELDS ---
    metaTitle: { type: localizedStringSchema, required: false },
    metaDescription: { type: localizedStringSchema, required: false },
    // --- END NEW FIELDS ---
    
    gameName: { type: String, required: true, trim: true },
    developer: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    image: { type: String, required: true },
    pros: { en: [{ type: String }], hi: [{ type: String }] },
    cons: { en: [{ type: String }], hi: [{ type: String }] },
    isPublished: { type: Boolean, default: true, index: true }
}, { timestamps: true });


/**
 * =============================================================================
 *  PROMOTION SCHEMA (NEW)
 * =============================================================================
 */
const promotionSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedStringSchema, required: true },
    subtitle: { type: localizedStringSchema, required: false },
    description: { type: localizedStringSchema, required: true },
    details: { en: [{ type: String }], hi: [{ type: String }] },
    ctaText: { type: localizedStringSchema, required: false },
    badgeText: { type: localizedStringSchema, required: false },
    imageUrl: { type: String, required: true },
    ctaLink: { type: String, default: '#' },
    badgeColor: { type: String, default: 'bg-brand-orange-gold text-black' },
    displayOrder: { type: Number, default: 0, index: true },
    isPublished: { type: Boolean, default: true, index: true }
}, { timestamps: true });


/**
 * =============================================================================
 *  SETTING SCHEMA (NEW)
 * =============================================================================
 */
const settingSchema = new mongoose.Schema({
    key: { type: String, default: 'siteSettings', unique: true },
    siteName: { type: String, default: 'Starsuu7' },
    logoUrl: { type: String, default: '/icons.png' },
    apkDownloadLink: { type: String, default: '/api/download/apk' },
    qrCodeImageUrl: { type: String, default: '/qr.png' },
    telegramUrl: { type: String, default: 'https://t.me/yourtelegram' },
    whatsappUrl: { type: String, default: 'https://wa.me/yourwhatsappnumber' },
    instagramUrl: { type: String, default: 'https://instagram.com/yourprofile' },
    facebookUrl: { type: String, default: 'https://facebook.com/yourprofile' },
    youtubeUrl: { type: String, default: 'https://youtube.com/yourchannel' },
    twitterUrl: { type: String, default: 'https://twitter.com/yourprofile' },
    liveChatUrl: { type: String, default: 'https://tawk.to/chat/68412a12e13e99190e0d7e62/1isv8onah' }
}, { timestamps: true });


// Export all models
const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);
const BlogPost = mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const Promotion = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

module.exports = { Game, BlogPost, Review, User, Promotion, Setting, Comment, BlogComment };