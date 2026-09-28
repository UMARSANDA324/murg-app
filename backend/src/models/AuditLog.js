const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: String,
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  user_name: {
    type: String,
    required: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  entity_type: {
    type: String,
    required: true,
  },
  entity_id: {
    type: String,
    required: true,
  },
  old_values: mongoose.Schema.Types.Mixed,
  new_values: mongoose.Schema.Types.Mixed,
  ip_address: String,
  user_agent: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ user_id: 1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
