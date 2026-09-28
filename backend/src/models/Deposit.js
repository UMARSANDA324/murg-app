const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  payment_date: {
    type: Date,
    required: true,
  },
  receipt_number: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
depositSchema.index({ customerID: 1 });
depositSchema.index({ facilityID: 1 });
depositSchema.index({ payment_date: -1 });

module.exports = mongoose.model('Deposit', depositSchema);
