/**
 * Mongoose Models Export
 * Centralized export for all MongoDB models
 */

const User = require('./User');
const Branch = require('./Branch');
const Store = require('./Store');
const Stock = require('./Stock');
const Customer = require('./Customer');
const Order = require('./Order');
const Debt = require('./Debt');
const Deposit = require('./Deposit');
const StockMovement = require('./StockMovement');
const Shipment = require('./Shipment');
const Purchase = require('./Purchase');
const Expense = require('./Expense');
const GoodsRequest = require('./GoodsRequest');
const Notification = require('./Notification');
const PasswordReset = require('./PasswordReset');
const ShipmentReceipt = require('./ShipmentReceipt');
const AuditLog = require('./AuditLog');
const Counter = require('./Counter');

module.exports = {
  User,
  Branch,
  Store,
  Stock,
  Customer,
  Order,
  Debt,
  Deposit,
  StockMovement,
  Shipment,
  Purchase,
  Expense,
  GoodsRequest,
  Notification,
  PasswordReset,
  ShipmentReceipt,
  AuditLog,
  Counter,
};
