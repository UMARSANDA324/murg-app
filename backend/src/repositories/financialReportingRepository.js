const { Order, Purchase, Expense, Debt, Stock, Customer, Deposit, StockMovement } = require('../models');
const { mongoose } = require('../config/mongodb');

function numericExpression(field) {
  return {
    $convert: {
      input: field,
      to: 'double',
      onError: null,
      onNull: null,
    },
  };
}

function numeric(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function applyPeriod(query, field, start, end) {
  query[field] = { $gte: start, $lt: end };
  return query;
}

class FinancialReportingRepository {
  async getSources({ facilityIDs, start, end, includeUnmapped = false }) {
    const branchFilter = { $in: facilityIDs };
    const orderMatch = {
      facilityID: branchFilter,
      orderID: { $exists: true, $ne: null },
    };
    const purchaseMatch = { facilityID: branchFilter };
    const expenseMatch = { facilityID: branchFilter };

    applyPeriod(orderMatch, 'creation', start, end);
    applyPeriod(purchaseMatch, 'purchase_date', start, end);
    applyPeriod(expenseMatch, 'date', start, end);

    const [orders, purchases, expenses, debts, inventory, purchaseTransactions, purchaseCount, unmapped] = await Promise.all([
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: { facilityID: '$facilityID', orderID: '$orderID' },
            facilityID: { $first: '$facilityID' },
            orderID: { $first: '$orderID' },
            netTotal: { $first: numericExpression('$net_total') },
            minNetTotal: { $min: numericExpression('$net_total') },
            maxNetTotal: { $max: numericExpression('$net_total') },
            subtotal: { $sum: numericExpression('$subtotal') },
          },
        },
        {
          $project: {
            facilityID: 1,
            orderID: 1,
            grossSales: '$subtotal',
            netSales: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$netTotal', null] },
                    { $ne: ['$minNetTotal', '$maxNetTotal'] },
                  ],
                },
                0,
                '$netTotal',
              ],
            },
            missingNetTotal: { $eq: ['$netTotal', null] },
            conflictingNetTotal: {
              $and: [
                { $ne: ['$netTotal', null] },
                { $ne: ['$minNetTotal', '$maxNetTotal'] },
              ],
            },
          },
        },
        {
          $group: {
            _id: '$facilityID',
            grossSales: { $sum: '$grossSales' },
            netSales: { $sum: '$netSales' },
            orderCount: { $sum: 1 },
            missingNetTotalOrderCount: { $sum: { $cond: ['$missingNetTotal', 1, 0] } },
            conflictingNetTotalOrderCount: { $sum: { $cond: ['$conflictingNetTotal', 1, 0] } },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: '$facilityID',
            purchaseValue: { $sum: { $ifNull: [numericExpression('$total_cost'), 0] } },
            amountPaid: { $sum: { $ifNull: [numericExpression('$amount_paid'), 0] } },
            balance: { $sum: { $ifNull: [numericExpression('$balance'), 0] } },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: {
              facilityID: '$facilityID',
              type: { $toLower: { $ifNull: [{ $toString: '$type' }, 'unknown'] } },
            },
            amount: { $sum: { $ifNull: [numericExpression('$price'), 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
      Debt.aggregate([
        {
          $match: {
            facilityID: branchFilter,
            $expr: { $gt: [numericExpression('$balance'), 0] },
          },
        },
        {
          $group: {
            _id: '$facilityID',
            outstandingBalance: { $sum: { $ifNull: [numericExpression('$balance'), 0] } },
            debtorCount: { $sum: 1 },
          },
        },
      ]),
      Stock.aggregate([
        {
          $match: {
            facilityID: branchFilter,
            $or: [
              { status: 'active' },
              { status: { $exists: false } },
              { status: null },
            ],
          },
        },
        {
          $addFields: {
            reportQuantity: numericExpression('$quantity'),
            reportBuying: numericExpression('$buying'),
            reportSelling: numericExpression('$selling'),
          },
        },
        {
          $group: {
            _id: '$facilityID',
            productCount: { $sum: 1 },
            totalUnits: { $sum: { $ifNull: ['$reportQuantity', 0] } },
            recordedBuyingValue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$reportQuantity', null] }, { $ne: ['$reportBuying', null] }] },
                  { $multiply: ['$reportQuantity', '$reportBuying'] },
                  0,
                ],
              },
            },
            unvaluedProductCount: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$reportQuantity', null] }, { $ne: ['$reportBuying', null] }] },
                  0,
                  1,
                ],
              },
            },
            recordedRetailValue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$reportQuantity', null] }, { $ne: ['$reportSelling', null] }] },
                  { $multiply: ['$reportQuantity', '$reportSelling'] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Purchase.find(purchaseMatch)
        .select('facilityID purchase_date stock_name quantity cost_price total_cost amount_paid balance purchase_from for_desc stock_id')
        .populate('stock_id', 'name')
        .sort({ purchase_date: -1 })
        .limit(200)
        .lean(),
      Purchase.countDocuments(purchaseMatch),
      includeUnmapped ? this.getUnmappedCounts(facilityIDs, { start, end }) : Promise.resolve(null),
    ]);

    return {
      salesByBranch: orders.map((row) => ({
        facilityID: row._id,
        grossSales: round(numeric(row.grossSales)),
        netSales: round(numeric(row.netSales)),
        orderCount: numeric(row.orderCount),
        missingNetTotalOrderCount: numeric(row.missingNetTotalOrderCount),
        conflictingNetTotalOrderCount: numeric(row.conflictingNetTotalOrderCount),
      })),
      purchasesByBranch: purchases.map((row) => ({
        facilityID: row._id,
        purchaseValue: round(numeric(row.purchaseValue)),
        amountPaid: round(numeric(row.amountPaid)),
        balance: round(numeric(row.balance)),
        transactionCount: numeric(row.transactionCount),
      })),
      expensesByBranchAndType: expenses.map((row) => ({
        facilityID: row._id.facilityID,
        type: row._id.type,
        amount: round(numeric(row.amount)),
        count: numeric(row.count),
      })),
      debtsByBranch: debts.map((row) => ({
        facilityID: row._id,
        outstandingBalance: round(numeric(row.outstandingBalance)),
        debtorCount: numeric(row.debtorCount),
      })),
      inventoryByBranch: inventory.map((row) => ({
        facilityID: row._id,
        productCount: numeric(row.productCount),
        totalUnits: numeric(row.totalUnits),
        recordedBuyingValue: round(numeric(row.recordedBuyingValue)),
        unvaluedProductCount: numeric(row.unvaluedProductCount),
        recordedRetailValue: round(numeric(row.recordedRetailValue)),
      })),
      purchaseTransactions: purchaseTransactions.map((purchase) => ({
        id: purchase._id.toString(),
        facilityID: purchase.facilityID,
        purchaseDate: purchase.purchase_date || null,
        productName: purchase.stock_id?.name || purchase.stock_name || null,
        quantity: numeric(purchase.quantity),
        costPrice: numeric(purchase.cost_price),
        totalCost: numeric(purchase.total_cost),
        amountPaid: numeric(purchase.amount_paid),
        balance: numeric(purchase.balance),
        supplier: purchase.purchase_from || null,
        description: purchase.for_desc || null,
      })),
      purchaseTransactionCount: numeric(purchaseCount),
      unmapped,
    };
  }

  async getUnmappedCounts(facilityIDs, { start, end }) {
    const unmappedBranchFilter = { $nin: facilityIDs };
    const orderQuery = {
      facilityID: unmappedBranchFilter,
      orderID: { $exists: true, $ne: null },
      creation: { $gte: start, $lt: end },
    };
    const purchaseQuery = {
      facilityID: unmappedBranchFilter,
      purchase_date: { $gte: start, $lt: end },
    };
    const expenseQuery = {
      facilityID: unmappedBranchFilter,
      date: { $gte: start, $lt: end },
    };
    const [orderLines, purchaseRecords, expenseRecords, debtRecords] = await Promise.all([
      Order.countDocuments(orderQuery),
      Purchase.countDocuments(purchaseQuery),
      Expense.countDocuments(expenseQuery),
      Debt.countDocuments({
        facilityID: unmappedBranchFilter,
        $expr: { $gt: [numericExpression('$balance'), 0] },
      }),
    ]);
    return { orderLines, purchaseRecords, expenseRecords, debtRecords };
  }

  async getDebtorReport({ facilityIDs, customerId = null, includeUnmapped = false }) {
    const match = {
      facilityID: { $in: facilityIDs },
      $expr: { $gt: [numericExpression('$balance'), 0] },
    };
    if (customerId) {
      if (!mongoose.Types.ObjectId.isValid(customerId)) {
        throw new TypeError('Customer ID is invalid.');
      }
      match.customerID = new mongoose.Types.ObjectId(customerId);
    }
    const unmappedDebtMatch = {
      facilityID: { $nin: facilityIDs },
      $expr: { $gt: [numericExpression('$balance'), 0] },
      ...(match.customerID ? { customerID: match.customerID } : {}),
    };

    const [debts, totals, unmappedTotals] = await Promise.all([
      Debt.aggregate([
        { $match: match },
        {
          $addFields: {
            balance: numericExpression('$balance'),
            last_payment: numericExpression('$last_payment'),
          },
        },
        { $sort: { facilityID: 1 } },
        { $limit: 2000 },
      ]),
      Debt.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: { $ifNull: [numericExpression('$balance'), 0] } },
            count: { $sum: 1 },
          },
        },
      ]),
      includeUnmapped
        ? Debt.aggregate([
          {
            $match: unmappedDebtMatch,
          },
          {
            $group: {
              _id: null,
              balance: { $sum: { $ifNull: [numericExpression('$balance'), 0] } },
              count: { $sum: 1 },
            },
          },
        ])
        : Promise.resolve([]),
    ]);
    const customerIds = debts.map((debt) => debt.customerID).filter(Boolean);
    const [customers, deposits, creditOrders] = await Promise.all([
      Customer.find({ _id: { $in: customerIds } }).select('name phone email facilityID').lean(),
      Deposit.aggregate([
        { $match: { facilityID: { $in: facilityIDs }, customerID: { $in: customerIds } } },
        { $sort: { payment_date: -1 } },
        {
          $group: {
            _id: { facilityID: '$facilityID', customerID: '$customerID' },
            totalDeposits: { $sum: { $ifNull: [numericExpression('$amount'), 0] } },
            entries: {
              $push: {
                date: '$payment_date',
                amount: numericExpression('$amount'),
                receiptNumber: '$receipt_number',
                paymentMethod: '$payment_method',
              },
            },
          },
        },
        {
          $addFields: {
            entryCount: { $size: '$entries' },
            entries: { $slice: ['$entries', 100] },
          },
        },
      ]),
      // Get ALL credit orders for the facility, not just for customers with positive debt
      // This ensures complete credit sale history regardless of current debt balance
      Order.aggregate([
        {
          $match: {
            facilityID: { $in: facilityIDs },
            customerID: { $exists: true, $ne: null },
            $or: [
              { payment: { $regex: /^credit$/i } },
              { status: { $in: [0, '0'] } },
            ],
          },
        },
        {
          $group: {
            _id: { facilityID: '$facilityID', customerID: '$customerID', orderID: '$orderID' },
            orderID: { $first: '$orderID' },
            date: { $first: '$creation' },
            netTotal: { $first: numericExpression('$net_total') },
            amountPaid: { $first: numericExpression('$amount_paid') },
            buyerName: { $first: { $ifNull: ['$buyer_name', '$customer_name'] } },
          },
        },
        { $sort: { date: -1 } },
        {
          $group: {
            _id: { facilityID: '$_id.facilityID', customerID: '$_id.customerID' },
            orders: {
              $push: {
                orderID: '$orderID',
                date: '$date',
                netTotal: '$netTotal',
                amountPaid: '$amountPaid',
                buyerName: '$buyerName',
              },
            },
          },
        },
        { $addFields: { orderCount: { $size: '$orders' }, orders: { $slice: ['$orders', 100] } } },
      ]),
    ]);
    const customerById = new Map(customers.map((customer) => [String(customer._id), customer]));
    const depositsByKey = new Map(deposits.map((item) => [`${item._id.facilityID}:${item._id.customerID}`, item]));
    const ordersByKey = new Map(creditOrders.map((item) => [`${item._id.facilityID}:${item._id.customerID}`, item]));

    // Build debt map for quick lookup
    const debtByCustomer = new Map(debts.map((debt) => [String(debt.customerID), debt]));

    // Get all unique customer IDs from credit orders (not just debts)
    const allCustomerIdsFromOrders = [...new Set(creditOrders.map((item) => String(item._id.customerID)))];

    // Fetch customer details for customers with credit orders but no positive debt
    const missingCustomerIds = allCustomerIdsFromOrders.filter(cid => !customerById.has(cid));
    if (missingCustomerIds.length > 0) {
      const missingCustomers = await Customer.find({ _id: { $in: missingCustomerIds } })
        .select('name phone email facilityID')
        .lean();
      missingCustomers.forEach(customer => customerById.set(String(customer._id), customer));
    }

    // Build items for customers with positive debt (current debtors)
    const debtItems = debts.map((debt) => {
      const customer = customerById.get(String(debt.customerID));
      const key = `${debt.facilityID}:${debt.customerID}`;
      const depositHistory = depositsByKey.get(key)?.entries || [];
      return {
        customerId: debt.customerID ? String(debt.customerID) : null,
        customerName: customer?.name || debt.Customer || 'Unknown customer',
        phone: customer?.phone || null,
        email: customer?.email || null,
        branchId: debt.facilityID || null,
        balance: numeric(debt.balance),
        lastPayment: numeric(debt.last_payment),
        lastPaymentDate: debt.last_payment_date || null,
        depositTotal: numeric(depositsByKey.get(key)?.totalDeposits),
        debtHistory: ordersByKey.get(key)?.orders || [],
        paymentHistory: depositHistory,
        debtHistoryTotal: numeric(ordersByKey.get(key)?.orderCount),
        paymentHistoryTotal: numeric(depositsByKey.get(key)?.entryCount),
      };
    });

    // Build items for customers with credit orders but no positive debt (historical credit customers)
    const historicalCreditItems = allCustomerIdsFromOrders
      .filter(cid => !debtByCustomer.has(cid) || debtByCustomer.get(cid).balance <= 0)
      .map((customerId) => {
        const customer = customerById.get(customerId);
        const creditOrderData = creditOrders.find(item => String(item._id.customerID) === customerId);
        const facilityID = creditOrderData?._id.facilityID;
        const key = `${facilityID}:${customerId}`;
        const depositHistory = depositsByKey.get(key)?.entries || [];
        const debt = debtByCustomer.get(customerId);

        return {
          customerId: customerId,
          customerName: customer?.name || 'Unknown customer',
          phone: customer?.phone || null,
          email: customer?.email || null,
          branchId: facilityID || null,
          balance: debt ? numeric(debt.balance) : 0,
          lastPayment: debt ? numeric(debt.last_payment) : 0,
          lastPaymentDate: debt?.last_payment_date || null,
          depositTotal: numeric(depositsByKey.get(key)?.totalDeposits),
          debtHistory: ordersByKey.get(key)?.orders || [],
          paymentHistory: depositHistory,
          debtHistoryTotal: numeric(ordersByKey.get(key)?.orderCount),
          paymentHistoryTotal: numeric(depositsByKey.get(key)?.entryCount),
        };
      });

    // Combine both sets, prioritizing current debtors first
    const items = [...debtItems, ...historicalCreditItems];
    return {
      items,
      totalCount: items.length, // Total customers with credit history (both current debtors and historical)
      totalBalance: numeric(totals[0]?.totalBalance), // Only outstanding balance from current debtors
      unmapped: {
        debtorCount: numeric(unmappedTotals[0]?.count),
        outstandingBalance: numeric(unmappedTotals[0]?.balance),
      },
    };
  }

  async getHistoryReport({ facilityIDs, start, end, limit = 500 }) {
    const match = {
      facilityID: { $in: facilityIDs },
      orderID: { $exists: true, $ne: null },
      creation: { $gte: start, $lt: end },
    };
    const movementMatch = {
      facilityID: { $in: facilityIDs },
      createdAt: { $gte: start, $lt: end },
    };
    const unmappedOrderMatch = {
      facilityID: { $nin: facilityIDs },
      orderID: { $exists: true, $ne: null },
      creation: { $gte: start, $lt: end },
    };
    const unmappedMovementMatch = {
      facilityID: { $nin: facilityIDs },
      createdAt: { $gte: start, $lt: end },
    };
    const [groups, count, movements, movementCount, unmappedOrders, unmappedMovements] = await Promise.all([
      Order.aggregate([
        { $match: match },
        { $sort: { creation: -1, _id: 1 } },
        {
          $group: {
            _id: { facilityID: '$facilityID', orderID: '$orderID' },
            facilityID: { $first: '$facilityID' },
            orderID: { $first: '$orderID' },
            date: { $first: '$creation' },
            customer: { $first: { $ifNull: ['$customer_name', '$buyer_name'] } },
            payment: { $first: '$payment' },
            status: { $first: '$status' },
            netTotal: { $first: numericExpression('$net_total') },
            amountPaid: { $first: numericExpression('$amount_paid') },
            items: {
              $push: {
                item: '$item',
                quantity: numericExpression('$quantity'),
                unitPrice: numericExpression('$price'),
                amount: numericExpression('$subtotal'),
              },
            },
          },
        },
        { $sort: { date: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            facilityID: 1,
            orderID: 1,
            date: 1,
            customer: 1,
            payment: 1,
            status: 1,
            netTotal: 1,
            amountPaid: 1,
            items: 1,
          },
        },
      ]),
      Order.aggregate([
        { $match: match },
        { $group: { _id: { facilityID: '$facilityID', orderID: '$orderID' } } },
        { $count: 'total' },
      ]),
      StockMovement.find(movementMatch)
        .populate('stock_id', 'name')
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean(),
      StockMovement.countDocuments(movementMatch),
      Order.aggregate([
        { $match: unmappedOrderMatch },
        { $group: { _id: { facilityID: '$facilityID', orderID: '$orderID' } } },
        { $count: 'total' },
      ]),
      StockMovement.countDocuments(unmappedMovementMatch),
    ]);
    return {
      transactions: groups,
      total: numeric(count[0]?.total),
      limit,
      movements: movements.map((movement) => ({
        id: movement._id.toString(),
        facilityID: movement.facilityID || null,
        stockName: movement.stock_id?.name || null,
        movementType: movement.movement_type || 'Unknown',
        referenceType: movement.reference_type || null,
        referenceId: movement.reference_id || null,
        quantityChange: numeric(movement.quantity_change),
        quantityBefore: numeric(movement.quantity_before),
        quantityAfter: numeric(movement.quantity_after),
        notes: movement.notes || null,
        createdAt: movement.createdAt || null,
      })),
      movementCount: numeric(movementCount),
      unmapped: {
        transactions: numeric(unmappedOrders[0]?.total),
        stockMovements: numeric(unmappedMovements),
      },
    };
  }
}

module.exports = new FinancialReportingRepository();
