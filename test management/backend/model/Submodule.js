const mongoose = require('mongoose');

const submoduleSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  summary: {
    pass: { type: Number, min: 0, default: 0 },
    fail: { type: Number, min: 0, default: 0 },
    blocked: { type: Number, min: 0, default: 0 },
    notRun: { type: Number, min: 0, default: 0 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

submoduleSchema.index({ project: 1, name: 1 }, { unique: true });

module.exports = mongoose.models.Submodule || mongoose.model('Submodule', submoduleSchema);