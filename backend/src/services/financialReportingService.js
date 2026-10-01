const { Branch } = require('../models');
const financialRepository = require('../repositories/financialReportingRepository');

const TIME_ZONE = 'Africa/Lagos';
const TIME_ZONE_LABEL = 'Africa/Lagos (+01:00)';

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError('Dates must use YYYY-MM-DD format.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new TypeError('Dates must be valid calendar dates.');
  }
  return date;
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function businessDayStart(date) {
  const value = parseDate(date);
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    0,
    -60
  ));
}

function addDays(date, amount) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + amount);
  return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function getPeriodRange({ period, startDate, endDate, weekStart, month, year }) {
  const today = currentBusinessDate();
  const todayDate = parseDate(today);
  let start;
  let end;
  let type = period;

  if (period === 'custom') {
    start = startDate;
    end = endDate;
  } else if (period === 'week') {
    const anchor = weekStart || today;
    const parsedAnchor = parseDate(anchor);
    const mondayOffset = (parsedAnchor.getUTCDay() + 6) % 7;
    const monday = new Date(parsedAnchor);
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    start = formatDate(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
    end = addDays(start, 6);
  } else if (period === 'month') {
    const targetYear = Number(year || todayDate.getUTCFullYear());
    const targetMonth = Number(month || todayDate.getUTCMonth() + 1);
    if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
      throw new TypeError('Year must be an integer between 2000 and 2100.');
    }
    if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
      throw new TypeError('Month must be an integer from 1 to 12.');
    }
    start = formatDate(targetYear, targetMonth, 1);
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    end = formatDate(targetYear, targetMonth, lastDay);
  } else if (period === 'year') {
    const targetYear = Number(year || todayDate.getUTCFullYear());
    if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
      throw new TypeError('Year must be an integer between 2000 and 2100.');
    }
    start = `${targetYear}-01-01`;
    end = `${targetYear}-12-31`;
  } else {
    throw new TypeError('Period must be week, month, year, or custom.');
  }

  parseDate(start);
  parseDate(end);
  if (start > end) throw new TypeError('Start date must be on or before end date.');

  return {
    type,
    startDate: start,
    endDate: end,
    start: businessDayStart(start),
    endExclusive: businessDayStart(addDays(end, 1)),
    timezone: TIME_ZONE_LABEL,
  };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function buildBranchRows(branches, sources) {
  const byBranch = new Map(branches.map((branch) => [
    branch.facilityID,
    {
      facilityID: branch.facilityID,
      branchName: branch.name,
      sales: { grossSales: 0, netSales: 0, orderCount: 0, missingNetTotalOrderCount: 0, conflictingNetTotalOrderCount: 0 },
      purchases: { purchaseValue: 0, amountSpent: 0, balance: 0, transactionCount: 0 },
      expenses: { recordedOut: 0, recordedIn: 0, other: 0, transactionCount: 0 },
      outstandingDebt: { balance: 0, debtorCount: 0 },
      inventory: { recordedBuyingPriceValue: 0, unvaluedProductCount: 0, totalUnits: 0, productCount: 0 },
    },
  ]));

  for (const sales of sources.salesByBranch) {
    const row = byBranch.get(sales.facilityID);
    if (!row) continue;
    row.sales = {
      grossSales: sales.grossSales,
      netSales: sales.netSales,
      orderCount: sales.orderCount,
      missingNetTotalOrderCount: sales.missingNetTotalOrderCount,
      conflictingNetTotalOrderCount: sales.conflictingNetTotalOrderCount,
    };
  }
  for (const purchase of sources.purchasesByBranch) {
    const row = byBranch.get(purchase.facilityID);
    if (!row) continue;
    row.purchases = {
      purchaseValue: purchase.purchaseValue,
      amountSpent: purchase.amountPaid,
      balance: purchase.balance,
      transactionCount: purchase.transactionCount,
    };
  }
  for (const expense of sources.expensesByBranchAndType) {
    const row = byBranch.get(expense.facilityID);
    if (!row) continue;
    if (expense.type === 'out') row.expenses.recordedOut += expense.amount;
    else if (expense.type === 'in') row.expenses.recordedIn += expense.amount;
    else row.expenses.other += expense.amount;
    row.expenses.transactionCount += expense.count;
  }
  for (const debt of sources.debtsByBranch) {
    const row = byBranch.get(debt.facilityID);
    if (row) row.outstandingDebt = { balance: debt.outstandingBalance, debtorCount: debt.debtorCount };
  }
  for (const inventory of sources.inventoryByBranch) {
    const row = byBranch.get(inventory.facilityID);
    if (!row) continue;
    row.inventory = {
      recordedBuyingPriceValue: inventory.recordedBuyingValue,
      unvaluedProductCount: inventory.unvaluedProductCount,
      totalUnits: inventory.totalUnits,
      productCount: inventory.productCount,
    };
  }
  return Array.from(byBranch.values());
}

