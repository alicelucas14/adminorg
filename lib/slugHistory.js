// Records previous slugs on a document so old URLs can be 301-redirected to the new one.
// Applied to every schema that has a public, slug-addressed URL.
//
// `slugHistory` is select:false so it never leaks into API responses or admin payloads,
// and any client-supplied value is discarded - only the hook below may write it.
//
// Slugs are also cleaned up (normalizeSlug) whenever one is written. This is done in the write hooks,
// not as a schema setter: Mongoose runs setters on query filters too, so a setter would stop
// findOne({ slug }) from finding documents that still have an old messy slug like "rummy all games".
// Re-saving such a document in the admin rewrites its slug and the old one 301s to it.

const normalizeSlug = require('./normalizeSlug');

function cleanSlug(value) {
    const slug = normalizeSlug(value);
    if (!slug) throw new Error('The slug must contain at least one letter or number.');
    return slug;
}

module.exports = function slugHistoryPlugin(schema) {
    schema.add({ slugHistory: { type: [String], default: [], index: true, select: false } });

    schema.pre('validate', function () {
        if ((this.isNew || this.isModified('slug')) && typeof this.slug === 'string') {
            this.slug = cleanSlug(this.slug);
        }
    });

    schema.pre('findOneAndUpdate', async function () {
        const raw = this.getUpdate() || {};

        // Normalise to { $set: {...}, ...otherOperators } so plain top-level fields and operators mix safely.
        const update = {};
        const set = {};
        for (const [key, value] of Object.entries(raw)) {
            if (key.startsWith('$')) update[key] = value;
            else set[key] = value;
        }
        update.$set = { ...(update.$set || {}), ...set };
        delete update.$set.slugHistory;

        const nextSlug = typeof update.$set.slug === 'string' ? cleanSlug(update.$set.slug) : null;
        if (nextSlug) {
            update.$set.slug = nextSlug;
            const current = await this.model.findOne(this.getQuery()).select('+slugHistory slug').lean();
            if (current && current.slug !== nextSlug) {
                const history = new Set(current.slugHistory || []);
                history.delete(nextSlug); // moving back to a former slug: it is live again, not history
                history.add(current.slug);
                update.$set.slugHistory = Array.from(history);
            }
        }

        this.setUpdate(update);
    });
};
