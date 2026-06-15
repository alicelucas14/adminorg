// backend/models/User.js
// --- ADMIN USER SCHEMA ---

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
    }
});

/**
 * Mongoose 'pre-save' hook.
 * This function will automatically run *before* a User document is saved.
 * If the password has been modified (or is new), it hashes it.
 */
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) {
        return next();
    }

    try {
        // Generate a "salt" to add random characters to the hash, making it more secure.
        const salt = await bcrypt.genSalt(10);
        // Hash the password with the salt.
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

/**
 * Method to compare a candidate password with the user's hashed password.
 * This will be used during the login process.
 * @param {string} candidatePassword - The password provided by the user during login.
 * @returns {Promise<boolean>} - True if the passwords match, false otherwise.
 */
userSchema.methods.matchPassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};


const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;