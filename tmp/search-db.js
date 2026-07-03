require('../load-env');
const mongoose = require('mongoose');
const connectDB = require('../db');

connectDB().then(async () => {
  console.log('Connected to DB.');
  const collections = await mongoose.connection.db.collections();
  for (let col of collections) {
    const colName = col.collectionName;
    
    // Find documents containing admin.uu7stars.com in any string fields
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
      console.log(`Found ${docs.length} matching documents in ${colName}:`);
      docs.forEach(d => {
        console.log(` - ID: ${d._id}, Title: ${d.title?.en || d.name?.en || d.key || 'N/A'}`);
        console.log(`   image: ${d.image || d.imageUrl || 'N/A'}`);
      });
    }
  }
  process.exit(0);
}).catch(err => {
  console.error('Error running script:', err);
  process.exit(1);
});
