const mongoose = require('mongoose');

const customerCreditSchema = new mongoose.Schema({
  customerID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true,
  },
  facilityID: {
    type: String,
    required: true,
    index: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  total_credited: {
    type: Number,
    default: 0,
    min: 0,
  },
  total_collected: {
    type: Number,
    default: 0,
    min: 0,
  },
  total_used_goods: {
    type: Number,
    default: 0,
    min: 0,
  },
  last_activity_date: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'customercredits',
});

customerCreditSchema.index({ customerID: 1, facilityID: 1 }, { unique: true });

module.exports = mongoose.model('CustomerCredit', customerCreditSchema);
