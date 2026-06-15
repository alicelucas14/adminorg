// backend/routes/admin/upload.js
// --- UPDATED to return absolute image URLs ---

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

// Ensure the 'public/uploads' directory exists before we try to save files to it.
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 1. Configure Multer's Storage Engine
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Tell multer to save files in the 'public/uploads' directory
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename to prevent overwrites: fieldname-timestamp.extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. Configure Multer's File Filter to accept only images
const fileFilter = (req, file, cb) => {
    // A regular expression to check for allowed image mimetypes
    const allowedMimeTypes = /jpeg|jpg|png|gif|webp/;
    const isMimeTypeAllowed = allowedMimeTypes.test(file.mimetype);
    const isExtensionAllowed = allowedMimeTypes.test(path.extname(file.originalname).toLowerCase());

    if (isMimeTypeAllowed && isExtensionAllowed) {
        // Accept the file
        return cb(null, true);
    } else {
        // Reject the file
        cb(new Error('Error: Only image files are allowed! (jpeg, jpg, png, gif, webp)'));
    }
};

// 3. Initialize Multer with our configuration
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Set a 5 MB file size limit
    fileFilter: fileFilter
});

/**
 * @route   POST /api/admin/upload
 * @desc    Upload a single image. The middleware 'upload.single('image')' processes the file.
 * @access  Private (Admin)
 */
router.post('/', protect, (req, res) => {
    const uploader = upload.single('image');

    uploader(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: err.message });
        } else if (err) {
            return res.status(400).json({ message: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file was uploaded.' });
        }
        
        // --- NEW: Construct the absolute URL ---
        const backendUrl = process.env.BACKEND_URL;
        if (!backendUrl) {
            console.error('CRITICAL: BACKEND_URL environment variable is not set!');
            return res.status(500).json({ message: 'Server configuration error: Missing BACKEND_URL.' });
        }
        const relativePath = `/uploads/${req.file.filename}`;
        const absolutePath = new URL(relativePath, backendUrl).href;
        // --- END NEW ---

        // If the upload was successful, respond with the public, absolute path to the file.
        res.status(200).json({
            message: 'Image uploaded successfully!',
            // UPDATED: Respond with the absolute path
            filePath: absolutePath
        });
    });
});

module.exports = router;