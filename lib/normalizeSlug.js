// Turns whatever was typed into the admin's slug field into a clean URL segment:
// "Rummy All Games" -> "rummy-all-games", "teen-patti-₹50-bonus" -> "teen-patti-50-bonus",
// "rummy-gold-tips-&-tricks" -> "rummy-gold-tips-and-tricks".
// Letters/marks/digits of any script are kept (so a Hindi slug stays Hindi); everything else
// (spaces, ₹, punctuation, slashes) becomes a single hyphen. Already-clean slugs are unchanged.
module.exports = function normalizeSlug(value) {
    return String(value ?? '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/&/g, '-and-')
        .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '');
};
