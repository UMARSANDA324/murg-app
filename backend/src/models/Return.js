const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  mysqlId: { type: Number, unique: true, required: true },
  return_code: { type: String, required: true, unique: true },
  orderID: { type: String, required: true },
  facilityID: { type: String, required: true },
  customerID: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customer_name: String,
  reason: String,
  processed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  processed_by_name: { type: String, required: true },
  returned_amount: { type: Number, required: true, default: 0 },
  debt_reversed: { type: Number, required: true, default: 0 },
  items: [{
    original_order_line_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    stock_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock', required: true },
    item: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    amount: { type: Number, required: true },
    stock_movement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' },
  }],
  createdAt: { type: Date, default: Date.now },
});

returnSchema.index({ orderID: 1, facilityID: 1 });
returnSchema.index({ facilityID: 1, createdAt: -1 });

module.exports = mongoose.model('Return', returnSchema);