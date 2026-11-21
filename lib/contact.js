// backend/lib/contact.js
// Messages sent through the contact form on the website's About page. They are stored (ContactMessage) and read under
// Admin > Messages. Nothing is e-mailed: there is no mail setup, so the admin screen (with its unread counter) is the inbox.
//
// The website calls this from its own server (never from the visitor's browser), so the API key stays secret. The
// website has already applied its own per-visitor rate limit; the checks here are the backstop that does not depend on it.

const LIMITS = {
    name: 100,
    email: 200,
    phone: 30,
    userId: 60,
    minMessage: 10,
    message: 2000,
    maxLinks: 2,            // a real question rarely has more than a link or two; spam is mostly links
    perEmailPerHour: 5,
    perHour: 120,           // every visitor together
    dedupeMinutes: 10,      // the same person sending the same text again is ignored (double click, retry)
};

// `field` says which input to blame, so the website can show the error under it in the visitor's language.
class ContactValidationError extends Error {
    constructor(field, message) { super(message); this.field = field; }
}

const clean = (v) => (typeof v === 'string'
    ? v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
    : '');

const EMAIL_RE = /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/;
const PHONE_RE = /^[0-9+()\-\s.]{6,30}$/;

/** Returns the cleaned message to store, or throws a ContactValidationError (field + message). */
function sanitizeContact(input) {
    const b = input && typeof input === 'object' ? input : {};
    const name = clean(b.name).replace(/\s+/g, ' ');
    const email = clean(b.email).toLowerCase();
    const phone = clean(b.phone);
    const userId = clean(b.userId).replace(/\s+/g, ' ');
    const message = clean(b.message);
    const lang = b.lang === 'hi' ? 'hi' : 'en';

    if (!name) throw new ContactValidationError('name', 'Please enter your name.');
    if (name.length > LIMITS.name) throw new ContactValidationError('name', `The name is longer than ${LIMITS.name} characters.`);
    if (!email) throw new ContactValidationError('email', 'Please enter your email address.');
    if (email.length > LIMITS.email || !EMAIL_RE.test(email)) throw new ContactValidationError('email', 'That email address does not look right.');
    if (phone && !PHONE_RE.test(phone)) throw new ContactValidationError('phone', 'That phone number does not look right.');
    if (userId.length > LIMITS.userId) throw new ContactValidationError('userId', `The user ID is longer than ${LIMITS.userId} characters.`);
    if (message.length < LIMITS.minMessage) throw new ContactValidationError('message', 'Please write a little more.');
    if (message.length > LIMITS.message) throw new ContactValidationError('message', `The message is longer than ${LIMITS.message} characters.`);
    if ((message.match(/https?:\/\/|www\./gi) || []).length > LIMITS.maxLinks) throw new ContactValidationError('message', 'Please remove some of the links.');

    return { name, email, phone, userId, message, lang };
}

module.exports = { sanitizeContact, ContactValidationError, LIMITS };
