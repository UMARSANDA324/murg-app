const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  role_target: String,
  facility_id: String,
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'GOODS_REQUEST',
  },
  reference_id: String,
  is_read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
notificationSchema.index({ user_id: 1 });
notificationSchema.index({ role_target: 1 });
notificationSchema.index({ facility_id: 1 });
notificationSchema.index({ is_read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
