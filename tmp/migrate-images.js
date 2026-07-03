require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
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
    
    // Find matching documents
    const query = {
      $or: [
        { image: new RegExp(oldDomain) },
        { imageUrl: new RegExp(oldDomain) },
        { logoUrl: new RegExp(oldDomain) },
        { qrCodeImageUrl: new RegExp(oldDomain) },
        { apkDownloadLink: new RegExp(oldDomain) },
        { openGraphImage: new RegExp(oldDomain) }
      ]
    };
    
    const docs = await col.find(query).toArray();
    
    if (docs.length > 0) {
      console.log(`Found ${docs.length} matching documents in ${colName} to migrate.`);
      backupData[colName] = docs;
      
      // Perform update one by one
      for (let doc of docs) {
        const updateFields = {};
        
        const fieldsToCheck = ['image', 'imageUrl', 'logoUrl', 'qrCodeImageUrl', 'apkDownloadLink', 'openGraphImage'];
        fieldsToCheck.forEach(field => {
          if (doc[field] && typeof doc[field] === 'string' && doc[field].includes(oldDomain)) {
            updateFields[field] = doc[field].replace(oldDomain, newDomain);
          }
        });
        
        if (Object.keys(updateFields).length > 0) {
          await col.updateOne({ _id: doc._id }, { $set: updateFields });
          console.log(` - Updated doc ${doc._id} in ${colName}:`, updateFields);
        }
      }
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
