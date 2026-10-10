const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  submodule: { type: mongoose.Schema.Types.ObjectId, ref: 'Submodule', required: true, index: true },
  caseId: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  steps: { type: String, default: '' },
  expectedResult: { type: String, default: '' },
  testData: { type: mongoose.Schema.Types.Mixed, default: null },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  status: { type: String, enum: ['Not run', 'Pass', 'Fail', 'Blocked'], default: 'Not run' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

testCaseSchema.index({ submodule: 1, caseId: 1 }, { unique: true });

module.exports = mongoose.models.TestCase || mongoose.model('TestCase', testCaseSchema);