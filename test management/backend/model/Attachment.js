const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  submodule: { type: mongoose.Schema.Types.ObjectId, ref: 'Submodule', default: null },
  testCase: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCase', default: null },
  execution: { type: mongoose.Schema.Types.ObjectId, ref: 'TestExecution', default: null },
  originalName: { type: String, required: true, trim: true },
  storageKey: { type: String, required: true, trim: true },
  mimeType: { type: String, default: 'application/octet-stream' },
  sizeBytes: { type: Number, min: 0, default: 0 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);