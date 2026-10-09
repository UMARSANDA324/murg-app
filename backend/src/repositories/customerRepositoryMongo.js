const { Customer, Debt, Deposit, Order, CustomerCredit, CustomerCreditTransaction } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');
const crypto = require('crypto');

function customerDTO(customer, debt = null, totalDeposited = 0, credit = null) {
  const creditBal = Math.max(0, Number(credit?.balance) || 0);
  return {
    ...customer,
    id: customer._id.toString(),
    outstanding_balance: Math.max(0, Number(debt?.balance) || 0),
    total_deposited: Number(totalDeposited) || 0,
    credit_balance: creditBal,
    available_change: creditBal,
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
    const [debts, deposits, credits] = await Promise.all([
      Debt.find({ facilityID, customerID: { $in: customerIds } }).lean(),
      Deposit.aggregate([
        { $match: { facilityID, customerID: { $in: customerIds } } },
        { $group: { _id: '$customerID', total: { $sum: '$amount' } } },
      ]),
      CustomerCredit.find({ facilityID, customerID: { $in: customerIds } }).lean(),
    ]);
    const debtByCustomer = new Map(debts.map((debt) => [String(debt.customerID), debt]));
    const depositsByCustomer = new Map(deposits.map((deposit) => [String(deposit._id), deposit.total]));
    const creditsByCustomer = new Map(credits.map((credit) => [String(credit.customerID), credit]));
    return customers.map((customer) => customerDTO(
      customer,
      debtByCustomer.get(String(customer._id)),
      depositsByCustomer.get(String(customer._id)),
      creditsByCustomer.get(String(customer._id))
    ));
  }

  async findById(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const customer = await Customer.findOne({ _id: id, facilityID }).lean();
    if (!customer) return null;
    const [debt, deposits, credit] = await Promise.all([
      Debt.findOne({ customerID: customer._id, facilityID }).lean(),
      Deposit.aggregate([
        { $match: { customerID: customer._id, facilityID } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CustomerCredit.findOne({ customerID: customer._id, facilityID }).lean(),
    ]);
    return customerDTO(customer, debt, deposits[0]?.total || 0, credit);
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

  async recordDeposit({ facilityID, customerId, amount, paymentMethod, description = '', processedByName, staffID = null }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) throw new Error('Customer not found.');
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const customer = await Customer.findOne({ _id: customerId, facilityID }).session(session).lean();
        if (!customer) throw new Error('Customer not found in this branch.');
        const debt = await Debt.findOne({ customerID: customerId, facilityID }).session(session);
        const paymentDate = new Date();
        const previousBalance = Math.max(0, Number(debt?.balance) || 0);
        const newBalance = Math.max(0, previousBalance - amount);
        const appliedAmount = Math.min(previousBalance, amount);
        const overpayment = Math.max(0, amount - previousBalance);
        const [depositMysqlId] = await reserveLegacyIds(Deposit, 'depositId', 1, session);
        const receiptNumber = `DEP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        
        const [deposit] = await Deposit.create([{
          mysqlId: depositMysqlId,
          customerID: customerId,
          facilityID,
          amount,
          previous_balance: previousBalance,
          new_balance: newBalance,
          payment_date: paymentDate,
          receipt_number: receiptNumber,
          payment_method: paymentMethod,
          description,
          processed_by_name: processedByName,
        }], { session });

        if (debt) {
          debt.balance = newBalance;
          debt.last_payment = amount;
          debt.last_payment_date = paymentDate;
          debt.updatedAt = paymentDate;
          await debt.save({ session });
        } else {
          const [debtMysqlId] = await reserveLegacyIds(Debt, 'debtId', 1, session);
          await Debt.create([{
            mysqlId: debtMysqlId,
            customerID: customerId,
            facilityID,
            Customer: customer.name,
            amount: 0,
            balance: newBalance,
            last_payment: amount,
            last_payment_date: paymentDate,
            createdAt: paymentDate,
            updatedAt: paymentDate,
          }], { session });
        }

        // Handle Overpayment -> Customer Credit / Change
        let creditDoc = await CustomerCredit.findOne({ customerID: customerId, facilityID }).session(session);
        const previousCredit = creditDoc ? Math.max(0, Number(creditDoc.balance) || 0) : 0;
        let newCredit = previousCredit;

        if (overpayment > 0) {
          newCredit = previousCredit + overpayment;
          if (!creditDoc) {
            const [created] = await CustomerCredit.create([{
              customerID: customerId,
              facilityID,
              balance: newCredit,
              total_credited: overpayment,
              last_activity_date: paymentDate,
            }], { session });
            creditDoc = created;
          } else {
            creditDoc.balance = newCredit;
            creditDoc.total_credited = (Number(creditDoc.total_credited) || 0) + overpayment;
            creditDoc.last_activity_date = paymentDate;
            await creditDoc.save({ session });
          }

          await CustomerCreditTransaction.create([{
            creditID: creditDoc._id,
            customerID: customerId,
            facilityID,
            transaction_type: 'OVERPAYMENT_DEPOSIT',
            amount: overpayment,
            previous_balance: previousCredit,
            new_balance: newCredit,
            receipt_number: receiptNumber,
            reference_id: receiptNumber,
            payment_method: paymentMethod,
            processed_by_name: processedByName || 'Staff',
            staffID: staffID && mongoose.Types.ObjectId.isValid(staffID) ? staffID : null,
            notes: description ? `${description} (Overpayment credited to change)` : 'Overpayment on deposit credited to customer change',
            date: paymentDate,
          }], { session });
        }

        result = {
          depositId: deposit._id.toString(),
          receiptNumber,
          transaction_id: receiptNumber,
          receipt_number: receiptNumber,
          amount,
          previousBalance,
          previous_balance: previousBalance,
          newBalance,
          new_balance: newBalance,
          remainingBalance: newBalance,
          amountApplied: appliedAmount,
          debt_cleared: appliedAmount,
          overpayment,
          overpayment_credited: overpayment,
          credit_balance_before: previousCredit,
          credit_balance_after: newCredit,
          available_change: newCredit,
          customerName: customer.name,
          customer_name: customer.name,
          customerId: customerId.toString(),
          paymentMethod,
          payment_method: paymentMethod,
          paymentDate,
          deposit_date: paymentDate,
          processedByName: processedByName || 'Staff',
          facilityID,
          description,
        };
      });
      return result;
    } finally { await session.endSession(); }
  }

  async collectChange({ facilityID, customerId, amount, paymentMethod = 'Cash', notes = '', processedByName = 'Staff', staffID = null }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) throw new Error('Customer not found.');
    const collectAmt = parseFloat(amount);
    if (isNaN(collectAmt) || collectAmt <= 0) {
      throw new Error('Collection amount must be greater than zero.');
    }

    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const customer = await Customer.findOne({ _id: customerId, facilityID }).session(session).lean();
        if (!customer) throw new Error('Customer not found in this branch.');

        const creditDoc = await CustomerCredit.findOne({ customerID: customerId, facilityID }).session(session);
        const availableCredit = creditDoc ? Math.max(0, Number(creditDoc.balance) || 0) : 0;

        if (collectAmt > availableCredit) {
          throw new Error(`Insufficient customer credit. Available: ₦${availableCredit.toLocaleString()}, Requested: ₦${collectAmt.toLocaleString()}.`);
        }

        const previousCredit = availableCredit;
        const newCredit = previousCredit - collectAmt;

        creditDoc.balance = newCredit;
        creditDoc.total_collected = (Number(creditDoc.total_collected) || 0) + collectAmt;
        creditDoc.last_activity_date = new Date();
        await creditDoc.save({ session });

        const receiptNumber = `CHG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const [tx] = await CustomerCreditTransaction.create([{
          creditID: creditDoc._id,
          customerID: customerId,
          facilityID,
          transaction_type: 'CASH_COLLECTED',
          amount: collectAmt,
          previous_balance: previousCredit,
          new_balance: newCredit,
          receipt_number: receiptNumber,
          reference_id: receiptNumber,
          payment_method: paymentMethod || 'Cash',
          processed_by_name: processedByName || 'Staff',
          staffID: staffID && mongoose.Types.ObjectId.isValid(staffID) ? staffID : null,
          notes: notes ? notes.trim() : 'Customer collected change in cash',
          date: new Date(),
        }], { session });

        result = {
          transactionId: tx._id.toString(),
          receipt_number: receiptNumber,
          receiptNumber,
          customerId: customerId.toString(),
          customer_name: customer.name,
          customerName: customer.name,
          customer_phone: customer.phone || '',
          facilityID,
          amount_collected: collectAmt,
          amount: collectAmt,
          previous_change: previousCredit,
          previousCredit,
          remaining_change: newCredit,
          newCredit,
          payment_method: paymentMethod || 'Cash',
          notes: notes ? notes.trim() : '',
          processed_by_name: processedByName || 'Staff',
          processedByName: processedByName || 'Staff',
          date: tx.date,
        };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async getCustomerCredit(customerId, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return null;
    const credit = await CustomerCredit.findOne({ customerID: customerId, facilityID }).lean();
    return {
      balance: Math.max(0, Number(credit?.balance) || 0),
      total_credited: Number(credit?.total_credited) || 0,
      total_collected: Number(credit?.total_collected) || 0,
      total_used_goods: Number(credit?.total_used_goods) || 0,
      last_activity_date: credit?.last_activity_date || null,
    };
  }

  async getCreditHistory({ facilityID, customerId, limit = 50 }) {
    if (!mongoose.Types.ObjectId.isValid(customerId)) return [];
    const transactions = await CustomerCreditTransaction.find({ customerID: customerId, facilityID })
      .sort({ date: -1, createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .lean();

    return transactions.map((tx) => ({
      id: tx._id.toString(),
      transaction_type: tx.transaction_type,
      amount: Number(tx.amount) || 0,
      previous_balance: Number(tx.previous_balance) || 0,
      new_balance: Number(tx.new_balance) || 0,
      receipt_number: tx.receipt_number || tx.reference_id || `TX-${tx._id.toString().slice(-6)}`,
      reference_id: tx.reference_id || '',
      payment_method: tx.payment_method || 'Cash',
      processed_by_name: tx.processed_by_name || 'Staff',
      notes: tx.notes || '',
      date: tx.date || tx.createdAt,
    }));
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
      .sort({ payment_date: -1, createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200))
      .lean();
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
        previous_balance: deposit.previous_balance !== undefined && deposit.previous_balance !== null ? Number(deposit.previous_balance) : null,
        new_balance: deposit.new_balance !== undefined && deposit.new_balance !== null ? Number(deposit.new_balance) : null,
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
