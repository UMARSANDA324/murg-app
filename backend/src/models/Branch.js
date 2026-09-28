const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
  },
  address: String,
  phone: String,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
  sales_mode: {
    type: String,
    enum: ['DEALER', 'PER_YARD'],
    default: 'DEALER',
    index: true,
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
branchSchema.index({ facilityID: 1 }, { unique: true });
branchSchema.index({ sales_mode: 1 });
branchSchema.index({ status: 1 });

module.exports = mongoose.model('Branch', branchSchema);
