// backend/middleware/authMiddleware.js
// --- JWT AUTHENTICATION MIDDLEWARE (FINAL VERSION) ---

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in cookies (for admin UI)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } 
  // 2. Fallback: Check for token in Authorization header (for API tools like Postman)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // If no token is found anywhere
  if (!token) {
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ message: 'Not authorized, no token.' });
    }
    return res.redirect('/admin');
  }

  // 3. Token Verification
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    // Handle case where user was deleted after token was issued
    if (!req.user) {
      console.log('Authentication failed: User not found.');
      res.clearCookie('token'); 
      return res.redirect('/admin');
    }
    
    // The user is authenticated and valid, proceed to the requested page.
    next();

  } catch (error) {
    // This block catches errors like an expired or malformed token.
    console.error('Token verification failed:', error.message);
    
    res.clearCookie('token'); 
    
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ message: 'Not authorized, token failed.' });
    }
    return res.redirect('/admin');
  }
};

module.exports = { protect };