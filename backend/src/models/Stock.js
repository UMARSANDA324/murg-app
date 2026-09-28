const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    index: true,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  buying: {
    type: Number,
    default: 0,
  },
  selling: {
    type: Number,
    default: 0,
  },
  unit_type: {
    type: String,
    enum: ['belt', 'yard'],
    default: 'belt',
  },
  price_per_yard: {
    type: Number,
    default: null,
  },
  yards_per_belt: {
    type: Number,
    default: 100,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  out_stocks: {
    type: Number,
    default: 0,
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
stockSchema.index({ facilityID: 1, name: 1 });
stockSchema.index({ facilityID: 1, store_id: 1 });
stockSchema.index({ store_id: 1 });
stockSchema.index({ name: 'text' });

module.exports = mongoose.model('Stock', stockSchema);
