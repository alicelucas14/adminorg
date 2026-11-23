// lib/orgSchema.js
// Cleans the "Organization info for Google" fields of the site settings before they are saved.
// The website prints them inside a JSON-LD <script>, so they must be short plain text / one web address.

const MAX_NAME_LENGTH = 100;
const MAX_ALTERNATE_NAMES = 20;
const MAX_URL_LENGTH = 500;

const tidy = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

// One name per line (or an array). Blank lines and repeats (any capitalisation) are dropped.
function cleanAlternateNames(value) {
    const items = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/);
    const seen = new Set();
    const names = [];
    for (const item of items) {
        const name = tidy(item).slice(0, MAX_NAME_LENGTH);
        const key = name.toLowerCase();
        if (!name || seen.has(key)) continue;
        seen.add(key);
        names.push(name);
        if (names.length >= MAX_ALTERNATE_NAMES) break;
    }
    return names;
}

// '' (use the Telegram link) or a full http(s) address. Returns null when it is not one.
function cleanSupportUrl(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.length > MAX_URL_LENGTH) return null;
    try {
        const url = new URL(text);
        return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname ? text : null;
    } catch {
        return null;
    }
}

/**
 * Cleans the schema* keys that are present in `update`, in place.
 * Returns an error message for the admin when something cannot be saved, otherwise null.
 */
function sanitizeOrgSchemaFields(update) {
    if ('schemaOrgName' in update) {
        update.schemaOrgName = tidy(update.schemaOrgName).slice(0, MAX_NAME_LENGTH);
    }
    if ('schemaAlternateNames' in update) {
        update.schemaAlternateNames = cleanAlternateNames(update.schemaAlternateNames);
    }
    if ('schemaSupportUrl' in update) {
        const url = cleanSupportUrl(update.schemaSupportUrl);
        if (url === null) {
            return 'The customer support link must be a full web address starting with http:// or https:// (or leave it empty to use your Telegram link).';
        }
        update.schemaSupportUrl = url;
    }
    return null;
}

module.exports = { sanitizeOrgSchemaFields, cleanAlternateNames, cleanSupportUrl, MAX_NAME_LENGTH, MAX_ALTERNATE_NAMES };
