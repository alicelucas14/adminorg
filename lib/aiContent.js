// backend/lib/aiContent.js
// --- NEW FILE: Centralized AI content generation logic ---

const { OpenAI } = require('openai');

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a full game review using the OpenAI API.
 * @param {string} gameName - The name of the game to review.
 * @param {string} developer - The developer of the game.
 * @returns {Promise<object>} A review object with title, body, rating, pros, and cons.
 */
async function generateReviewWithAI(gameName, developer) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured.');
  }

  const prompt = `
    You are an expert content writer for Starsuu7, an Indian real-money gaming platform.
    Your task is to write a detailed, positive, and SEO-friendly review for the game "${gameName}" by "${developer}".

    Generate a complete review as a single JSON object. The JSON object MUST have the following keys and nothing else:
    1.  "title": An object with "en" (English) and "hi" (Hindi) translations for an engaging review title.
    2.  "excerpt": An object with "en" and "hi" translations for a short, enticing summary (max 150 characters).
    3.  "body": An object with "en" and "hi" translations for the full review body in Markdown format. The review must be well-structured with headings (e.g., "### Introduction", "### Gameplay & Features", "### Graphics & Sound", "### Conclusion"). It must be positive and mention hypothetical features like "smooth UI", "fast withdrawals", "great bonuses", and "fair gameplay".
    4.  "rating": A floating-point number between 4.3 and 4.9.
    5.  "pros": An object with "en" and "hi" keys, each containing an array of exactly 3 short, positive strings (e.g., "Excellent graphics", "Quick payouts").
    6.  "cons": An object with "en" and "hi" keys, each containing an array of exactly 2 minor, constructive strings (e.g., "Can be challenging for new players", "Requires stable internet").

    The entire output must be a single, valid JSON object.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.75,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    const parsedJson = JSON.parse(content);

    if (!parsedJson.title || !parsedJson.body || !parsedJson.rating) {
        throw new Error('AI response was missing required fields.');
    }
    return parsedJson;
  } catch (error) {
    console.error("Error calling OpenAI API for review generation:", error);
    throw new Error('Failed to generate review from AI service.');
  }
}

/**
 * Generates realistic user comments for a given review context.
 * @param {object} reviewContext - An object containing { gameName, title: { en } }.
 * @param {number} count - The number of comments to generate.
 * @returns {Promise<Array>} An array of comment objects.
 */
async function generateCommentsForReview(reviewContext, count) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured.');
  }

  const prompt = `
    You are an AI assistant generating realistic user comments for a review on an Indian real-money gaming app called Starsuu7.
    The review is for the game: "${reviewContext.gameName}". The review title is: "${reviewContext.title.en}".
    
    Generate ${count} user comments in a JSON array. Each object MUST have "username", "rating" (integer 4-5), and "text" keys.
    - "username": A realistic Indian name (e.g., "Rohan S.", "Priya Sharma").
    - "text": A concise, positive comment in English, mentioning aspects like "fast withdrawals", "great graphics", or "fair matchmaking".

    Example of a valid JSON output:
    [
      { "username": "Arjun P.", "rating": 5, "text": "Best app for ${reviewContext.gameName}! Smooth interface and fast withdrawals." },
      { "username": "Sneha Reddy", "rating": 4, "text": "Really enjoying the tournaments. Very rewarding." }
    ]
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    const parsedJson = JSON.parse(content);
    // The AI might return an object like { "comments": [...] }. Find the array.
    const commentsArray = Array.isArray(parsedJson) ? parsedJson : Object.values(parsedJson)[0];

    if (!Array.isArray(commentsArray)) {
      throw new Error('AI response for comments was not a valid JSON array.');
    }
    return commentsArray;
  } catch (error) {
    console.error("Error calling OpenAI API for comment generation:", error);
    throw new Error('Failed to generate comments from AI service.');
  }
}

module.exports = {
  generateReviewWithAI,
  generateCommentsForReview,
};