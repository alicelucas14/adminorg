// ===== backend/check-settings.js =====

require('dotenv').config();
const connectDB = require('./db');
const { Setting } = require('./models');

const checkAndFixSettings = async () => {
  console.log('Connecting to database...');
  await connectDB();
  console.log('Connected.');

  try {
    console.log("Checking for 'siteSettings' document...");
    const settings = await Setting.findOne({ key: 'siteSettings' });

    if (settings) {
      console.log("✅ SUCCESS: Settings document already exists. No action needed.");
    } else {
      console.log("🟡 WARNING: Settings document not found. Creating it now...");
      await Setting.create({ key: 'siteSettings' });
      console.log("✅ SUCCESS: Settings document has been created with default values.");
    }
  } catch (error) {
    console.error("❌ ERROR: An error occurred during the check.", error);
  } finally {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
};

checkAndFixSettings();