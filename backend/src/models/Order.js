const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    required: true,
  },
  orderID: {
    type: String,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  stockID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
  },
  item: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  subtotal: {
    type: Number,
    required: true,
  },
  net_total: {
    type: Number,
    required: true,
  },
  buyer_name: String,
  customer_name: String,
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  payment: {
    type: String,
    enum: ['cash', 'credit', 'transfer'],
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  amount_paid: {
    type: Number,
    default: 0,
  },
  cash: {
    type: Number,
    default: 0,
  },
  pos: {
    type: Number,
    default: 0,
  },
  transfer: {
    type: Number,
    default: 0,
  },
  bank_name: String,
  staff: String,
  status: {
    type: String,
    default: 'completed',
  },
  creation: {
    type: Date,
    required: true,
    index: true,
  },
});

// Indexes
orderSchema.index({ orderID: 1, facilityID: 1 }, { unique: true });
orderSchema.index({ facilityID: 1, creation: -1 });
orderSchema.index({ customerID: 1 });
orderSchema.index({ creation: -1 });

module.exports = mongoose.model('Order', orderSchema);
