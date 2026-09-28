const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
  },
  stock_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
  },
  initial_quantity: {
    type: Number,
    default: 0,
  },
  purchaser: String,
  purchase_from: String,
  stock_name: String,
  quantity: {
    type: Number,
    required: true,
  },
  cost_price: {
    type: Number,
    default: 0,
  },
  total_cost: {
    type: Number,
    default: 0,
  },
  amount_paid: {
    type: Number,
    default: 0,
  },
  balance: {
    type: Number,
    default: 0,
  },
  for_desc: String,
  purchase_date: {
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
purchaseSchema.index({ facilityID: 1 });
purchaseSchema.index({ purchase_date: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
