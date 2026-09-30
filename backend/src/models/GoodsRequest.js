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
  },
  legacy_staff_id: Number,
  staff_name: {
    type: String,
    required: true,
  },
  requesting_branch: {
    type: String,
    required: true,
  },
  stock_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
  },
  product_source: {
    type: String,
    enum: ['CATALOG', 'CUSTOM'],
    default: 'CATALOG',
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
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SHIPPING_CREATED', 'IN_TRANSIT', 'RECEIVED', 'RELEASED', 'CANCELLED'],
    default: 'PENDING',
  },
  admin_notes: String,
  source_branch: String,
  source_stock_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
  },
  receipt_code: String,
  collection_code: String,
  rejection_reason: String,
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approved_by_name: String,
  approved_at: Date,
  released_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  released_by_name: String,
  released_at: Date,
  shipment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment',
  },
  legacy_shipment_id: Number,
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
goodsRequestSchema.index({ requesting_branch: 1, createdAt: -1 });
goodsRequestSchema.index({ source_branch: 1, status: 1 });
goodsRequestSchema.index({ collection_code: 1 });
goodsRequestSchema.index({ receipt_code: 1 });

module.exports = mongoose.model('GoodsRequest', goodsRequestSchema);
