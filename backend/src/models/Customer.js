const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: Number,
  name: {
    type: String,
    required: true,
  },
  phone: String,
  facilityID: {
    type: String,
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
