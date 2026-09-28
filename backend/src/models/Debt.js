const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  facilityID: {
    type: String,
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
  last_payment: {
    type: Number,
    default: 0,
  },
  last_payment_date: {
    type: Date,
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
debtSchema.index({ customerID: 1 });
debtSchema.index({ facilityID: 1 });

module.exports = mongoose.model('Debt', debtSchema);
