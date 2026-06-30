// seedAdmin.js
require('dotenv').config({ path: '.env' }); // Look for .env in the parent (root) directory
const mongoose = require('mongoose');
const User = require('./models/User'); // CORRECTED PATH

/**
 * -------------------------------------------------------------------
 * SCRIPT CONFIGURATION
 * -------------------------------------------------------------------
 * Define the new admin user's credentials here.
 */
const newUserCredentials = {
    username: 'uu7',
    password: 'Tech1122@@',
    role: 'admin'
};
// -------------------------------------------------------------------

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
    console.error('Error: MONGO_URI is not defined in your .env file.');
    process.exit(1);
}

const seedAdminUser = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI);
        console.log('Database connected successfully.');

        // Check if the user already exists
        const existingUser = await User.findOne({ username: newUserCredentials.username });

        if (existingUser) {
            console.log(`User "${newUserCredentials.username}" already exists.`);
            console.log('No action taken.');
        } else {
            console.log(`Creating user "${newUserCredentials.username}"...`);
            // The 'pre-save' hook in your User model will automatically hash the password.
            await User.create(newUserCredentials);
            console.log(`✅ User "${newUserCredentials.username}" created successfully!`);
        }

    } catch (error) {
        console.error('❌ An error occurred during the seeding process:');
        console.error(error.message);
    } finally {
        // Ensure we disconnect from the database
        await mongoose.disconnect();
        console.log('Database connection closed.');
    }
};

// Run the script
seedAdminUser();