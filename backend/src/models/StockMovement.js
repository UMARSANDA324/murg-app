const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
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
  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
  },
  stock_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stock',
    required: true,
  },
  movement_type: String,
  quantity_change: Number,
  quantity_before: Number,
  quantity_after: Number,
  quantity_change: {
    type: Number,
    required: true,
  },
  quantity_before: {
    type: Number,
    required: true,
  },
  quantity_after: {
    type: Number,
    required: true,
  },
  reference_type: {
    type: String,
    required: true,
  },
  reference_id: {
    type: String,
    required: true,
  },
  notes: String,
  performed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Indexes
stockMovementSchema.index({ stock_id: 1, facilityID: 1 });
stockMovementSchema.index({ movement_type: 1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ reference_type: 1, reference_id: 1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
