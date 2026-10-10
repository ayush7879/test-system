const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  description: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },
}, { timestamps: true });

projectSchema.index({ owner: 1, code: 1 }, { unique: true });

module.exports = mongoose.models.Project || mongoose.model('Project', projectSchema);