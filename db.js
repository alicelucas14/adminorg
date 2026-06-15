// backend/db.js
// --- MONGODB DATABASE CONNECTION ---

const mongoose = require('mongoose');

/**
 * Asynchronously connects to the MongoDB database using the connection string
 * from the environment variables.
 */
const connectDB = async () => {
  try {
    // Attempt to connect to the database.
    // The connection options are recommended by Mongoose for modern usage.
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB Connected Successfully.');

  } catch (error) {
    // If the connection fails, log the error and exit the application.
    // This is important because the app cannot run without a database connection.
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;