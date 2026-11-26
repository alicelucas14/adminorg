// Finds other blog posts that already use the same main keyword (focusKeyword), so the editor can warn
// before two posts aim at the same Google search and compete with each other.
//
// Two keywords count as the same when they match after: lower case, punctuation and dashes turned into
// spaces ("multi-line" = "multi line"), and plural/singular ignored ("video slots" = "video slot").
// Word order still matters: "slot RTP" and "RTP in slots" are different keywords.

function keywordKey(keyword) {
    return String(keyword || '')
        .toLowerCase()
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .filter(Boolean)
        .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
        .join(' ');
}

/**
 * @param {string} keyword  the keyword typed in the editor
 * @param {{_id: any, focusKeyword?: string, title?: {en?: string}, slug?: string, isPublished?: boolean}[]} posts
 * @param {string} [excludeId]  the post being edited
 * @returns {{id: string, title: string, slug: string, focusKeyword: string, isPublished: boolean}[]} live posts first
 */
function findKeywordUses(keyword, posts, excludeId = '') {
    const key = keywordKey(keyword);
    if (!key) return [];
    return posts
        .filter((p) => String(p._id) !== String(excludeId) && keywordKey(p.focusKeyword) === key)
        .map((p) => ({
            id: String(p._id),
            title: p.title?.en || p.slug || '',
            slug: p.slug || '',
            focusKeyword: p.focusKeyword || '',
            isPublished: p.isPublished !== false,
        }))
        .sort((a, b) => Number(b.isPublished) - Number(a.isPublished));
}

module.exports = { keywordKey, findKeywordUses };
