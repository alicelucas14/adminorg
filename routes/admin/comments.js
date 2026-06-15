// ===== backend/routes/admin/comments.js =====
// --- FIXED: Reverted to the stable 'gemini-pro' model compatible with the v1beta API ---

const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { protect } = require('../../middleware/authMiddleware');
const { Review, Comment } = require('../../models');
const mongoose = require('mongoose');


//==============================================
// AI COMMENT GENERATION LOGIC
//==============================================
// ... (comments remain the same)
//==============================================

// --- OpenAI Logic ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateCommentsWithOpenAI(review, count, prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file.');
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    const parsedJson = JSON.parse(content);
    const commentsArray = Array.isArray(parsedJson) ? parsedJson : Object.values(parsedJson)[0];

    if (!Array.isArray(commentsArray)) throw new Error('AI response was not a valid JSON array.');
    return commentsArray;

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw new Error('Failed to generate comments from OpenAI service.');
  }
}

// --- Google Gemini Logic ---
async function generateCommentsWithGemini(review, count, prompt) {
  if (!process.env.GOOGLE_GEMINI_API_KEY) {
    throw new Error('Google Gemini API key is not configured. Please set GOOGLE_GEMINI_API_KEY in your .env file.');
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    // --- THE FIX: Reverted to the stable 'gemini-pro' model compatible with the v1beta API ---
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = await response.text();
    text = text.replace(/^```json\s*/, '').replace(/```$/, '');
    
    const parsedJson = JSON.parse(text);
    const commentsArray = Array.isArray(parsedJson) ? parsedJson : Object.values(parsedJson)[0];

    if (!Array.isArray(commentsArray)) throw new Error('AI response was not a valid JSON array.');
    return commentsArray;

  } catch (error) {
    console.error("Error calling Google Gemini API:", error);
    throw new Error('Failed to generate comments from Gemini service.');
  }
}


/**
 * @desc    A router function that selects the AI provider based on environment variables.
 */
async function generateAiComments(review, count) {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();

  const prompt = `
    You are an AI assistant designed to generate realistic user comments for a review on an Indian real-money gaming app called Starsuu7.
    The review is for the game: "${review.gameName}".
    The review title is: "${review.title.en}".
    
    Based on this context, generate ${count} user comments.
    Your output MUST be a valid JSON object containing a single key "comments" which holds an array of comment objects. Each object in the array MUST have the following three keys and nothing else:
    1. "username": A realistic-sounding Indian name (e.g., "Rohan S.", "Priya Sharma").
    2. "rating": An integer between 4 and 5.
    3. "text": The comment text. The comment should sound like a real user. It can mention positive aspects like "fast withdrawals", "great graphics", or "fair gameplay". Comments can use common Indian-English phrasing and should be 1-3 sentences long.

    Example of the required JSON output format:
    {
      "comments": [
        {
          "username": "Arjun P.",
          "rating": 5,
          "text": "Best app for ${review.gameName}! The interface is so smooth and I got my winnings credited in just a few hours."
        }
      ]
    }

    Now, generate the JSON object for the given review.
  `;

  if (provider === 'gemini') {
    console.log(`Using Google Gemini AI to generate comments for review: ${review.title.en}`);
    return generateCommentsWithGemini(review, count, prompt);
  }
  
  console.log(`Using OpenAI to generate comments for review: ${review.title.en}`);
  return generateCommentsWithOpenAI(review, count, prompt);
}
// --- END AI Generation Logic ---


router.use(protect);

/**
 * @route   POST /api/admin/comments/generate
 * @desc    Generate and save AI comments for a SINGLE review.
 * @access  Private (Admin)
 */
router.post('/generate', async (req, res) => {
  const { reviewId, count = 5 } = req.body;

  if (!reviewId || !mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({ message: 'A valid Review ID is required.' });
  }

  try {
    const review = await Review.findById(reviewId);
    if (!review) { return res.status(404).json({ message: 'Review not found.' }); }

    const generatedComments = await generateAiComments(review, count);
    if (!generatedComments || generatedComments.length === 0) {
        return res.status(500).json({ message: 'AI failed to generate comments.' });
    }

    const commentsToSave = generatedComments.map(comment => ({
      reviewId: review._id, username: comment.username, rating: comment.rating, text: comment.text,
    }));
    const savedComments = await Comment.insertMany(commentsToSave);

    res.status(201).json({
      message: `${savedComments.length} comments generated and saved for review "${review.title.en}".`,
      data: savedComments,
    });

  } catch (error) {
    console.error('Error in single comment generation route:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});


/**
 * @route   POST /api/admin/comments/bulk-generate
 * @desc    Generate AI comments for MULTIPLE reviews at once.
 * @access  Private (Admin)
 */
router.post('/bulk-generate', async (req, res) => {
    const { reviewIds, count = 5 } = req.body;

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
        return res.status(400).json({ message: 'An array of reviewIds is required.' });
    }

    let allCommentsToSave = [];
    let successfulReviews = 0;
    let failedReviews = [];

    for (const reviewId of reviewIds) {
        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            failedReviews.push({ id: reviewId, reason: 'Invalid ID format' });
            continue;
        }
        
        try {
            const review = await Review.findById(reviewId);
            if (!review) {
                failedReviews.push({ id: reviewId, reason: 'Review not found' });
                continue;
            }

            const generatedComments = await generateAiComments(review, count);
            if (generatedComments && generatedComments.length > 0) {
                const comments = generatedComments.map(c => ({
                    reviewId: review._id, username: c.username, rating: c.rating, text: c.text
                }));
                allCommentsToSave.push(...comments);
                successfulReviews++;
            } else {
                failedReviews.push({ id: reviewId, reason: 'AI returned no comments' });
            }
        } catch (error) {
            console.error(`Failed to generate comments for review ${reviewId}:`, error.message);
            failedReviews.push({ id: reviewId, reason: error.message });
        }
    }

    if (allCommentsToSave.length > 0) {
        await Comment.insertMany(allCommentsToSave);
    }

    res.status(201).json({
        message: `Bulk generation complete. Successfully generated ${allCommentsToSave.length} comments for ${successfulReviews} review(s).`,
        failures: failedReviews.length,
        failedReviews: failedReviews
    });
});


module.exports = router;