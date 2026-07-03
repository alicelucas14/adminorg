require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../db');

connectDB().then(async () => {
  console.log('Connected to DB.');
  const collections = await mongoose.connection.db.collections();
  for (let col of collections) {
    const colName = col.collectionName;
    const docs = await col.find({
      $or: [
        { image: /admin\.uu7stars\.com/ },
        { imageUrl: /admin\.uu7stars\.com/ },
        { logoUrl: /admin\.uu7stars\.com/ },
        { qrCodeImageUrl: /admin\.uu7stars\.com/ },
        { apkDownloadLink: /admin\.uu7stars\.com/ },
        { openGraphImage: /admin\.uu7stars\.com/ }
      ]
    }).toArray();
    
    if (docs.length > 0) {
      console.log(`=== Collection: ${colName} ===`);
      docs.forEach(d => {
        console.log(JSON.stringify(d, null, 2));
      });
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
