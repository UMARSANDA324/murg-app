const mongoose = require('mongoose');

const goodsRequestSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  request_code: {
    type: String,
    required: true,
    unique: true,
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  staff_name: {
    type: String,
    required: true,
  },
  requesting_branch: {
    type: String,
    required: true,
    index: true,
  },
  stock_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
  },
  product_name: {
    type: String,
    required: true,
  },
  requested_quantity: {
    type: Number,
    required: true,
  },
  unit_type: {
    type: String,
    default: 'belt',
  },
  reason: String,
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SHIPPING_CREATED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  admin_notes: String,
  source_branch: String,
  shipment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment',
  },
  reviewed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewed_at: {
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
goodsRequestSchema.index({ request_code: 1 }, { unique: true });
goodsRequestSchema.index({ staff_id: 1 });
goodsRequestSchema.index({ requesting_branch: 1 });
goodsRequestSchema.index({ status: 1 });

module.exports = mongoose.model('GoodsRequest', goodsRequestSchema);
