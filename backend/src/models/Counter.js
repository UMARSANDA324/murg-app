const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  // Preserve MySQL ID for backward compatibility
  mysqlId: {
    type: Number,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
    unique: true,
  },
  lastID: {
    type: Number,
    required: true,
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
counterSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Counter', counterSchema);
