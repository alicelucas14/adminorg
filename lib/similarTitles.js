// Finds existing posts whose title is about the same topic as a new title, so the editor can warn
// before someone writes yet another rewrite of a post that already exists.
//
// Titles are compared on their meaningful words. Words that appear in many titles ("slot", "gaming",
// "guide", "explained") count for little; rare, specific words ("paylines", "cashback", "battery")
// count for a lot. Plural/singular forms match ("program" = "programs").

const STOP_WORDS = new Set((
    'a an the and or but nor for so yet of in on at to by from with without into onto over under about ' +
    'as is are was were be been being it its this that these those there their they them you your yours ' +
    'we our us i me my he she his her what which who whom whose when where why how than then too very ' +
    'can could should would will shall may might must do does did done have has had not no yes all any ' +
    'each every more most some such only own same just also vs versus via per up down out off again ' +
    'beyond between through during before after above below while until both few other ' +
    // headline filler: says nothing about the topic, so it must not make two titles look different
    'explained explain explaining guide guides understanding understand beginner beginners complete ' +
    'ultimate simple simply basic basics introduction overview breakdown look closer deep dive need ' +
    'know everything things thing really actually way ways work works working matter matters important ' +
    'jargon technical easy quick step steps tip tips new players player full friendly ' +
    // sales words found in almost every title on this site
    'play playing win wins big best top real cash money earn online india indian starsuu7 uu7 uu7game ' +
    'stars today now latest free'
).split(/\s+/));

function stem(word) {
    if (/^gam(e|es|er|ers|ing)$/.test(word)) return 'game';
    if (word.length > 5 && word.endsWith('ing')) word = word.slice(0, -3); // "saving" ~ "save", "playing" ~ "play"
    if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.length > 4 && /(ss|us|is)$/.test(word)) return word;
    if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
    return word;
}

function titleWords(title) {
    const words = String(title || '')
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/'s\b/g, '')
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w && !STOP_WORDS.has(w) && !/^\d{4}$/.test(w)) // drop years like "2025"
        .map(stem);
    return [...new Set(words)];
}

/**
 * @param {string} title  the title being typed
 * @param {{title: string}[]} candidates  existing posts (any extra fields are passed through)
 * @param {{limit?: number, minScore?: number}} [options]
 * @returns {Array<object & {score: number}>} best matches first
 */
// minScore 0.45 was tuned on the 231 duplicates removed on 2026-11-20: it flags about 4 in 5 of them,
// and most other matches it shows are posts on a genuinely related topic.
function findSimilarTitles(title, candidates, { limit = 5, minScore = 0.45 } = {}) {
    const target = titleWords(title);
    if (target.length < 2) return [];

    const docs = candidates.map((c) => ({ c, words: titleWords(c.title) }));
    const docFreq = new Map();
    for (const d of docs) for (const w of d.words) docFreq.set(w, (docFreq.get(w) || 0) + 1);
    const n = docs.length + 1;
    const weight = (w) => Math.log((n + 1) / ((docFreq.get(w) || 0) + 1)) + 1;
    const total = (words) => words.reduce((s, w) => s + weight(w), 0);
    const targetTotal = total(target);
    const targetSet = new Set(target);
    // One shared word is only enough when few titles use it ("paylines" yes, "slot" no).
    const rareLimit = Math.max(3, Math.ceil(docs.length * 0.05));

    return docs
        .filter((d) => d.words.length)
        .map((d) => {
            const shared = d.words.filter((w) => targetSet.has(w));
            if (!shared.length) return null;
            if (shared.length === 1 && (docFreq.get(shared[0]) || 0) > rareLimit) return null;
            const s = total(shared);
            // Average of "how much of the new title is covered" and "how much of the old title is covered",
            // so a short title fully contained in a longer one still scores high.
            const score = (s / targetTotal + s / total(d.words)) / 2;
            return { ...d.c, score: Math.round(score * 100) / 100 };
        })
        .filter((m) => m && m.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

module.exports = { findSimilarTitles, titleWords };
