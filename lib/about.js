// backend/lib/about.js
// The website "About us" page (/about/ and /hi/about/), edited under Admin > About page.
//
// Stored as ONE document (AboutPage, key "siteAbout") whose `content` has fixed, optional blocks:
//   hero (banner) -> story ("Who we are") -> panels (mission & values) -> features (cards) -> benefits (dark numbers)
//   -> timeline -> highlight (info box) -> contact (form) -> cta -> seo
// Texts exist in English and Hindi. Multi-line texts are Markdown (links, **bold**, lists); the website renders
// them through its own sanitiser, so nothing stored here can run script on the site. A block with nothing in it
// (no English) is simply not shown, so the admin controls exactly what appears.
//
// Until an admin saves, nothing is stored and the public API serves the starting content (aboutDefaults.json),
// which is also what the admin screen starts from and what "Start over" loads.

const DEFAULTS = require('./aboutDefaults.json');

const LIMITS = {
    eyebrow: 60,
    title: 160,
    subtitle: 600,
    intro: 600,
    buttonLabel: 40,
    url: 500,
    alt: 160,
    body: 6000,
    quote: 400,
    panels: 4, panelTitle: 80, panelText: 800,
    benefits: 6, benefitValue: 20, benefitLabel: 80,
    cards: 12, icon: 4 /* characters, so one emoji or a short symbol */, cardTitle: 120, cardText: 1000,
    steps: 12, stepLabel: 30, stepTitle: 120, stepText: 800,
    ctaTitle: 160, ctaText: 600,
    contactTitle: 160, contactIntro: 600, contactButton: 40, contactSuccess: 300, contactNote: 300,
    seoTitle: 70, seoDescription: 300,
};
const NAME = { en: 'English', hi: 'Hindi' };

class AboutValidationError extends Error {}

// A string field: trimmed, CRLF -> LF, control characters dropped. Anything else is treated as empty.
const clean = (v) => (typeof v === 'string'
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : '');

// What a link may point at: a page on this site (/path or #section), http(s), or an email link. Never javascript:.
const LINK_OK = /^(https?:\/\/\S+|mailto:\S+|\/(?!\/)\S*|#\S+)$/i;
const IMAGE_OK = /^(https?:\/\/\S+|\/(?!\/)\S+)$/i;

const fail = (message) => { throw new AboutValidationError(message); };

// {en, hi} text. English is the base: a text with no English is not shown on either page, even if it has Hindi
// (see aboutForLang). The Hindi is kept, so clearing the English to hide a block never throws a translation away.
function pairText(v, label, max) {
    const out = { en: clean(v && v.en), hi: clean(v && v.hi) };
    for (const l of ['en', 'hi']) {
        if (out[l].length > max) fail(`${label}: the ${NAME[l]} text is longer than ${max} characters.`);
    }
    return out;
}

function linkUrl(v, label) {
    const url = clean(v);
    if (!url) return '';
    if (url.length > LIMITS.url) fail(`${label}: the address is longer than ${LIMITS.url} characters.`);
    if (!LINK_OK.test(url)) fail(`${label}: "${url}" is not allowed. Use a page on this site starting with / (like /promotions/), or an address starting with https://`);
    return url;
}

// A button: text (English required if there is a button; Hindi optional) + one address shared by both languages.
function button(v, label) {
    const text = pairText(v && v.label, `${label} text`, LIMITS.buttonLabel);
    const url = linkUrl(v && v.url, label);
    if (!!text.en !== !!url) fail(`${label}: fill in both the button text (English) and where it goes, or leave both empty.`);
    return { label: text, url };
}

function picture(v, label) {
    const url = clean(v && v.url);
    if (url) {
        if (url.length > LIMITS.url) fail(`${label}: the picture address is longer than ${LIMITS.url} characters.`);
        if (!IMAGE_OK.test(url)) fail(`${label}: the picture address must start with https:// (or / for a file on this site).`);
    }
    return { url, alt: pairText(v && v.alt, `${label} description`, LIMITS.alt) };
}

function list(raw, label, max) {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw)) fail(`${label}: must be a list.`);
    if (raw.length > max) fail(`${label}: at most ${max} entries.`);
    return raw;
}

const iconField = (v, at) => {
    const icon = clean(v);
    if ([...icon].length > LIMITS.icon) fail(`${at}: the icon must be a single emoji or symbol.`);
    return icon;
};

/**
 * Validates and normalises what the admin screen sends ({ content }). Returns { content } to store, or throws an
 * AboutValidationError whose message says exactly which block / entry is wrong.
 */
