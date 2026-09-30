const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    required: true,
  },
  orderID: String,
  facilityID: String,
  stockID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
  },
  item: String,
  quantity: Number,
  subtotal: Number,
  price: Number,
  item_discount: Number,
  net_total: Number,
  buyer_name: String,
  customer_name: String,
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  },
  payment: String,
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
  status: String,
  creation: Date,
});

// Indexes
orderSchema.index({ orderID: 1, facilityID: 1 }); // Not unique - multiple line items per order
orderSchema.index({ facilityID: 1, creation: -1 });
orderSchema.index({ customerID: 1 });
orderSchema.index({ creation: -1 });

module.exports = mongoose.model('Order', orderSchema);
