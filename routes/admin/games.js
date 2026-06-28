// backend/routes/admin/games.js
// --- UPDATED: Added an endpoint to fetch games that do not have a review yet ---

const express = require('express');
const router = express.Router();
const { Game, Review } = require('../../models'); // <-- IMPORT Review model
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

/**
 * @route   GET /api/admin/games/unreviewed
 * @desc    Get all games that do not currently have a review
 * @access  Private (Admin)
 */
router.get('/unreviewed', async (req, res) => {
    try {
        // 1. Get all reviews and extract the names of the games that have been reviewed
        const reviews = await Review.find({}).select('gameName');
        const reviewedGameNames = new Set(reviews.map(review => review.gameName));

        // 2. Get all games
        const allGames = await Game.find({}).sort({ 'name.en': 1 });

        // 3. Filter out the games that already have a review
        const unreviewedGames = allGames.filter(game => !reviewedGameNames.has(game.name.en));

        res.json(unreviewedGames);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});


/**
 * @route   GET /api/admin/games
 * @desc    Get all games with pagination and search for the admin panel
 * @access  Private (Admin)
 */
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search;

        const filter = {};
        if (searchQuery) {
            const regex = new RegExp(searchQuery, 'i');
            filter.$or = [
                { 'name.en': regex },
                { 'name.hi': regex },
                { gameId: regex },
                { provider: regex }
            ];
        }

        const [games, totalItems] = await Promise.all([
            Game.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Game.countDocuments(filter)
        ]);

        res.json({
            data: games,
            totalItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/games/bulk-delete
 * @desc    Delete multiple games at once
 * @access  Private (Admin)
 */
router.delete('/bulk-delete', async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: 'Please provide an array of item IDs.' });
    }

    try {
        const result = await Game.deleteMany({ _id: { $in: ids } });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'No games found with the provided IDs.' });
        }
        res.json({ message: `${result.deletedCount} game(s) deleted successfully.` });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   POST /api/admin/games
 * @desc    Create a new game
 * @access  Private (Admin)
 */
router.post('/', async (req, res) => {
    const { gameId, name, category, provider, image, isNew, isHot, isActive, schemaMarkup } = req.body;
    if (!gameId || !name || !category || !provider || !image) {
        return res.status(400).json({ message: 'Please fill all required fields.' });
    }
    if (typeof name !== 'object' || !name.en || !name.hi) {
        return res.status(400).json({ message: 'Name must be an object with "en" and "hi" properties.' });
    }

    try {
        const newGame = new Game({ gameId, name, category, provider, image, isNew, isHot, isActive, schemaMarkup });
        const savedGame = await newGame.save();
        res.status(201).json(savedGame);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: `A game with ID '${gameId}' already exists.` });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/games/:id
 * @desc    Get a single game by its MongoDB _id
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res) => {
    try {
        const game = await Game.findById(req.params.id);
        if (!game) { return res.status(404).json({ message: 'Game not found' }); }
        res.json(game);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   PUT /api/admin/games/:id
 * @desc    Update a game
 * @access  Private (Admin)
 */
router.put('/:id', async (req, res) => {
    try {
        const updatedGame = await Game.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedGame) { return res.status(404).json({ message: 'Game not found' }); }
        res.json(updatedGame);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   DELETE /api/admin/games/:id
 * @desc    Delete a game (single)
 * @access  Private (Admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const deletedGame = await Game.findByIdAndDelete(req.params.id);
        if (!deletedGame) { return res.status(404).json({ message: 'Game not found' }); }
        res.json({ message: 'Game deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;