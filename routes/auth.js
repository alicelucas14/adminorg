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
        username: user.username,
        role: user.role
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
            username: user.username,
            role: user.role
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

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { username, password, website } = req.body;

  // Honeypot check for bots
  if (website) {
    console.warn(`Blocked registration attempt from bot using honeypot. Username: ${username}`);
    return res.status(400).json({ message: 'Registration failed.' });
  }

  // 1. Validation
  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide both username and password.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ message: 'Username must be at least 3 characters long.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  try {
    // 2. Check if username is already taken
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken.' });
    }

    // 3. Create new user (role defaults to 'user')
    const newUser = new User({
      username: cleanUsername,
      password: password
    });

    await newUser.save();

    // 4. Generate token
    const payload = {
      id: newUser._id,
      username: newUser.username,
      role: newUser.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({
      message: 'Registration successful!',
      token: token,
      user: {
        id: newUser._id,
        username: newUser.username,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'An internal server error occurred.' });
  }
});

module.exports = router;