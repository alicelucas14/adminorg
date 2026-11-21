// backend/lib/faq.js
// The website FAQ page (/faq/ and /hi/faq/), edited under Admin > FAQ.
//
// Stored as ONE document (Faq, key "siteFaq"): an ordered list of sections, each with an ordered list of
// questions. Every text exists in English and Hindi. Answers are Markdown (links, **bold**, lists); the website
// renders them through its own sanitiser, so nothing stored here can run script on the site.
//
// Until an admin saves, nothing is stored and the website uses the FAQ text shipped in its own locale files
// (the same text as faqDefaults.json, which is what the admin screen starts from).

const DEFAULTS = require('./faqDefaults.json');

const LIMITS = {
    sections: 30,
    itemsPerSection: 60,
    items: 200,
    anchor: 40,
    title: 120,
    question: 300,
    answer: 6000,
};
const LANGS = ['en', 'hi'];
const ANCHOR_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class FaqValidationError extends Error {}

// A string field: trimmed, CRLF -> LF, control characters dropped. Anything else is treated as empty.
const clean = (v) => (typeof v === 'string'
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : '');

const pair = (v) => ({ en: clean(v && v.en), hi: clean(v && v.hi) });

/**
 * Validates and normalises what the admin screen sends. Returns the sections to store, or throws a
 * FaqValidationError with a message that says exactly which section / question is wrong.
 */
function sanitizeFaq(input) {
    const raw = input && Array.isArray(input.sections) ? input.sections : null;
    if (!raw) throw new FaqValidationError('Nothing to save: the FAQ must be a list of sections.');
    if (!raw.length) throw new FaqValidationError('Add at least one section.');
    if (raw.length > LIMITS.sections) throw new FaqValidationError(`At most ${LIMITS.sections} sections.`);

    const anchors = new Set();
    let total = 0;
    const sections = raw.map((s, si) => {
        const where = `Section ${si + 1}`;
        const title = pair(s && s.title);
        if (!title.en) throw new FaqValidationError(`${where}: the English title is empty.`);
        for (const l of LANGS) {
            if (title[l].length > LIMITS.title) throw new FaqValidationError(`${where}: the ${l === 'en' ? 'English' : 'Hindi'} title is longer than ${LIMITS.title} characters.`);
        }

        let anchor = clean(s && s.anchor).toLowerCase();
        if (anchor) {
            if (anchor.length > LIMITS.anchor || !ANCHOR_RE.test(anchor)) {
                throw new FaqValidationError(`${where}: the link ID "${anchor}" may only use lowercase letters, numbers and single hyphens (up to ${LIMITS.anchor} characters).`);
            }
            if (anchors.has(anchor)) throw new FaqValidationError(`${where}: the link ID "${anchor}" is used by another section.`);
            anchors.add(anchor);
        }

        const rawItems = s && Array.isArray(s.items) ? s.items : [];
        if (!rawItems.length) throw new FaqValidationError(`${where} ("${title.en}"): add at least one question, or delete the section.`);
        if (rawItems.length > LIMITS.itemsPerSection) throw new FaqValidationError(`${where}: at most ${LIMITS.itemsPerSection} questions per section.`);
        total += rawItems.length;
        if (total > LIMITS.items) throw new FaqValidationError(`At most ${LIMITS.items} questions in total.`);

        const items = rawItems.map((it, ii) => {
            const at = `${where}, question ${ii + 1}`;
            const q = pair(it && it.q);
            const a = pair(it && it.a);
            if (!q.en) throw new FaqValidationError(`${at}: the English question is empty.`);
            if (!a.en) throw new FaqValidationError(`${at}: the English answer is empty.`);
            // A Hindi question without a Hindi answer (or the reverse) would show half an entry: all or nothing.
            if (!!q.hi !== !!a.hi) throw new FaqValidationError(`${at}: fill in both the Hindi question and the Hindi answer, or leave both empty.`);
            for (const l of LANGS) {
                const name = l === 'en' ? 'English' : 'Hindi';
                if (q[l].length > LIMITS.question) throw new FaqValidationError(`${at}: the ${name} question is longer than ${LIMITS.question} characters.`);
                if (a[l].length > LIMITS.answer) throw new FaqValidationError(`${at}: the ${name} answer is longer than ${LIMITS.answer} characters.`);
            }
            return { q, a };
        });

        return { anchor, title, items };
    });
    return { sections };
}

// What the public API returns for one language. English shows everything. Hindi shows only what has Hindi text
// (a section needs a Hindi title and at least one translated question), so the Hindi page is never half English.
function faqForLang(sections, lang) {
    const hindi = lang === 'hi';
    const out = [];
    for (const s of sections || []) {
        const title = hindi ? s.title && s.title.hi : s.title && s.title.en;
        if (!title) continue;
        const items = (s.items || [])
            .map((it) => ({ q: hindi ? it.q && it.q.hi : it.q && it.q.en, a: hindi ? it.a && it.a.hi : it.a && it.a.en }))
            .filter((it) => it.q && it.a && !(hindi && (/\[HI\]/.test(it.q) || /\[HI\]/.test(it.a))));
        if (!items.length) continue;
        out.push({ ...(s.anchor ? { id: s.anchor } : {}), title, items });
    }
    return out;
}

// A fresh copy each time, so a caller can never change the shared defaults.
const defaultFaq = () => JSON.parse(JSON.stringify(DEFAULTS));

module.exports = { sanitizeFaq, faqForLang, defaultFaq, FaqValidationError, LIMITS };
