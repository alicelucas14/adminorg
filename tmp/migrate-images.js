require('../load-env');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const connectDB = require('../db');

const oldDomain = 'https://admin.uu7stars.com';
const newDomain = 'https://admin.starsuu7game.com';

connectDB().then(async () => {
  console.log('Connected to DB.');
  const collections = await mongoose.connection.db.collections();
  
  const backupData = {};
  const timestamp = Date.now();
  const backupFile = path.resolve(__dirname, `db_backup_${timestamp}.json`);
  
  // Step 1: Backup and Migrate
  for (let col of collections) {
    const colName = col.collectionName;
    const docs = await col.find({}).toArray();
    
    const matchingDocs = [];
    
    for (let doc of docs) {
      const updateFields = {};
      const fieldsToCheck = ['image', 'imageUrl', 'logoUrl', 'qrCodeImageUrl', 'apkDownloadLink', 'openGraphImage'];
      
      fieldsToCheck.forEach(field => {
        if (doc[field] && typeof doc[field] === 'string' && doc[field].includes(oldDomain)) {
          updateFields[field] = doc[field].replace(oldDomain, newDomain);
        }
      });
      
      if (Object.keys(updateFields).length > 0) {
        matchingDocs.push(doc);
        await col.updateOne({ _id: doc._id }, { $set: updateFields });
        console.log(` - Updated doc ${doc._id} in ${colName}:`, updateFields);
      }
    }
    
    if (matchingDocs.length > 0) {
      console.log(`Found and migrated ${matchingDocs.length} documents in ${colName}.`);
      backupData[colName] = matchingDocs;
    }
  }
  
  if (Object.keys(backupData).length > 0) {
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`\n✅ Backup successfully saved to ${backupFile}`);
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('\nℹ️ No documents needed migration.');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
