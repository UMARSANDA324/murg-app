const mongoose = require('mongoose');

const passwordResetSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    index: true,
  },
  otp_hash: {
    type: String,
    required: true,
  },
  reset_token: {
    type: String,
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  max_attempts: {
    type: Number,
    default: 5,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  is_used: {
    type: Boolean,
    default: false,
  },
  expires_at: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
passwordResetSchema.index({ email: 1 });
passwordResetSchema.index({ user_id: 1 });
passwordResetSchema.index({ reset_token: 1 });
passwordResetSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-cleanup

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
