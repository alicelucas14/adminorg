// backend/middleware/apiKeyMiddleware.js
// --- MIDDLEWARE TO PROTECT SERVER-TO-SERVER API ROUTES ---

/**
 * A middleware function to protect routes that are only meant to be accessed
 * by our own frontend server.
 *
 * It checks for a custom 'X-API-KEY' header and compares its value
 * to a secret key stored in our environment variables.
 */
const requireApiKey = (request, response, next) => {
    const apiKey = request.get('X-API-KEY');

    // Check if the API key was provided and if it matches the one in our .env file
    if (apiKey && apiKey === process.env.BACKEND_API_KEY) {
        // If the key is valid, proceed to the route handler
        next();
    } else {
        // If the key is missing or invalid, block the request
        response.status(401).json({ message: 'Unauthorized: Invalid or missing API Key.' });
    }
};

module.exports = { requireApiKey };