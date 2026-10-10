const mongoose = require('mongoose');

const testExecutionSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  submodule: { type: mongoose.Schema.Types.ObjectId, ref: 'Submodule', required: true, index: true },
  testCase: { type: mongoose.Schema.Types.ObjectId, ref: 'TestCase', required: true, index: true },
  result: { type: String, enum: ['Pass', 'Fail', 'Blocked'], required: true },
  actualResult: { type: String, default: '' },
  comments: { type: String, default: '' },
  tester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  executedAt: { type: Date, default: Date.now, index: true },
  durationSeconds: { type: Number, min: 0, default: null },
}, { timestamps: true });

module.exports = mongoose.models.TestExecution || mongoose.model('TestExecution', testExecutionSchema);