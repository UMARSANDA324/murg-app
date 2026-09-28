const mongoose = require('mongoose');

const shipmentReceiptSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  receipt_code: {
    type: String,
    required: true,
    unique: true,
  },
  shipment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment',
    required: true,
  },
  request_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GoodsRequest',
  },
  source_branch: {
    type: String,
    required: true,
  },
  destination_branch: {
    type: String,
    required: true,
  },
  product_name: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  unit_type: {
    type: String,
    default: 'belt',
  },
  dispatched_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dispatched_by_name: {
    type: String,
    required: true,
  },
  consumed: {
    type: Boolean,
    default: false,
  },
  consumed_at: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
shipmentReceiptSchema.index({ receipt_code: 1 }, { unique: true });

module.exports = mongoose.model('ShipmentReceipt', shipmentReceiptSchema);
