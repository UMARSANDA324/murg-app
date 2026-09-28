const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  store_name: {
    type: String,
    required: true,
  },
  branch_id: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
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
storeSchema.index({ branch_id: 1 });

module.exports = mongoose.model('Store', storeSchema);
