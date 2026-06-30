// scripts/update-password.js
// --- SCRIPT TO UPDATE PASSWORD FOR AN EXISTING USER ---

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../db');
const User = require('../models/User');

const username = 'uu7';
const newPassword = 'Tech1122@@';

const updatePassword = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected.');

        console.log(`Searching for user '${username}'...`);
        const user = await User.findOne({ username: username.toLowerCase() });

        if (!user) {
            console.log(`❌ User '${username}' not found.`);
            process.exit(1);
        }

        user.password = newPassword; // The pre-save hook in models/User.js will automatically hash this
        await user.save();

        console.log(`✅ Successfully updated password for '${username}'!`);
    } catch (error) {
        console.error('❌ Error updating password:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Database connection closed.');
    }
};

updatePassword();
