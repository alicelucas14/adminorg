// backend/scripts/seed.js
// --- CORRECTED & FINAL DATABASE SEEDING SCRIPT ---

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const fs = require('fs');
const mongoose = require('mongoose');
const matter = require('gray-matter');

const connectDB = require('../db');
const { Game, BlogPost, Review } = require('../models');

// --- Game Data (unchanged) ---
const allGamesData = [
  { id: 'fortune-gems', name: 'Fortune Gems', category: 'slots', provider: 'JILI', image: '/fortune-gems-2.png', isHot: true },
  { id: 'super-ace', name: 'Super Ace', category: 'slots', provider: 'JILI', image: '/super-ace.webp' },
  { id: 'jili-caishin', name: 'Caishen', category: 'slots', provider: 'JILI', image: '/jili-caishin.webp' },
  { id: 'gates-of-olympus', name: 'Gates of Olympus', category: 'slots', provider: 'Pragmatic Play', image: '/gates_of_olympus.webp', isHot: true },
  { id: 'aviator', name: 'Aviator', category: 'quick-games', provider: 'Spribe', image: '/aviator.jpg', isHot: true },
  { id: 'ludo-king', name: 'Ludo King', category: 'quick-games', provider: 'In-house', image: '/ludo-king.png', isNew: true },
  { id: 'mines-gold', name: 'Mines Gold', category: 'quick-games', provider: 'JILI', image: '/GoldMines.png' },
  { id: 'rummy', name: 'Online Rummy', category: 'card-games', provider: 'In-house', image: '/rummy.png', isHot: true },
  { id: 'teen-patti', name: 'Teen Patti', category: 'card-games', provider: 'In-house', image: '/teenpatti.avif' },
  { id: 'andar-bahar', name: 'Andar Bahar', category: 'card-games', provider: 'Live Casino Providers', image: '/andar-bahar.webp' },
  { id: 'dragon-tiger', name: 'Dragon Tiger', category: 'live-casino', provider: 'Evolution', image: '/dragon-tiger-640x430-1.jpg' },
  { id: 'live-roulette', name: 'Live Roulette', category: 'live-casino', provider: 'Evolution', image: '/live-casino.webp', isHot: true },
  { id: 'live-blackjack', name: 'Live Blackjack', category: 'live-casino', provider: 'Pragmatic Play', image: '/Live-Blackjack.jpg' },
  { id: 'fishing-king', name: 'Fishing King', category: 'fishing', provider: 'JILI', image: '/category-fishing.jpg' },
  { id: 'cricket-exchange', name: 'Cricket Exchange', category: 'sports', provider: 'In-house', image: '/Indian-Rugby-Team-against-Pakistan-768x439.jpg' },
];

const seedGames = async () => {
    console.log('Seeding games...');
    await Game.deleteMany({});
    const gamesToInsert = allGamesData.map(game => ({
        gameId: game.id,
        name: { en: game.name, hi: `[HI] ${game.name}` },
        category: game.category,
        provider: game.provider,
        image: game.image,
        isNew: game.isNew || false,
        isHot: game.isHot || false,
        isActive: true
    }));
    await Game.insertMany(gamesToInsert);
    console.log(`✅ ${gamesToInsert.length} games seeded successfully.`);
};

// --- CORRECTED seedBlogPosts function ---
const seedBlogPosts = async () => {
    console.log('Seeding blog posts...');
    await BlogPost.deleteMany({});

    const blogContentEN = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/locales/en/blog.json'), 'utf8'));
    const blogContentHI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/locales/hi/blog.json'), 'utf8'));

    const postsDirectory = path.join(__dirname, '../../content/blog');
    const filenames = fs.readdirSync(postsDirectory).filter(f => f.endsWith('.mdx'));
    
    const postsToInsert = filenames.map(filename => {
        const filePath = path.join(postsDirectory, filename);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data, content: mdxBody } = matter(fileContents);
        const slug = filename.replace(/\.mdx$/, '');

        const contentEN = blogContentEN.posts[slug];
        const contentHI = blogContentHI.posts[slug];

        if (!contentEN) {
            console.warn(`⚠️  Skipping blog post '${slug}': No content found in en/blog.json.`);
            return null;
        }

        const titleEN = contentEN.title;
        const titleHI = contentHI?.title || `[HI] ${titleEN}`;
        const excerptEN = contentEN.excerpt;
        const excerptHI = contentHI?.excerpt || `[HI] ${excerptEN}`;
        const bodyEN = contentEN.body || mdxBody.trim();
        const bodyHI = contentHI?.body || `[HI] ${bodyEN}`;

        return {
            slug: slug,
            title: { en: titleEN, hi: titleHI },
            excerpt: { en: excerptEN, hi: excerptHI },
            body: { en: bodyEN, hi: bodyHI },
            author: data.author || 'UU7Game Expert',
            image: data.image,
            tags: data.tags || [],
            publishedAt: new Date(data.date),
            isPublished: true,
        };
    }).filter(Boolean);

    await BlogPost.insertMany(postsToInsert);
    console.log(`✅ ${postsToInsert.length} blog posts seeded successfully.`);
};

// --- CORRECTED seedReviews function ---
const seedReviews = async () => {
    console.log('Seeding reviews...');
    await Review.deleteMany({});

    const reviewContentEN = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/locales/en/game-reviews-content.json'), 'utf8'));
    const reviewContentHI = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/locales/hi/game-reviews-content.json'), 'utf8'));

    const reviewsDirectory = path.join(__dirname, '../../content/reviews');
    const filenames = fs.readdirSync(reviewsDirectory).filter(f => f.endsWith('.mdx'));
    
    const reviewsToInsert = filenames.map(filename => {
        const filePath = path.join(reviewsDirectory, filename);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const { data, content: mdxBody } = matter(fileContents);
        const slug = filename.replace(/\.mdx$/, '');

        const contentEN = reviewContentEN.reviews[slug];
        const contentHI = reviewContentHI.reviews[slug];

        if (!contentEN) {
            console.warn(`⚠️  Skipping review '${slug}': No content found in en/game-reviews-content.json.`);
            return null;
        }

        const titleEN = contentEN.title;
        const titleHI = contentHI?.title || `[HI] ${titleEN}`;
        const excerptEN = contentEN.excerpt;
        const excerptHI = contentHI?.excerpt || `[HI] ${excerptEN}`;
        const bodyEN = contentEN.content || mdxBody.trim();
        const bodyHI = contentHI?.content || `[HI] ${bodyEN}`;

        return {
            slug: slug,
            title: { en: titleEN, hi: titleHI },
            excerpt: { en: excerptEN, hi: excerptHI },
            body: { en: bodyEN, hi: bodyHI },
            gameName: data.gameName,
            developer: data.developer,
            rating: data.rating,
            image: data.image,
            pros: { 
                en: data.pros || [], 
                hi: (data.pros || []).map((p) => `[HI] ${p}`)
            },
            cons: { 
                en: data.cons || [], 
                hi: (data.cons || []).map((c) => `[HI] ${c}`)
            },
            isPublished: true,
        };
    }).filter(Boolean);

    await Review.insertMany(reviewsToInsert);
    console.log(`✅ ${reviewsToInsert.length} reviews seeded successfully.`);
};

// --- Main execution function ---
const runSeed = async () => {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Database connected.');
        
        console.log('Starting database seed process...');
        await seedGames();
        await seedBlogPosts();
        await seedReviews();
        
        console.log('🎉 Database seeding completed successfully!');
    } catch (error) {
        console.error('❌ An error occurred during the seed process:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database.');
    }
};

runSeed();