class FinancialReportingService {
  async resolveBranches(branchId) {
    const branches = branchId === 'all'
      ? await Branch.find({}).select('facilityID name status').sort({ facilityID: 1 }).lean()
      : await Branch.find({ facilityID: branchId }).select('facilityID name status').lean();

    if (branchId !== 'all' && branches.length === 0) {
      const error = new Error('Branch not found.');
      error.statusCode = 404;
      throw error;
    }
    return branches;
  }

  buildScope(branchId, branches) {
    const branch = branchId === 'all' ? null : branches[0];
    return {
      type: branchId === 'all' ? 'all-business' : 'branch',
      label: branch ? branch.name : 'All Branches / Entire Business',
      branchId: branch?.facilityID || null,
      includedBranches: branches.map(({ facilityID, name, status }) => ({ facilityID, name, status })),
    };
  }

  async getReport({ branchId = 'all', period = 'week', startDate, endDate, weekStart, month, year }) {
    const range = getPeriodRange({ period, startDate, endDate, weekStart, month, year });
    const branches = await this.resolveBranches(branchId);

    const facilityIDs = branches.map((branch) => branch.facilityID);
    const sources = await financialRepository.getSources({
      facilityIDs,
      start: range.start,
      end: range.endExclusive,
      includeUnmapped: branchId === 'all',
    });
    const branchRows = buildBranchRows(branches, sources);
    const totalInventoryValue = sum(branchRows.map((row) => row.inventory), 'recordedBuyingPriceValue');
    const unvaluedProductCount = sum(branchRows.map((row) => row.inventory), 'unvaluedProductCount');
    const summary = {
      sales: {
        grossSales: round(sum(branchRows.map((row) => row.sales), 'grossSales')),
        netSales: round(sum(branchRows.map((row) => row.sales), 'netSales')),
        orderCount: sum(branchRows.map((row) => row.sales), 'orderCount'),
        missingNetTotalOrderCount: sum(branchRows.map((row) => row.sales), 'missingNetTotalOrderCount'),
        conflictingNetTotalOrderCount: sum(branchRows.map((row) => row.sales), 'conflictingNetTotalOrderCount'),
      },
      purchases: {
        totalPurchaseValue: round(sum(branchRows.map((row) => row.purchases), 'purchaseValue')),
        amountSpent: round(sum(branchRows.map((row) => row.purchases), 'amountSpent')),
        outstandingPurchaseBalance: round(sum(branchRows.map((row) => row.purchases), 'balance')),
        transactionCount: sum(branchRows.map((row) => row.purchases), 'transactionCount'),
      },
      expenses: {
        recordedOut: round(sum(branchRows.map((row) => row.expenses), 'recordedOut')),
        recordedIn: round(sum(branchRows.map((row) => row.expenses), 'recordedIn')),
        other: round(sum(branchRows.map((row) => row.expenses), 'other')),
      },
      outstandingDebt: {
        balance: round(sum(branchRows.map((row) => row.outstandingDebt), 'balance')),
        debtorCount: sum(branchRows.map((row) => row.outstandingDebt), 'debtorCount'),
        asOf: currentBusinessDate(),
      },
      inventory: {
        label: 'Recorded Inventory Buying-Price Value',
        definition: 'Sum of stock quantity × recorded current buying price for active stock. Legacy records with no status use the schema default of active; explicitly inactive records are excluded. This is not total business capital.',
        recordedBuyingPriceValue: round(totalInventoryValue),
        unvaluedProductCount,
        totalUnits: sum(branchRows.map((row) => row.inventory), 'totalUnits'),
        productCount: sum(branchRows.map((row) => row.inventory), 'productCount'),
      },
      profitLoss: {
        status: 'unavailable',
        reason: 'A canonical MURG profit formula and sale-time historical cost basis are not established in the current data model. Current stock buying prices cannot reliably represent historical COGS.',
        cogs: null,
        grossProfit: null,
        netProfitOrLoss: null,
      },
      accountingRevenue: {
        status: 'unavailable',
        reason: 'The current data model does not establish an accounting revenue-recognition rule. Persisted order net_total is reported as recorded net sales, not accounting revenue.',
      },
    };

    const branch = branchId === 'all' ? null : branches[0];
    return {
      companyName: 'MURG Textile Enterprises',
      reportType: 'Financial Overview',
      reportKind: 'financial',
      scope: this.buildScope(branchId, branches),
      period: {
        type: range.type,
        startDate: range.startDate,
        endDate: range.endDate,
        timezone: range.timezone,
      },
      summary,
      branchBreakdown: branchRows,
      purchaseTransactions: {
        items: sources.purchaseTransactions,
        returned: sources.purchaseTransactions.length,
        total: sources.purchaseTransactionCount,
        truncated: sources.purchaseTransactionCount > sources.purchaseTransactions.length,
      },
      dataQuality: {
        salesWithoutPersistedNetTotal: summary.sales.missingNetTotalOrderCount,
        salesWithConflictingPersistedNetTotal: summary.sales.conflictingNetTotalOrderCount,
        unmappedHistoricalRecords: sources.unmapped,
      },
      financialDefinitions: {
        netSales: 'Sum of persisted order-level net_total values, counted once per facilityID/orderID. Orders lacking net_total or having conflicting per-line net_total values are excluded from this subtotal and reported separately; their line subtotals remain included in grossSales.',
        revenue: 'Accounting revenue is not calculated because the data model does not establish a recognition rule. Persisted order net_total is presented as recorded net sales only.',
        purchaseValue: 'Sum of purchase_history.total_cost by purchase_date.',
        amountSpent: 'Sum of purchase_history.amount_paid by purchase_date; distinct from total purchase value.',
        purchaseCapital: 'Not calculated as a capital balance; purchase value and actual amount paid are reported as separate purchase metrics.',
        expenseTypes: 'Expense.type=out and type=in are reported separately because the existing application uses both; other or missing values are reported separately.',
        outstandingDebt: 'Current positive Debt.balance snapshot, not period debt activity.',
        inventoryValue: 'Current active stock quantity × current recorded buying price; legacy records missing status follow the schema default of active, explicitly inactive records are excluded, and unvalued products are counted and excluded from the calculated value.',
        cogs: 'Unavailable because orders do not store a reliable sale-time cost basis; current stock buying price is not substituted for historical COGS.',
        grossProfit: 'Unavailable because reliable accounting revenue and COGS definitions are not established.',
        netProfitOrLoss: 'Unavailable because canonical expenses, accounting revenue, and historical COGS treatment are not established.',
        totalCapital: 'Not calculated: the existing records do not establish a comprehensive business-capital balance.',
        profitLoss: 'Unavailable until the canonical MURG formula and reliable historical sale-time COGS source are established.',
      },
    };
  }

