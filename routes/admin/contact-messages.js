// backend/routes/admin/contact-messages.js
// Admin > Messages: the inbox for the contact form on the About page. See lib/contact.js.

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { ContactMessage } = require('../../models');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

const PAGE_SIZE = 20;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const validId = (id) => mongoose.Types.ObjectId.isValid(id);

/** @route GET /api/admin/contact-messages/unread-count - for the badge in the sidebar */
router.get('/unread-count', async (req, res) => {
    try {
        res.json({ unread: await ContactMessage.countDocuments({ status: 'new' }) });
    } catch (error) {
        res.status(500).json({ message: 'Server Error while counting messages.' });
    }
});

/**
 * @route   GET /api/admin/contact-messages?status=all|new|read&q=&page=
 * @desc    One page of messages, newest first, plus the totals the screen shows.
 */
router.get('/', async (req, res) => {
    try {
        const status = ['new', 'read'].includes(req.query.status) ? req.query.status : 'all';
        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);

        const filter = {};
        if (status !== 'all') filter.status = status;
        if (q) {
            const rx = new RegExp(escapeRegex(q), 'i');
            filter.$or = [{ name: rx }, { email: rx }, { userId: rx }, { phone: rx }, { message: rx }];
        }

        const [items, total, unread, all] = await Promise.all([
            ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
            ContactMessage.countDocuments(filter),
            ContactMessage.countDocuments({ status: 'new' }),
            ContactMessage.countDocuments({}),
        ]);
        res.json({ items, total, unread, all, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE });
    } catch (error) {
        console.error('Error loading contact messages:', error);
        res.status(500).json({ message: 'Server Error while loading messages.' });
    }
});

/** @route POST /api/admin/contact-messages/mark-all-read */
router.post('/mark-all-read', async (req, res) => {
    try {
        const result = await ContactMessage.updateMany({ status: 'new' }, { $set: { status: 'read' } });
        res.json({ updated: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: 'Server Error while updating messages.' });
    }
});

/** @route PATCH /api/admin/contact-messages/:id  body { status: 'read' | 'new' } */
router.patch('/:id', async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid message ID.' });
        const status = req.body && req.body.status;
        if (!['new', 'read'].includes(status)) return res.status(400).json({ message: 'Status must be "new" or "read".' });
        const doc = await ContactMessage.findByIdAndUpdate(req.params.id, { $set: { status } }, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: 'Message not found.' });
        res.json(doc);
    } catch (error) {
        res.status(500).json({ message: 'Server Error while updating the message.' });
    }
});

/** @route DELETE /api/admin/contact-messages/:id */
router.delete('/:id', async (req, res) => {
    try {
        if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid message ID.' });
        const doc = await ContactMessage.findByIdAndDelete(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: 'Message not found.' });
        res.json({ message: 'Message deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error while deleting the message.' });
    }
});

module.exports = router;
