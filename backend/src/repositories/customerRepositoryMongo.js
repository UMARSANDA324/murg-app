const { Customer, Debt, Deposit, Order } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');
const crypto = require('crypto');

function customerDTO(customer, debt = null, totalDeposited = 0) {
  return {
    ...customer,
    id: customer._id.toString(),
    outstanding_balance: Math.max(0, Number(debt?.balance) || 0),
    total_deposited: Number(totalDeposited) || 0,
  };
}

/**
 * CustomerRepositoryMongo — MongoDB-based customer operations.
 */
class CustomerRepositoryMongo {
  async findAll({ facilityID, search = null } = {}) {
    const query = { facilityID };
    if (search?.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ name: { $regex: term, $options: 'i' } }, { phone: { $regex: term, $options: 'i' } }];
    }
    const customers = await Customer.find(query).sort({ createdAt: -1 }).lean();
    const customerIds = customers.map((customer) => customer._id);
    const [debts, deposits] = await Promise.all([
      Debt.find({ facilityID, customerID: { $in: customerIds } }).lean(),
      Deposit.aggregate([
        { $match: { facilityID, customerID: { $in: customerIds } } },
        { $group: { _id: '$customerID', total: { $sum: '$amount' } } },
      ]),
    ]);
    const debtByCustomer = new Map(debts.map((debt) => [String(debt.customerID), debt]));
    const depositsByCustomer = new Map(deposits.map((deposit) => [String(deposit._id), deposit.total]));
    return customers.map((customer) => customerDTO(
      customer,
      debtByCustomer.get(String(customer._id)),
      depositsByCustomer.get(String(customer._id))
    ));
  }

  async findById(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const customer = await Customer.findOne({ _id: id, facilityID }).lean();
    if (!customer) return null;
    const [debt, deposits] = await Promise.all([
      Debt.findOne({ customerID: customer._id, facilityID }).lean(),
      Deposit.aggregate([
        { $match: { customerID: customer._id, facilityID } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);
    return customerDTO(customer, debt, deposits[0]?.total || 0);
  }

  async create({ name, phone, email, gender, facilityID, address }) {
    const session = await mongoose.startSession();
    let id;
    try {
      await session.withTransaction(async () => {
        const [mysqlId] = await reserveLegacyIds(Customer, 'customerId', 1, session);
        const [customer] = await Customer.create([{
          name, phone, email, gender, facilityID, address, mysqlId,
        }], { session });
        id = customer._id.toString();
      });
      return id;
    } finally { await session.endSession(); }
  }

  async update(id, facilityID, { name, phone, address }) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Customer.updateOne(
      { _id: id, facilityID },
      { name, phone, address }
    );
    return result.matchedCount > 0;
  }

  async recordDeposit({ facilityID, customerId, amount, paymentMethod, description = '', processedByName }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) throw new Error('Customer not found.');
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const customer = await Customer.findOne({ _id: customerId, facilityID }).session(session).lean();
        if (!customer) throw new Error('Customer not found in this branch.');
        const debt = await Debt.findOne({ customerID: customerId, facilityID }).session(session);
        const paymentDate = new Date();
        const appliedAmount = Math.min(Number(debt?.balance) || 0, amount);
        const [depositMysqlId] = await reserveLegacyIds(Deposit, 'depositId', 1, session);
        const receiptNumber = `DEP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const [deposit] = await Deposit.create([{
          mysqlId: depositMysqlId, customerID: customerId, facilityID, amount,
          payment_date: paymentDate, receipt_number: receiptNumber,
          payment_method: paymentMethod, description, processed_by_name: processedByName,
        }], { session });
        if (debt && appliedAmount > 0) {
          debt.balance = Math.max(0, Number(debt.balance) - appliedAmount);
          debt.last_payment = amount;
          debt.last_payment_date = paymentDate;
          debt.updatedAt = paymentDate;
          await debt.save({ session });
        }
        result = {
          depositId: deposit._id.toString(), receiptNumber, amount,
          amountApplied: appliedAmount, remainingBalance: Math.max(0, Number(debt?.balance) || 0),
        };
      });
      return result;
    } finally { await session.endSession(); }
  }

  async getDeposits(customerID, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(customerID)) return [];
    const deposits = await Deposit.find({ customerID, facilityID })
      .sort({ payment_date: -1 })
      .lean();
    return deposits.map((deposit) => ({ ...deposit, id: deposit._id.toString() }));
  }

  async getDepositHistory({ facilityID, customerId, limit = 50 }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return [];
    const deposits = await Deposit.find({ customerID: customerId, facilityID })
      .sort({ payment_date: -1 }).limit(Math.min(Number(limit) || 50, 200)).lean();
    return deposits.map((deposit) => {
      const receiptNo = deposit.receipt_number || (deposit.mysqlId ? `DEP-${deposit.mysqlId}` : null);
      const paymentDate = deposit.payment_date || deposit.createdAt || null;
      return {
        ...deposit,
        id: deposit._id.toString(),
        receipt_number: receiptNo,
        transaction_id: receiptNo || deposit._id.toString().slice(-8),
        deposit_date: paymentDate,
        payment_date: paymentDate,
        payment_method: deposit.payment_method || 'Cash',
        amount: Number(deposit.amount) || 0,
        description: deposit.description || '',
        processed_by_name: deposit.processed_by_name || 'Staff',
      };
    });
  }

  async getDebtHistory({ facilityID, customerId, limit = 100 }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return [];
    const orders = await Order.find({
      customerID: new mongoose.Types.ObjectId(customerId),
      facilityID,
      $or: [
        { payment: { $regex: /^credit$/i } },
        { status: { $in: [0, '0'] } },
      ],
    })
      .sort({ creation: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();

    return orders.map((order) => {
      const qty = Number(order.quantity) || 0;
      const subtotal = Number(order.subtotal) || 0;
      const netTotal = Number(order.net_total) || subtotal;
      const price = Number(order.price) || (qty > 0 ? (subtotal / qty) : 0);
      return {
        id: order._id.toString(),
        order_id: order.orderID,
        item: order.productName || order.item || 'Historical item details unavailable',
        quantity: qty,
        price,
        subtotal,
        net_total: netTotal,
        discount: Number(order.discount) || 0,
        amount_paid: Number(order.amount_paid) || 0,
        staff: order.staff || 'N/A',
        date: order.creation || null,
        payment: order.payment || 'Credit',
      };
    });
  }

  async getDebt(customerID, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(customerID)) return null;
    return await Debt.findOne({ customerID, facilityID }).lean();
  }
}

module.exports = new CustomerRepositoryMongo();
