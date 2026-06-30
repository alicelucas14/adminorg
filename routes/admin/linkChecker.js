// ===== backend/routes/admin/linkChecker.js =====

const express = require('express');
const router = express.Router();
const { runLinkScan, getScanStatus } = require('../../lib/linkChecker');
const { protect } = require('../../middleware/authMiddleware');

// Protect all routes in this router
router.use(protect);

/**
 * @route   POST /api/admin/link-checker/scan
 * @desc    Start background link scan
 * @access  Private (Admin)
 */
router.post('/scan', async (req, res) => {
    try {
        const status = getScanStatus();
        if (status.isScanning) {
            return res.status(400).json({ message: 'Scan is already running', status });
        }

        const frontendUrl = req.app.locals.frontendUrl || process.env.FRONTEND_URL || 'https://uu7stars.com';
        
        // Run scan asynchronously in background
        runLinkScan(frontendUrl).catch(err => {
            console.error('[LinkChecker Route] Background scan error:', err);
        });

        res.json({ message: 'Scan initiated', status: getScanStatus() });
    } catch (error) {
        console.error('Error starting link scan:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

/**
 * @route   GET /api/admin/link-checker/status
 * @desc    Get the current scan progress and status
 * @access  Private (Admin)
 */
router.get('/status', (req, res) => {
    try {
        res.json(getScanStatus());
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

module.exports = router;
