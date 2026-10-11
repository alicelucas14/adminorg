// backend/lib/socialPlatforms.js
// Platforms an admin can pick from under Settings -> "More Social Links".
// The `key` is what gets stored; the frontend (uu7stars-frontend/src/lib/socialPlatforms.ts) maps the
// same keys to its icons, so keep both lists in sync when adding a platform.
// `icon` is a path on the public site (FRONTEND_URL), used for the preview in the admin.

const SOCIAL_PLATFORMS = [
    { key: 'tiktok', label: 'TikTok', icon: '/social/tiktok.svg' },
    { key: 'threads', label: 'Threads', icon: '/social/threads.svg' },
    { key: 'pinterest', label: 'Pinterest', icon: '/social/pinterest.svg' },
    { key: 'linkedin', label: 'LinkedIn', icon: '/social/linkedin.svg' },
    { key: 'discord', label: 'Discord', icon: '/social/discord.svg' },
    { key: 'snapchat', label: 'Snapchat', icon: '/social/snapchat.svg' },
    { key: 'reddit', label: 'Reddit', icon: '/social/reddit.svg' },
    { key: 'quora', label: 'Quora', icon: '/social/quora.svg' },
    { key: 'twitch', label: 'Twitch', icon: '/social/twitch.svg' },
    { key: 'kick', label: 'Kick', icon: '/social/kick.svg' },
    { key: 'spotify', label: 'Spotify', icon: '/social/spotify.svg' },
    { key: 'medium', label: 'Medium', icon: '/social/medium.svg' },
    { key: 'telegram', label: 'Telegram (extra)', icon: '/wordpress/telegram.png' },
    { key: 'whatsapp', label: 'WhatsApp (extra)', icon: '/wordpress/whatsapp.png' },
    { key: 'instagram', label: 'Instagram (extra)', icon: '/wordpress/instagram.webp' },
    { key: 'facebook', label: 'Facebook (extra)', icon: '/wordpress/facebook.png' },
    { key: 'youtube', label: 'YouTube (extra)', icon: '/wordpress/youtube.png' },
    { key: 'x', label: 'X / Twitter (extra)', icon: '/wordpress/x.webp' },
    { key: 'website', label: 'Website', icon: '/social/website.svg' },
    { key: 'other', label: 'Other (custom)', icon: '/social/website.svg' },
];

const SOCIAL_PLATFORM_KEYS = new Set(SOCIAL_PLATFORMS.map((p) => p.key));
const MAX_EXTRA_SOCIAL_LINKS = 30;

// The built-in links (their own URL fields in Settings). `footer`/`sidebar` are the defaults used
// before an admin changes anything - X was never on the sidebar, so it stays off there until enabled.
// Keys must match `socialLinkDisplay` in models.js and the frontend's FIXED_DEFAULTS.
const FIXED_SOCIAL_LINKS = [
    { key: 'telegram', field: 'telegramUrl', label: 'Telegram', footer: true, sidebar: true },
    { key: 'whatsapp', field: 'whatsappUrl', label: 'WhatsApp', footer: true, sidebar: true },
    { key: 'instagram', field: 'instagramUrl', label: 'Instagram', footer: true, sidebar: true },
    { key: 'facebook', field: 'facebookUrl', label: 'Facebook', footer: true, sidebar: true },
    { key: 'youtube', field: 'youtubeUrl', label: 'YouTube', footer: true, sidebar: true },
    { key: 'twitter', field: 'twitterUrl', label: 'Twitter (X)', footer: true, sidebar: false },
];

const isHttpUrl = (value) => {
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

const toDateOrNull = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Where a link shows (footer / sidebar) and when it is live. Empty dates mean "no limit".
 * Missing flags fall back to `defaults` so older clients can't accidentally hide links.
 */
function sanitizeVisibility(item, defaults = {}) {
    return {
        showInFooter: typeof item?.showInFooter === 'boolean' ? item.showInFooter : defaults.footer !== false,
        showInSidebar: typeof item?.showInSidebar === 'boolean' ? item.showInSidebar : defaults.sidebar !== false,
        activeFrom: toDateOrNull(item?.activeFrom),
        activeUntil: toDateOrNull(item?.activeUntil),
    };
}

/** Placement + schedule for the built-in links, keyed like FIXED_SOCIAL_LINKS. Unknown keys are dropped. */
function sanitizeSocialLinkDisplay(input) {
    const src = input && typeof input === 'object' ? input : {};
    return Object.fromEntries(FIXED_SOCIAL_LINKS.map((f) => [f.key, sanitizeVisibility(src[f.key], f)]));
}

/**
 * Cleans the list sent from the settings form: known platforms only, http(s) URLs only
 * (blocks javascript: links), trimmed labels, capped length. Invalid rows are dropped.
 */
function sanitizeExtraSocialLinks(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map((item) => ({
            platform: typeof item?.platform === 'string' ? item.platform.trim() : '',
            url: typeof item?.url === 'string' ? item.url.trim() : '',
            label: typeof item?.label === 'string' ? item.label.trim().slice(0, 40) : '',
            iconUrl: typeof item?.iconUrl === 'string' ? item.iconUrl.trim() : '',
            visibility: sanitizeVisibility(item),
        }))
        .filter((item) => SOCIAL_PLATFORM_KEYS.has(item.platform) && isHttpUrl(item.url))
        .map((item) => ({
            platform: item.platform,
            url: item.url,
            // Name and icon only matter for "Other"
            label: item.platform === 'other' ? item.label : '',
            iconUrl: item.platform === 'other' && isHttpUrl(item.iconUrl) ? item.iconUrl : '',
            ...item.visibility,
        }))
        .slice(0, MAX_EXTRA_SOCIAL_LINKS);
}

module.exports = {
    SOCIAL_PLATFORMS,
    FIXED_SOCIAL_LINKS,
    MAX_EXTRA_SOCIAL_LINKS,
    sanitizeExtraSocialLinks,
    sanitizeSocialLinkDisplay,
};
