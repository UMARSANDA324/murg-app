const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    index: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  address: String,
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
customerSchema.index({ facilityID: 1 });
customerSchema.index({ phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