  async getDebtorReport({ branchId = 'all', customerId = null }) {
    const branches = await this.resolveBranches(branchId);
    const debts = await financialRepository.getDebtorReport({
      facilityIDs: branches.map((branch) => branch.facilityID),
      customerId,
      includeUnmapped: branchId === 'all',
    });
    return {
      companyName: 'MURG Textile Enterprises',
      reportType: 'Debtors / Credit Customers',
      reportKind: 'debtors',
      scope: this.buildScope(branchId, branches),
      generatedAt: new Date().toISOString(),
      asOf: currentBusinessDate(),
      totals: {
        customerCount: debts.totalCount ?? 0,
        outstandingBalance: Number.isFinite(debts.totalBalance) ? round(debts.totalBalance) : null,
      },
      returnedDebtors: debts.items.length,
      truncated: debts.totalCount > debts.items.length,
      unmappedDebts: debts.unmapped,
      debtors: debts.items,
    };
  }

  async getHistoryReport({
    branchId = 'all',
    period = 'custom',
    startDate,
    endDate,
    weekStart,
    month,
    year,
  }) {
    const range = getPeriodRange({ period, startDate, endDate, weekStart, month, year });
    const branches = await this.resolveBranches(branchId);
    const history = await financialRepository.getHistoryReport({
      facilityIDs: branches.map((branch) => branch.facilityID),
      start: range.start,
      end: range.endExclusive,
    });
    const branchNames = new Map(branches.map((branch) => [branch.facilityID, branch.name]));
    return {
      companyName: 'MURG Textile Enterprises',
      reportType: 'Sales History / Ledger',
      reportKind: 'history',
      scope: this.buildScope(branchId, branches),
      period: {
        startDate: range.startDate,
        endDate: range.endDate,
        timezone: range.timezone,
      },
      generatedAt: new Date().toISOString(),
      totalTransactions: history.total,
      returnedTransactions: history.transactions.length,
      truncated: history.total > history.transactions.length,
      totalStockMovements: history.movementCount,
      returnedStockMovements: history.movements.length,
      stockMovementsTruncated: history.movementCount > history.movements.length,
      unmappedHistoricalRecords: history.unmapped,
      transactions: history.transactions.map((transaction) => ({
        ...transaction,
        branchName: branchNames.get(transaction.facilityID) || transaction.facilityID,
      })),
      stockMovements: history.movements.map((movement) => ({
        ...movement,
        branchName: branchNames.get(movement.facilityID) || movement.facilityID || 'Unassigned',
      })),
    };
  }
}

module.exports = { FinancialReportingService, getPeriodRange };
