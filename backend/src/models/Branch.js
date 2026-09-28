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
  },
  sales_mode: {
    type: String,
    enum: ['DEALER', 'PER_YARD'],
    default: 'DEALER',
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
// No additional indexes needed - facilityID is already unique in schema

module.exports = mongoose.model('Branch', branchSchema);
