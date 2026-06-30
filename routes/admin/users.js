// backend/routes/admin/users.js
// --- USER MANAGEMENT API ENDPOINTS FOR ADMIN ---

const express = require('express');
const router = express.Router();
const User = require('../../models/User');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with pagination and search
 * @access  Private (Admin Only)
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search;

        const filter = {};
        if (searchQuery) {
            filter.username = new RegExp(searchQuery, 'i');
        }

        const [users, totalItems] = await Promise.all([
            User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).select('-password'),
            User.countDocuments(filter)
        ]);

        res.json({
            data: users,
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/users/:id/role
 * @desc    Toggle or update a user's role
 * @access  Private (Admin Only)
 */
router.put('/:id/role', async (req, res) => {
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role specified.' });
    }

    try {
        // Prevent editing own role
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot change your own role.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.role = role;
        await user.save();

        res.json({ message: `User role updated to ${role} successfully.`, user: { id: user._id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete a user
 * @access  Private (Admin Only)
 */
router.delete('/:id', async (req, res) => {
    try {
        // Prevent deleting own account
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
