const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  item: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  type: String,
  date: {
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
expenseSchema.index({ facilityID: 1 });
expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