function sanitizeAbout(input) {
    const c = input && input.content;
    if (!c || typeof c !== 'object' || Array.isArray(c)) fail('Nothing to save: the page content is missing.');

    const h = c.hero || {};
    const hero = {
        eyebrow: pairText(h.eyebrow, 'Banner: small label', LIMITS.eyebrow),
        title: pairText(h.title, 'Banner: title', LIMITS.title),
        subtitle: pairText(h.subtitle, 'Banner: text', LIMITS.subtitle),
        primary: button(h.primary, 'Banner: first button'),
        secondary: button(h.secondary, 'Banner: second button'),
        image: picture(h.image, 'Banner: picture'),
    };
    if (!hero.title.en) fail('Banner: the English title is required (it is the main heading of the page).');

    const s = c.story || {};
    const story = {
        title: pairText(s.title, 'Who we are: title', LIMITS.title),
        body: pairText(s.body, 'Who we are: text', LIMITS.body),
        quote: pairText(s.quote, 'Who we are: highlighted statement', LIMITS.quote),
        image: picture(s.image, 'Who we are: picture'),
    };

    const panels = {
        items: list(c.panels && c.panels.items, 'Mission & values', LIMITS.panels).map((it, i) => {
            const at = `Mission & values, panel ${i + 1}`;
            const icon = iconField(it && it.icon, at);
            const title = pairText(it && it.title, `${at}: title`, LIMITS.panelTitle);
            const text = pairText(it && it.text, `${at}: text`, LIMITS.panelText);
            if (!icon && !title.en && !text.en) return null;
            if (!title.en) fail(`${at}: the English title is empty.`);
            return { icon, title, text };
        }).filter(Boolean),
    };

    const b = c.benefits || {};
    const benefits = {
        title: pairText(b.title, 'Our benefits: title', LIMITS.title),
        items: list(b.items, 'Our benefits', LIMITS.benefits).map((it, i) => {
            const at = `Our benefits, number ${i + 1}`;
            const icon = iconField(it && it.icon, at);
            const value = clean(it && it.value);
            if (value.length > LIMITS.benefitValue) fail(`${at}: the number is longer than ${LIMITS.benefitValue} characters.`);
            const label = pairText(it && it.label, `${at}: label`, LIMITS.benefitLabel);
            if (!value && !label.en) return null; // a row nobody filled in (English) is just dropped
            if (!value) fail(`${at}: the number (like 24/7) is empty.`);
            if (!label.en) fail(`${at}: the English label is empty.`);
            return { icon, value, label };
        }).filter(Boolean),
    };

    const f = c.features || {};
    const features = {
        title: pairText(f.title, 'Cards: title', LIMITS.title),
        intro: pairText(f.intro, 'Cards: intro', LIMITS.intro),
        items: list(f.items, 'Cards', LIMITS.cards).map((it, i) => {
            const at = `Cards, card ${i + 1}`;
            const icon = iconField(it && it.icon, at);
            const title = pairText(it && it.title, `${at}: title`, LIMITS.cardTitle);
            const text = pairText(it && it.text, `${at}: text`, LIMITS.cardText);
            if (!icon && !title.en && !text.en) return null;
            if (!title.en) fail(`${at}: the English title is empty.`);
            return { icon, title, text };
        }).filter(Boolean),
    };

    const t = c.timeline || {};
    const timeline = {
        title: pairText(t.title, 'Timeline: title', LIMITS.title),
        intro: pairText(t.intro, 'Timeline: intro', LIMITS.intro),
        items: list(t.items, 'Timeline', LIMITS.steps).map((it, i) => {
            const at = `Timeline, step ${i + 1}`;
            const label = clean(it && it.label);
            if (label.length > LIMITS.stepLabel) fail(`${at}: the label (like a year) is longer than ${LIMITS.stepLabel} characters.`);
            const title = pairText(it && it.title, `${at}: title`, LIMITS.stepTitle);
            const text = pairText(it && it.text, `${at}: text`, LIMITS.stepText);
            if (!label && !title.en && !text.en) return null;
            if (!title.en) fail(`${at}: the English title is empty.`);
            return { label, title, text };
        }).filter(Boolean),
    };

    const hl = c.highlight || {};
    const highlight = {
        title: pairText(hl.title, 'Info box: title', LIMITS.title),
        body: pairText(hl.body, 'Info box: text', LIMITS.body),
    };

    const co = c.contact || {};
    const contact = {
        title: pairText(co.title, 'Contact form: title', LIMITS.contactTitle),
        intro: pairText(co.intro, 'Contact form: intro', LIMITS.contactIntro),
        button: pairText(co.button, 'Contact form: button text', LIMITS.contactButton),
        success: pairText(co.success, 'Contact form: thank-you message', LIMITS.contactSuccess),
        note: pairText(co.note, 'Contact form: note under the button', LIMITS.contactNote),
        image: picture(co.image, 'Contact form: picture'),
    };

    const ct = c.cta || {};
    const cta = {
        title: pairText(ct.title, 'Bottom banner: title', LIMITS.ctaTitle),
        text: pairText(ct.text, 'Bottom banner: text', LIMITS.ctaText),
        button: button(ct.button, 'Bottom banner: button'),
    };

    const se = c.seo || {};
    const seo = {
        title: pairText(se.title, 'Search engines: page title', LIMITS.seoTitle),
        description: pairText(se.description, 'Search engines: description', LIMITS.seoDescription),
    };

    return { content: { hero, story, panels, features, benefits, timeline, highlight, contact, cta, seo } };
}

