// backend/scripts/create-admin.js
// --- COMMAND-LINE SCRIPT TO CREATE AN ADMIN USER ---

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const readline = require('readline');
const connectDB = require('../db');
const User = require('../models/User'); // We directly require the User model here

// Setup readline interface for command-line input/output
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Promisify readline.question to use with async/await
 * @param {string} query The question to ask the user.
 * @returns {Promise<string>} The user's answer.
 */
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const createAdminUser = async () => {
    try {
        console.log('Connecting to the database...');
        await connectDB();
        console.log('Database connected.');

        const username = await question('Enter admin username: ');
        if (!username) {
            throw new Error('Username cannot be empty.');
        }

        // Check if user already exists
        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            throw new Error(`User with username '${username}' already exists.`);
        }

        const password = await question('Enter admin password: ');
        if (!password) {
            throw new Error('Password cannot be empty.');
        }

        console.log(`Creating admin user '${username}'...`);

        // Create a new user instance. The pre-save hook in the model will handle hashing.
        const newUser = new User({
            username: username.toLowerCase(),
            password: password,
            role: 'admin'
        });

        // Save the user to the database
        await newUser.save();

        console.log('✅ Admin user created successfully!');

    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        // Always close the connection and readline interface
        console.log('Disconnecting from database...');
        await mongoose.disconnect();
        rl.close();
    }
};

// Run the script
createAdminUser();