const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: String,
  item: String,
  price: Number,
  type: String,
  date: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
expenseSchema.index({ facilityID: 1 });
expenseSchema.index({ date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
