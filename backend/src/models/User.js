const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
  },
  name: String,
  fname: String,
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: String,
  role: {
    type: String,
    enum: ['Admin', 'Staff'],
    required: true,
  },
  status: {
    type: Number,
    default: 1, // 1 = active
  },
  password: String, // Legacy MD5 (for migration compatibility)
  password_hash: String, // bcrypt
  permissions: {
    type: [String],
    default: ['*'], // Admin default
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
