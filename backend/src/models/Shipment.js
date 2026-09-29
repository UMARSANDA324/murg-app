const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  tracking_number: String,
  source_branch: String,
  destination_branch: String,
  source_store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
  },
  destination_store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
  },
  status: {
    type: String,
    enum: ['Draft', 'Pending', 'In Transit', 'Received', 'Cancelled'],
    default: 'Draft',
  },
  dispatched_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  legacy_dispatched_by: Number,
  dispatched_at: {
    type: Date,
  },
  received_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  legacy_received_by: Number,
  received_at: {
    type: Date,
  },
  notes: String,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  legacy_created_by: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  items: [{
    stock_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stock',
      required: true,
    },
    product_name: {
      type: String,
      required: true,
    },
    quantity_sent: {
      type: Number,
      required: true,
    },
    quantity_received: {
      type: Number,
      default: 0,
    },
  }],
});

// Indexes
shipmentSchema.index({ source_branch: 1, destination_branch: 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
