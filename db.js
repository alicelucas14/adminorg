// backend/db.js
// --- MONGODB DATABASE CONNECTION ---

const mongoose = require('mongoose');

/**
 * Asynchronously connects to the MongoDB database using the connection string
 * from the environment variables.
 */
const connectDB = async (options = {}) => {
  try {
    await mongoose.connect(process.env.MONGO_URI, options);

    console.log('MongoDB Connected Successfully.');

  } catch (error) {
    // Log and let the caller decide what to do — the HTTP server can still
    // serve /healthz and static assets even while Mongo is unreachable, and
    // mongoose will keep retrying the connection in the background.
    console.error('MongoDB Connection Error:', error.message);
  }
};

module.exports = connectDB;