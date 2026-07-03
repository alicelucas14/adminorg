require('../load-env');
const mongoose = require('mongoose');
const connectDB = require('../db');

connectDB().then(async () => {
  console.log('Connected to DB.');
  const collections = await mongoose.connection.db.collections();
  for (let col of collections) {
    const colName = col.collectionName;
    const count = await col.countDocuments({});
    console.log(`Collection: ${colName}, Total Documents: ${count}`);
    if (count > 0) {
      const firstDocs = await col.find({}).limit(3).toArray();
      console.log(`First ${firstDocs.length} documents:`);
      firstDocs.forEach(d => {
        console.log(` - ID: ${d._id}, Title: ${d.title?.en || d.name?.en || d.key || 'N/A'}`);
        console.log(`   image: ${d.image || d.imageUrl || 'N/A'}`);
        console.log(`   logoUrl: ${d.logoUrl || 'N/A'}`);
      });
    }
  }
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
