// backend/db.js
// --- MONGODB DATABASE CONNECTION ---

const mongoose = require('mongoose');

/**
 * Asynchronously connects to the MongoDB database using the connection string
 * from the environment variables.
 */
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log('MongoDB Connected Successfully.');

  } catch (error) {
    // If the connection fails, log the error and exit the application.
    // This is important because the app cannot run without a database connection.
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;