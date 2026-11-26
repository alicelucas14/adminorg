// backend/models.js
// --- UPDATED: Now correctly imports and exports the Comment model ---

const mongoose = require('mongoose');
const User = require('./models/User');
const Comment = require('./models/Comment'); // <-- IMPORT the Comment model
const BlogComment = require('./models/BlogComment');
const LinkCheckResult = require('./models/LinkCheckResult');
const slugHistoryPlugin = require('./lib/slugHistory');

/**
 * Defines a schema for storing text in multiple languages.
 */
const localizedStringSchema = new mongoose.Schema({
    en: { type: String, required: true, trim: true },
    hi: { type: String, required: true, trim: true }
}, { _id: false });

/**
 * Defines an optional schema for localized text (allows empty strings).
 */
const optionalLocalizedStringSchema = new mongoose.Schema({
    en: { type: String, trim: true, default: '' },
    hi: { type: String, trim: true, default: '' }
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
    isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true, suppressReservedKeysWarning: true });


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
    metaTitle: { type: optionalLocalizedStringSchema, required: false },
    metaDescription: { type: optionalLocalizedStringSchema, required: false },
    focusKeyword: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    robotsIndex: { type: Boolean, default: true },
    robotsFollow: { type: Boolean, default: true },
    openGraphTitle: { type: optionalLocalizedStringSchema, required: false },
    openGraphDescription: { type: optionalLocalizedStringSchema, required: false },
    openGraphImage: { type: String, trim: true, default: '' },
    twitterTitle: { type: optionalLocalizedStringSchema, required: false },
    twitterDescription: { type: optionalLocalizedStringSchema, required: false },
    // --- END SEO FIELDS ---

    author: { type: String, required: true, default: 'Starsuu7 Expert' },
    image: { type: String, required: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    publishedAt: { type: Date, default: Date.now },
    isPublished: { type: Boolean, default: true, index: true },
    schemaMarkup: { type: String, default: '' }
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
    metaTitle: { type: optionalLocalizedStringSchema, required: false },
    metaDescription: { type: optionalLocalizedStringSchema, required: false },
    focusKeyword: { type: String, trim: true, default: '' },
    // --- END NEW FIELDS ---
    
    gameName: { type: String, required: true, trim: true },
    developer: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    image: { type: String, required: true },
    pros: { en: [{ type: String }], hi: [{ type: String }] },
    cons: { en: [{ type: String }], hi: [{ type: String }] },
    isPublished: { type: Boolean, default: true, index: true },
    schemaMarkup: { type: String, default: '' }
}, { timestamps: true });


/**
 * =============================================================================
 *  PROMOTION SCHEMA (NEW)
 * =============================================================================
 */
const promotionSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedStringSchema, required: true },
    subtitle: { type: optionalLocalizedStringSchema, required: false },
    description: { type: localizedStringSchema, required: true },
    details: { en: [{ type: String }], hi: [{ type: String }] },
    ctaText: { type: optionalLocalizedStringSchema, required: false },
    badgeText: { type: optionalLocalizedStringSchema, required: false },
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
// Where a social link shows (footer / sidebar) and when it is live. Empty dates = no limit.
// A function so each schema gets its own copy (Mongoose mutates field definitions).
const socialVisibilityFields = () => ({
    showInFooter: { type: Boolean, default: true },
    showInSidebar: { type: Boolean, default: true },
    activeFrom: { type: Date, default: null },
    activeUntil: { type: Date, default: null },
});
const socialDisplaySchema = new mongoose.Schema(socialVisibilityFields(), { _id: false });
const socialDisplayPath = (defaults = {}) => ({ type: socialDisplaySchema, default: () => ({ ...defaults }) });
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
    liveChatUrl: { type: String, default: 'https://tawk.to/chat/68412a12e13e99190e0d7e62/1isv8onah' },
    
    // --- Technical SEO Fields ---
    googleAnalyticsId: { type: String, default: 'G-NSX5MEH182' },
    googleSearchConsoleVerification: { type: String, default: '' },
    ahrefsVerification: { type: String, default: '9b4a068be0accae70bb69802a875d1f5d6f987bb64e6f428005d97af07a52f2c' },
    customHeaderScripts: { type: String, default: '' },
    customFooterScripts: { type: String, default: '' },

    // --- Organization info for Google (the JSON-LD "Organization" block the website prints on every page) ---
    // Profile links ("sameAs") are not stored here: they come from the social links above.
    schemaOrgName: { type: String, trim: true, default: '' },                 // blank = the Site name
    schemaAlternateNames: { type: [String], default: () => ['UU7', 'Stars UU7', '777', 'Starsuu7 App'] },
    schemaSupportUrl: { type: String, trim: true, default: '' },              // blank = the Telegram link

    // --- Homepage Popup Banner ---
    showPopupBanner: { type: Boolean, default: false },
    popupBannerImageUrl: { type: String, default: '' },
    popupBannerLink: { type: String, default: '' },

    // --- Mobile Splash Video (plays once per visit on phones, before the site) ---
    showSplashVideo: { type: Boolean, default: false },
    splashVideoUrl: { type: String, trim: true, default: '' },

    // --- More Social Links (picked from lib/socialPlatforms.js; shown in the site footer) ---
    extraSocialLinks: {
        type: [{
            _id: false,
            platform: { type: String, trim: true, required: true },
            url: { type: String, trim: true, required: true },
            label: { type: String, trim: true, default: '' },   // only for platform "other"
            iconUrl: { type: String, trim: true, default: '' }, // only for platform "other"
            ...socialVisibilityFields(),
        }],
        default: [],
    },

    // --- Placement + schedule for the built-in links above (keys = FIXED_SOCIAL_LINKS) ---
    socialLinkDisplay: {
        telegram: socialDisplayPath(),
        whatsapp: socialDisplayPath(),
        instagram: socialDisplayPath(),
        facebook: socialDisplayPath(),
        youtube: socialDisplayPath(),
        twitter: socialDisplayPath({ showInSidebar: false }), // X was never on the sidebar
    }
}, { timestamps: true });


/**
 * =============================================================================
 *  PAGE SCHEMA (NEW for Custom Pages)
 * =============================================================================
 */
const pageSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: localizedStringSchema, required: true },
    body: { type: localizedStringSchema, required: true },

    // --- SEO FIELDS ---
    metaTitle: { type: optionalLocalizedStringSchema, required: false },
    metaDescription: { type: optionalLocalizedStringSchema, required: false },
    focusKeyword: { type: String, trim: true, default: '' },
    canonicalUrl: { type: String, trim: true, default: '' },
    robotsIndex: { type: Boolean, default: true },
    robotsFollow: { type: Boolean, default: true },
    openGraphTitle: { type: optionalLocalizedStringSchema, required: false },
    openGraphDescription: { type: optionalLocalizedStringSchema, required: false },
    openGraphImage: { type: String, trim: true, default: '' },
    twitterTitle: { type: optionalLocalizedStringSchema, required: false },
    twitterDescription: { type: optionalLocalizedStringSchema, required: false },
    // --- END SEO FIELDS ---

    isPublished: { type: Boolean, default: true, index: true },
    // Link to this page from the website's header, mobile menu and footer quick links
    showInMenu: { type: Boolean, default: false },
    menuOrder: { type: Number, default: 0 }, // lower = earlier in the menu
    schemaMarkup: { type: String, default: '' }
}, { timestamps: true });


/**
 * =============================================================================
 *  POPUP BANNER SCHEMA (NEW)
 * =============================================================================
 */
const popupBannerSchema = new mongoose.Schema({
    title: { type: localizedStringSchema, required: true },
    imageUrl: { type: String, required: true },
    linkUrl: { type: String, default: '' },
    isActive: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0, index: true }
}, { timestamps: true });