// What the public API returns for one language: every text already resolved (Hindi, else English), and every block
// that has nothing to show reduced to null so the website only has to check "is it there".
function aboutForLang(content, lang) {
    const hindi = lang === 'hi';
    // English is the base: no English = nothing to show in either language (a Hindi-only text stays hidden)
    const pick = (p) => (p && p.en ? (hindi ? p.hi || p.en : p.en) : '');
    const btn = (b) => (b && b.url && pick(b.label) ? { label: pick(b.label), url: b.url } : null);
    const pic = (i) => (i && i.url ? { url: i.url, alt: pick(i.alt) } : null);
    const c = content || {};
    const h = c.hero || {};
    const out = {
        hero: {
            eyebrow: pick(h.eyebrow), title: pick(h.title), subtitle: pick(h.subtitle),
            primary: btn(h.primary), secondary: btn(h.secondary), image: pic(h.image),
        },
        story: null,
        panels: null,
        features: null,
        benefits: null,
        timeline: null,
        highlight: null,
        contact: null,
        cta: null,
        seo: { title: pick(c.seo && c.seo.title), description: pick(c.seo && c.seo.description) },
    };

    const s = c.story || {};
    const story = { title: pick(s.title), body: pick(s.body), quote: pick(s.quote), image: pic(s.image) };
    if (story.title || story.body || story.quote) out.story = story;

    const panelItems = ((c.panels && c.panels.items) || []).map((it) => ({ icon: it.icon || '', title: pick(it.title), text: pick(it.text) })).filter((it) => it.title);
    if (panelItems.length) out.panels = { items: panelItems };

    const f = c.features || {};
    const cards = (f.items || []).map((it) => ({ icon: it.icon || '', title: pick(it.title), text: pick(it.text) })).filter((it) => it.title);
    if (cards.length) out.features = { title: pick(f.title), intro: pick(f.intro), items: cards };

    const b = c.benefits || {};
    const nums = (b.items || []).map((it) => ({ icon: it.icon || '', value: it.value || '', label: pick(it.label) })).filter((it) => it.value && it.label);
    if (nums.length) out.benefits = { title: pick(b.title), items: nums };

    const t = c.timeline || {};
    const steps = (t.items || []).map((it) => ({ label: it.label || '', title: pick(it.title), text: pick(it.text) })).filter((it) => it.title);
    if (steps.length) out.timeline = { title: pick(t.title), intro: pick(t.intro), items: steps };

    const hl = c.highlight || {};
    const box = { title: pick(hl.title), body: pick(hl.body) };
    if (box.title || box.body) out.highlight = box;

    const co = c.contact || {};
    const contact = { title: pick(co.title), intro: pick(co.intro), button: pick(co.button), success: pick(co.success), note: pick(co.note), image: pic(co.image) };
    if (contact.title || contact.intro) out.contact = contact;

    const ct = c.cta || {};
    const cta = { title: pick(ct.title), text: pick(ct.text), button: btn(ct.button) };
    if (cta.title || cta.text || cta.button) out.cta = cta;

    return out;
}

// A fresh copy each time, so a caller can never change the shared defaults.
const defaultAbout = () => JSON.parse(JSON.stringify(DEFAULTS));

module.exports = { sanitizeAbout, aboutForLang, defaultAbout, AboutValidationError, LIMITS };
