const { Order, Stock, Branch, Customer, Debt, StockMovement, Store, CustomerCredit, CustomerCreditTransaction } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');

/**
 * SalesRepositoryMongo — MongoDB-based atomic POS checkout operations.
 * Preserves all business logic from MySQL version including transactions.
 */
class SalesRepositoryMongo {
  /**
   * Get branch sales with optional date filters.
   * Scoped by facilityID at query level.
   */
  async findByBranch({ facilityID, startDate, endDate, limit = 50, offset = 0 } = {}) {
    const matchQuery = { facilityID };
    if (startDate) matchQuery.creation = { ...matchQuery.creation, $gte: new Date(startDate) };
    if (endDate) matchQuery.creation = { ...matchQuery.creation, $lte: new Date(endDate) };

    const sales = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$orderID',
          orderID: { $first: '$orderID' },
          facilityID: { $first: '$facilityID' },
          staff: { $first: '$staff' },
          buyer_name: { $first: '$buyer_name' },
          customer_name: { $first: '$customer_name' },
          customerID: { $first: '$customerID' },
          payment: { $first: '$payment' },
          discount: { $first: '$discount' },
          amount_paid: { $first: '$amount_paid' },
          net_total: { $first: '$net_total' },
          cash: { $first: '$cash' },
          pos: { $first: '$pos' },
          transfer: { $first: '$transfer' },
          bank_name: { $first: '$bank_name' },
          status: { $first: '$status' },
          creation: { $first: '$creation' },
          item_count: { $sum: 1 },
          gross_total: { $sum: '$subtotal' },
        },
      },
      { $sort: { creation: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);

    return sales;
  }

  /**
   * Get all line items for a specific order.
   */
  async findOrderItems(orderID, facilityID) {
    const items = await Order.find({ orderID, facilityID })
      .populate('stockID')
      .populate({
        path: 'stockID',
        populate: { path: 'store_id', select: 'store_name' },
      })
      .lean();

    return items.map(item => ({
      ...item,
      store_name: item.stockID?.store_id?.store_name || null,
      unit_type: item.stockID?.unit_type || null,
    }));
  }

  /**
   * Get receipt data (order + branch details) for printing.
   * Enhanced to support historical receipt reconstruction from stock movements.
   */
  async getReceiptData(orderID, facilityID = null) {
    const query = { orderID };
    if (facilityID) query.facilityID = facilityID;

    const items = await Order.find(query)
      .populate('stockID')
      .populate({
        path: 'stockID',
        populate: { path: 'store_id', select: 'store_name' },
      })
      .populate('customerID', 'phone')
      .sort({ _id: 1 })
      .lean();

    if (!items.length) return null;

    const branch = await Branch.findOne({ facilityID: items[0].facilityID }).lean();

    const creditTx = await CustomerCreditTransaction.findOne({
      $or: [{ reference_id: orderID }, { receipt_number: orderID }],
    }).lean();

    const creditApplied = creditTx
      ? Number(creditTx.amount) || 0
      : parseFloat(items[0].credit_applied) || 0;
    const customerCreditBefore = creditTx
      ? Number(creditTx.previous_balance) || 0
      : parseFloat(items[0].customer_credit_before) || 0;
    const customerCreditAfter = creditTx
      ? Number(creditTx.new_balance) || 0
      : parseFloat(items[0].customer_credit_after) || 0;

    const netTotal = parseFloat(items[0].net_total) || items.reduce((acc, i) => acc + parseFloat(i.subtotal), 0);
    const amountPaid = parseFloat(items[0].amount_paid) || 0;
    const totalEffectivePaid = amountPaid + creditApplied;
    const isCredit = items[0].payment === 'credit' || items[0].status === 0 || (netTotal > totalEffectivePaid && items[0].customerID);
    const newCredit = isCredit ? Math.max(0, netTotal - totalEffectivePaid) : 0;

    let outstandingBefore = 0;
    let outstandingAfter = 0;

    if (items[0].customerID) {
      const debt = await Debt.findOne({ customerID: items[0].customerID, facilityID: items[0].facilityID }).lean();
      const currentBalance = debt ? Math.max(0, Number(debt.balance) || 0) : 0;
      outstandingAfter = currentBalance;
      outstandingBefore = Math.max(0, outstandingAfter - newCredit);
    }

    return {
      branch: branch || { facilityID: items[0].facilityID, name: items[0].facilityID, address: '', phone: '' },
      order: {
        orderID: items[0].orderID,
        facilityID: items[0].facilityID,
        payment: items[0].payment,
        is_credit: isCredit,
        status: items[0].status,
        buyer_name: items[0].buyer_name || items[0].customer_name || 'Retail Customer',
        customer_name: items[0].customer_name || null,
        customer_phone: items[0].customerID?.phone || null,
        staff: items[0].staff,
        creation: items[0].creation,
        net_total: netTotal,
        amount_paid: amountPaid,
        credit_applied: creditApplied,
        customer_credit_applied: creditApplied,
        customer_credit_before: customerCreditBefore,
        customer_credit_after: customerCreditAfter,
        debt_amount: newCredit,
        new_credit: newCredit,
        outstanding_before: outstandingBefore,
        outstanding_after: outstandingAfter,
        change_given: parseFloat(items[0].change_given) || 0,
        discount: parseFloat(items[0].discount) || 0,
        cash: parseFloat(items[0].cash) || 0,
        pos: parseFloat(items[0].pos) || 0,
        transfer: parseFloat(items[0].transfer) || 0,
        bank_name: items[0].bank_name,
        store_name: items[0].stockID?.store_id?.store_name || 'N/A',
      },
      items: items.map(i => ({
        item: i.item,
        price: parseFloat(i.price),
        quantity: parseFloat(i.quantity),
        item_discount: parseFloat(i.item_discount) || 0,
        subtotal: parseFloat(i.subtotal),
      })),
    };
  }

  /**
   * Get sales/debt sales for a specific date range with grouping capability.
   */
  async getSalesByDateRange({ facilityID, startDate, endDate, limit = 100, offset = 0 } = {}) {
    const matchQuery = { facilityID };
    if (startDate) matchQuery.creation = { ...matchQuery.creation, $gte: new Date(startDate) };
    if (endDate) matchQuery.creation = { ...matchQuery.creation, $lte: new Date(endDate) };

    const sales = await Order.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$orderID',
          orderID: { $first: '$orderID' },
          facilityID: { $first: '$facilityID' },
          staff: { $first: '$staff' },
          buyer_name: { $first: '$buyer_name' },
          customer_name: { $first: '$customer_name' },
          customerID: { $first: '$customerID' },
          payment: { $first: '$payment' },
          discount: { $first: '$discount' },
          amount_paid: { $first: '$amount_paid' },
          net_total: { $first: '$net_total' },
          cash: { $first: '$cash' },
          pos: { $first: '$pos' },
          transfer: { $first: '$transfer' },
          bank_name: { $first: '$bank_name' },
          status: { $first: '$status' },
          creation: { $first: '$creation' },
          item_count: { $sum: 1 },
          gross_total: { $sum: '$subtotal' },
        },
      },
      { $sort: { creation: -1 } },
      { $skip: offset },
      { $limit: limit },
    ]);

    return sales;
  }

  /**
   * Execute atomic checkout.
   * Returns the generated orderID on success.
   */
  async atomicCheckout({
    facilityID, staffID, staffName, items,
    buyerName, customerName, customerID,
    globalDiscount = 0,
    payment = { cash: 0, pos: 0, transfer: 0, bankName: null },
    isCredit = false,
    creditUsed = 0,
  }) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Check branch sales_mode
      const branch = await Branch.findOne({ facilityID }).session(session).lean();
      if (!branch) throw new Error('Branch not found.');
      const isPerYardBranch = branch?.sales_mode === 'PER_YARD';

      if (customerID) {
        if (!mongoose.Types.ObjectId.isValid(customerID) || !await Customer.exists({ _id: customerID, facilityID }).session(session)) {
          throw new Error('Customer not found in this branch.');
        }
      }

      // Phase 1: Lock stock rows, validate stock levels, and enforce authoritative prices
      const validatedItems = [];
      let grossTotal = 0;
      let totalItemDiscounts = 0;

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity ${item.quantity} for product ID ${item.stockId}. Quantity must be greater than zero.`);
        }

        const stock = await Stock.findOne({ _id: item.stockId, facilityID })
          .session(session)
          .lean();

        if (!stock) {
          throw new Error(`Product ID ${item.stockId} not found in this branch.`);
        }

        const available = parseFloat(stock.quantity) || 0;
        if (qty > available) {
          throw new Error(`Insufficient stock for "${stock.name}". Available: ${available}, Requested: ${qty}.`);
        }

        // Authoritative server-side price determination
        let authoritativePrice;
        if (isPerYardBranch || stock.unit_type === 'yard') {
          authoritativePrice = stock.price_per_yard !== null && stock.price_per_yard !== undefined
            ? parseFloat(stock.price_per_yard)
            : parseFloat(stock.selling);
        } else {
          authoritativePrice = parseFloat(stock.selling);
        }

        if (isNaN(authoritativePrice) || authoritativePrice <= 0) {
          authoritativePrice = parseFloat(item.price) || 0;
        }

        const itemDiscount = parseFloat(item.itemDiscount) || 0;
        const itemSubtotal = authoritativePrice * qty;

        grossTotal += itemSubtotal;
        totalItemDiscounts += itemDiscount * qty;

        validatedItems.push({
          stockId: stock._id,
          name: stock.name,
          storeId: stock.store_id,
          unitType: stock.unit_type,
          price: authoritativePrice,
          quantity: qty,
          itemDiscount,
          subtotal: itemSubtotal,
          available,
        });
      }

      const orderID = `${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
      const orderMysqlIds = await reserveLegacyIds(Order, 'orderId', validatedItems.length, session);
      const movementMysqlIds = await reserveLegacyIds(StockMovement, 'stockMovementId', validatedItems.length, session);
      const netTotal = Math.max(0, grossTotal - globalDiscount - totalItemDiscounts);

      // Phase 1.5: Handle Customer Credit / Change application
      let appliedCredit = 0;
      let prevCustomerCredit = 0;
      let newCustomerCredit = 0;

      if (customerID && parseFloat(creditUsed) > 0) {
        const creditDoc = await CustomerCredit.findOne({ customerID, facilityID }).session(session);
        const availableCredit = creditDoc ? Math.max(0, Number(creditDoc.balance) || 0) : 0;
        appliedCredit = Math.min(availableCredit, Math.min(netTotal, parseFloat(creditUsed) || 0));

        if (appliedCredit > 0) {
          prevCustomerCredit = availableCredit;
          newCustomerCredit = prevCustomerCredit - appliedCredit;
          creditDoc.balance = newCustomerCredit;
          creditDoc.total_used_goods = (Number(creditDoc.total_used_goods) || 0) + appliedCredit;
          creditDoc.last_activity_date = new Date();
          await creditDoc.save({ session });

          await CustomerCreditTransaction.create([{
            creditID: creditDoc._id,
            customerID,
            facilityID,
            transaction_type: 'USED_FOR_PURCHASE',
            amount: appliedCredit,
            previous_balance: prevCustomerCredit,
            new_balance: newCustomerCredit,
            receipt_number: orderID,
            reference_id: orderID,
            payment_method: 'Customer Credit',
            processed_by_name: staffName,
            staffID: staffID && mongoose.Types.ObjectId.isValid(staffID) ? staffID : null,
            notes: `Applied ₦${appliedCredit.toLocaleString()} customer change towards purchase (Order #${orderID})`,
            date: new Date(),
          }], { session });
        }
      }

      const payableAfterCredit = Math.max(0, netTotal - appliedCredit);
      const totalPaid = (parseFloat(payment.cash) || 0) + (parseFloat(payment.pos) || 0) + (parseFloat(payment.transfer) || 0);
      const paymentType = isCredit ? 'credit' : (appliedCredit > 0 && totalPaid === 0 ? 'Customer Credit' : 'Split Payment');

      // Phase 2: Deduct stock atomically and insert order line items
      for (const [index, item] of validatedItems.entries()) {
        const qtyBefore = item.available;
        const qtyAfter = item.available - item.quantity;

        // Deduct inventory atomically with safeguard against negative stock
        const updateResult = await Stock.updateOne(
          { _id: item.stockId, facilityID, quantity: { $gte: item.quantity } },
          {
            $inc: { quantity: -item.quantity, out_stocks: item.quantity },
          },
          { session }
        );

        if (!updateResult.matchedCount) {
          throw new Error(`Insufficient stock for "${item.name}". Race condition prevented sale.`);
        }

        // Insert order line item
        await Order.create(
          [{
            facilityID,
            stockID: item.stockId,
            item: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.subtotal,
            item_discount: item.itemDiscount,
            staff: staffName,
            payment: paymentType,
            orderID,
            discount: globalDiscount,
            status: isCredit ? 0 : 1,
            customerID: customerID || null,
            customer_name: customerName || null,
            buyer_name: buyerName || null,
            amount_paid: totalPaid,
            credit_applied: appliedCredit,
            customer_credit_before: prevCustomerCredit,
            customer_credit_after: newCustomerCredit,
            change_given: Math.max(0, totalPaid - payableAfterCredit),
            net_total: netTotal,
            bank_name: payment.bankName || null,
            cash: payment.cash,
            pos: payment.pos,
            transfer: payment.transfer,
            creation: new Date(),
            mysqlId: orderMysqlIds[index],
          }],
          { session }
        );

        // Write to immutable stock movement ledger
        await StockMovement.create(
          [{
            facilityID,
            store_id: item.storeId,
            stock_id: item.stockId,
            movement_type: 'STOCK_OUT_SALE',
            quantity_change: -item.quantity,
            quantity_before: qtyBefore,
            quantity_after: qtyAfter,
            reference_type: 'orders',
            reference_id: orderID,
            notes: `Sale to ${buyerName || customerName || 'Retail'}`,
            performed_by: staffID,
            mysqlId: movementMysqlIds[index],
          }],
          { session }
        );
      }

      // Handle credit outstanding balance update (if remaining unpaid)
      const debtIncrease = Math.max(0, payableAfterCredit - totalPaid);
      if ((isCredit || debtIncrease > 0) && customerID && debtIncrease > 0) {
        const existing = await Debt.findOne({ customerID, facilityID }).session(session);

        if (existing) {
          existing.balance = Math.max(0, (Number(existing.balance) || 0) + debtIncrease);
          existing.amount = (Number(existing.amount) || 0) + totalPaid + appliedCredit;
          existing.updatedAt = new Date();
          await existing.save({ session });
        } else {
          const [debtMysqlId] = await reserveLegacyIds(Debt, 'debtId', 1, session);
          await Debt.create(
            [{
              customerID,
              facilityID,
              staffID,
              Customer: customerName || buyerName || 'Customer',
              staff: staffName,
              amount: totalPaid + appliedCredit,
              balance: debtIncrease,
              mysqlId: debtMysqlId,
              createdAt: new Date(),
              updatedAt: new Date(),
            }],
            { session }
          );
        }
      }

      await session.commitTransaction();
      return {
        orderID,
        grossTotal,
        totalItemDiscounts,
        netTotal,
        creditApplied: appliedCredit,
        amountPaid: totalPaid,
        debtIncrease,
        isCredit,
      };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new SalesRepositoryMongo();
