// ===== backend/models/LinkCheckResult.js =====

const mongoose = require('mongoose');

const linkCheckResultSchema = new mongoose.Schema({
  url: { type: String, required: true },
  resolvedUrl: { type: String, required: true },
  type: { type: String, enum: ['internal', 'external'], required: true },
  status: { type: String, enum: ['working', 'broken'], required: true },
  statusCode: { type: Number, default: null },
  errorMessage: { type: String, default: null },
  anchorText: { type: String, default: '' },
  
  // Source reference
  sourceModel: { type: String, required: true, enum: ['BlogPost', 'Page', 'Review', 'Promotion', 'Setting'] },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sourceTitle: { type: String, required: true },
  sourceFieldName: { type: String, required: true },
  
  checkedAt: { type: Date, default: Date.now }
});

// Add index on status for fast retrieval of broken links
linkCheckResultSchema.index({ status: 1 });

const LinkCheckResult = mongoose.model('LinkCheckResult', linkCheckResultSchema);

module.exports = LinkCheckResult;
