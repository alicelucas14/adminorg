// scripts/promote.js
// --- SCRIPT TO PROMOTE AN EXISTING USER TO ADMIN ---

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../db');
const User = require('../models/User');

const usernameToPromote = 'uu7';

const promoteUser = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected.');

        console.log(`Searching for user '${usernameToPromote}'...`);
        const user = await User.findOne({ username: usernameToPromote.toLowerCase() });

        if (!user) {
            console.log(`❌ User '${usernameToPromote}' not found.`);
            process.exit(1);
        }

        console.log(`User found. Current role: '${user.role}'`);
        
        user.role = 'admin';
        await user.save();

        console.log(`✅ Successfully promoted '${usernameToPromote}' to admin!`);
    } catch (error) {
        console.error('❌ Error promoting user:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Database connection closed.');
    }
};

promoteUser();
