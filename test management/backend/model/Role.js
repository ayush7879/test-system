const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  permissions: { type: [String], default: [] },
  isSystemRole: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);