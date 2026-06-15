require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Assumes your User model is here

const MONGO_URI = process.env.MONGO_URI;

const usersToSeed = [
    {
        username: 'uu7',
        password: 'Tech1122@'
    }
    // You can add more users here in the future
];

const seedUsers = async () => {
    if (!MONGO_URI) {
        console.error('MONGO_URI is not defined in your .env file.');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected for seeding...');

        for (const userData of usersToSeed) {
            const userExists = await User.findOne({ username: userData.username });

            if (userExists) {
                console.log(`User '${userData.username}' already exists. Skipping.`);
                continue;
            }

            // Hash the password before saving
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(userData.password, salt);

            await User.create({
                username: userData.username,
                password: hashedPassword
            });

            console.log(`Successfully created user: ${userData.username}`);
        }

    } catch (error) {
        console.error('Error during seeding:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('MongoDB disconnected.');
    }
};

seedUsers();