// Remember old slugs so renamed URLs can 301 to the new one
[blogPostSchema, reviewSchema, promotionSchema, pageSchema].forEach((schema) => schema.plugin(slugHistoryPlugin));

// Export all models
const Game = mongoose.models.Game || mongoose.model('Game', gameSchema);
const BlogPost = mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);
const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
const Promotion = mongoose.models.Promotion || mongoose.model('Promotion', promotionSchema);
const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
const Page = mongoose.models.Page || mongoose.model('Page', pageSchema);
const PopupBanner = mongoose.models.PopupBanner || mongoose.model('PopupBanner', popupBannerSchema);

/**
 * =============================================================================
 *  LINK REDIRECT SCHEMA
 *  Any address on the website -> any other address (a page on the site, or an outside link).
 *  The website only looks here when a URL would otherwise be a 404, so a redirect can never
 *  hide live content. `from` is stored normalised (see lib/linkRedirects.js): lowercase path,
 *  no trailing slash, e.g. "/blog/old-post" or "/hi/blog/old-post".
 * =============================================================================
 */
const linkRedirectSchema = new mongoose.Schema({
    from: { type: String, required: true, unique: true, trim: true },
    to: { type: String, required: true, trim: true },      // "/blog/new-post/" or "https://example.com/page"
    status: { type: Number, enum: [301, 302], default: 301 },
}, { timestamps: true });
const LinkRedirect = mongoose.model('LinkRedirect', linkRedirectSchema);

/**
 * =============================================================================
 *  FAQ SCHEMA
 *  The website FAQ page, edited under Admin > FAQ. One document (key "siteFaq"): ordered sections, each with
 *  ordered questions, every text in English + Hindi. Answers are Markdown. See lib/faq.js for the rules.
 *  No document = the website uses the FAQ text shipped in its own locale files.
 * =============================================================================
 */
const faqText = { en: { type: String, default: '' }, hi: { type: String, default: '' } };
const faqSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'siteFaq' },
    sections: [{
        _id: false,
        anchor: { type: String, default: '' },      // optional link ID, e.g. "payments" -> /faq/#payments
        title: { _id: false, ...faqText },
        items: [{
            _id: false,
            q: { _id: false, ...faqText },
            a: { _id: false, ...faqText },
        }],
    }],
}, { timestamps: true });
const Faq = mongoose.models.Faq || mongoose.model('Faq', faqSchema);

/**
 * =============================================================================
 *  ABOUT PAGE SCHEMA
 *  The website "About us" page (/about/, /hi/about/), edited under Admin > About page. One document
 *  (key "siteAbout"); `content` has fixed optional sections (banner, story, numbers, cards, timeline, info box,
 *  bottom banner, SEO) with every text in English + Hindi. It is always run through sanitizeAbout (lib/about.js)
 *  before it is stored, which is why it can be a free-form object here.
 *  No document = the public API serves the starting content from lib/aboutDefaults.json.
 * =============================================================================
 */
const aboutSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'siteAbout' },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, minimize: false });
const AboutPage = mongoose.models.AboutPage || mongoose.model('AboutPage', aboutSchema);

/**
 * =============================================================================
 *  CONTACT MESSAGE SCHEMA
 *  Messages sent through the contact form on the About page; read under Admin > Messages. Always run through
 *  sanitizeContact (lib/contact.js) before they are stored. No IP address is kept.
 * =============================================================================
 */
const contactMessageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    userId: { type: String, default: '' },
    message: { type: String, required: true },
    lang: { type: String, enum: ['en', 'hi'], default: 'en' },
    status: { type: String, enum: ['new', 'read'], default: 'new' },
}, { timestamps: true });
contactMessageSchema.index({ createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });
const ContactMessage = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactMessageSchema);

module.exports = { Game, BlogPost, Review, User, Promotion, Setting, Comment, BlogComment, Page, LinkCheckResult, PopupBanner, LinkRedirect, Faq, AboutPage, ContactMessage };
