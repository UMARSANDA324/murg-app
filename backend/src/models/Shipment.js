const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  tracking_number: {
    type: String,
    required: true,
    unique: true,
  },
  source_branch: {
    type: String,
    required: true,
  },
  destination_branch: {
    type: String,
    required: true,
  },
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
    index: true,
  },
  dispatched_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  dispatched_at: {
    type: Date,
  },
  received_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  received_at: {
    type: Date,
  },
  notes: String,
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
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
shipmentSchema.index({ tracking_number: 1 }, { unique: true });
shipmentSchema.index({ source_branch: 1, destination_branch: 1 });
shipmentSchema.index({ status: 1 });

module.exports = mongoose.model('Shipment', shipmentSchema);
