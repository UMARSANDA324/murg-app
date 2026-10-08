const mongoose = require('mongoose');

const customerCreditTransactionSchema = new mongoose.Schema({
  creditID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CustomerCredit',
  },
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
  transaction_type: {
    type: String,
    enum: ['OVERPAYMENT_DEPOSIT', 'USED_FOR_PURCHASE', 'CASH_COLLECTED'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  previous_balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  new_balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  receipt_number: {
    type: String,
    index: true,
  },
  reference_id: {
    type: String,
  },
  payment_method: {
    type: String,
    default: 'Cash',
  },
  processed_by_name: {
    type: String,
    default: 'Staff',
  },
  staffID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
    default: '',
  },
  date: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
  collection: 'customercredittransactions',
});

customerCreditTransactionSchema.index({ customerID: 1, facilityID: 1, date: -1 });

module.exports = mongoose.model('CustomerCreditTransaction', customerCreditTransactionSchema);
