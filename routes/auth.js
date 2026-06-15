// backend/routes/auth.js
// --- ADMIN AUTHENTICATION ROUTES ---

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

/**
 * @route   POST /auth/login
 * @desc    Authenticate admin user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // 1. Basic Validation: Check if username and password were provided
  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide both username and password.' });
  }

  try {
    // 2. Find User: Look for the user in the database by their username (case-insensitive).
    const user = await User.findOne({ username: username.toLowerCase() });

    // 3. Validate Password:
    // If a user is found, call the `matchPassword` method we created in the User model.
    // This securely compares the provided password with the hashed password in the database.
    if (user && (await user.matchPassword(password))) {
      // 4. Generate Token: If credentials are valid, create a JWT.
      const payload = {
        id: user._id, // The token payload contains the user's unique ID.
        username: user.username
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET, // The secret key used for signing the token.
        { expiresIn: '1d' } // The token will expire in 1 day.
      );

      // 5. Send Response: Send the user's info and the token back to the client.
      res.json({
        message: 'Login successful!',
        token: token,
        user: {
            id: user._id,
            username: user.username
        }
      });

    } else {
      // If user not found or password doesn't match, send a 401 Unauthorized error.
      // Use a generic message for security to not reveal which field was incorrect.
      res.status(401).json({ message: 'Invalid credentials.' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

module.exports = router;