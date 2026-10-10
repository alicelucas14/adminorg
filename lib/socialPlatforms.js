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

const isHttpUrl = (value) => {
    try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
};

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
        }))
        .filter((item) => SOCIAL_PLATFORM_KEYS.has(item.platform) && isHttpUrl(item.url))
        .map((item) => ({
            platform: item.platform,
            url: item.url,
            // Name and icon only matter for "Other"
            label: item.platform === 'other' ? item.label : '',
            iconUrl: item.platform === 'other' && isHttpUrl(item.iconUrl) ? item.iconUrl : '',
        }))
        .slice(0, MAX_EXTRA_SOCIAL_LINKS);
}

module.exports = { SOCIAL_PLATFORMS, MAX_EXTRA_SOCIAL_LINKS, sanitizeExtraSocialLinks };
