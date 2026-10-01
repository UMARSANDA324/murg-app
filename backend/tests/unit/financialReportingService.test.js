const test = require('node:test');
const assert = require('node:assert/strict');
const { Branch } = require('../../src/models');
const { FinancialReportingService, getPeriodRange } = require('../../src/services/financialReportingService');
const repository = require('../../src/repositories/financialReportingRepository');

function queryFor(rows) {
  return {
    select() { return this; },
    sort() { return this; },
    lean: async () => rows,
  };
}

test('financial reporting periods use inclusive Lagos business dates', () => {
  const week = getPeriodRange({ period: 'week', weekStart: '2026-01-01' });
  assert.equal(week.startDate, '2025-12-29');
  assert.equal(week.endDate, '2026-01-04');
  assert.equal(week.start.toISOString(), '2025-12-28T23:00:00.000Z');
  assert.equal(week.endExclusive.toISOString(), '2026-01-04T23:00:00.000Z');

  const month = getPeriodRange({ period: 'month', year: '2026', month: '2' });
  assert.equal(month.startDate, '2026-02-01');
  assert.equal(month.endDate, '2026-02-28');

  assert.throws(() => getPeriodRange({ period: 'custom', startDate: '2026-02-30', endDate: '2026-03-01' }), /valid calendar/);
  assert.throws(() => getPeriodRange({ period: 'custom', startDate: '2026-03-02', endDate: '2026-03-01' }), /on or before/);
});

test('financial report identifies branch scope and explicitly withholds unsupported profit', async () => {
  const originalFind = Branch.find;
  const originalGetSources = repository.getSources;
  let requestedFacilityIDs;
  Branch.find = (filter) => {
    assert.deepEqual(filter, { facilityID: 'MURG/007' });
    return queryFor([{ facilityID: 'MURG/007', name: 'Test Branch', status: 'active' }]);
  };
  repository.getSources = async ({ facilityIDs }) => {
    requestedFacilityIDs = facilityIDs;
    return {
      salesByBranch: [{ facilityID: 'MURG/007', grossSales: 120, netSales: 100, orderCount: 1, missingNetTotalOrderCount: 0 }],
      purchasesByBranch: [{ facilityID: 'MURG/007', purchaseValue: 80, amountPaid: 60, balance: 20, transactionCount: 1 }],
      expensesByBranchAndType: [{ facilityID: 'MURG/007', type: 'out', amount: 15, count: 1 }],
      debtsByBranch: [{ facilityID: 'MURG/007', outstandingBalance: 25, debtorCount: 1 }],
      inventoryByBranch: [{ facilityID: 'MURG/007', recordedBuyingValue: 200, unvaluedProductCount: 0, totalUnits: 2, productCount: 1 }],
      purchaseTransactions: [],
      purchaseTransactionCount: 0,
      unmapped: null,
    };
  };

  try {
    const service = new FinancialReportingService();
    const report = await service.getReport({
      branchId: 'MURG/007',
      period: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    assert.deepEqual(requestedFacilityIDs, ['MURG/007']);
    assert.deepEqual(report.scope, {
      type: 'branch',
      label: 'Test Branch',
      branchId: 'MURG/007',
      includedBranches: [{ facilityID: 'MURG/007', name: 'Test Branch', status: 'active' }],
    });
    assert.equal(report.summary.sales.netSales, 100);
    assert.equal(report.summary.purchases.amountSpent, 60);
    assert.equal(report.summary.expenses.recordedOut, 15);
    assert.equal(report.summary.inventory.recordedBuyingPriceValue, 200);
    assert.equal(report.summary.profitLoss.status, 'unavailable');
    assert.equal(report.summary.profitLoss.netProfitOrLoss, null);
    assert.equal(report.summary.inventory.label, 'Recorded Inventory Buying-Price Value');
  } finally {
    Branch.find = originalFind;
    repository.getSources = originalGetSources;
  }
});

test('all-business report aggregates actual branches and exposes unmapped data without assignment', async () => {
  const originalFind = Branch.find;
  const originalGetSources = repository.getSources;
  let sourceOptions;
  Branch.find = (filter) => {
    assert.deepEqual(filter, {});
    return queryFor([
      { facilityID: 'MURG/001', name: 'Active Branch', status: 'active' },
      { facilityID: 'MURG/002', name: 'Inactive Branch', status: 'inactive' },
    ]);
  };
  repository.getSources = async (options) => {
    sourceOptions = options;
    return {
      salesByBranch: [{ facilityID: 'MURG/001', grossSales: 50, netSales: 45, orderCount: 1, missingNetTotalOrderCount: 0 }],
      purchasesByBranch: [],
      expensesByBranchAndType: [],
      debtsByBranch: [],
      inventoryByBranch: [],
      purchaseTransactions: [],
      purchaseTransactionCount: 0,
      unmapped: { orderLines: 2, purchaseRecords: 1, expenseRecords: 0 },
    };
  };

  try {
    const service = new FinancialReportingService();
    const report = await service.getReport({
      branchId: 'all',
      period: 'year',
      year: '2026',
    });

    assert.deepEqual(sourceOptions.facilityIDs, ['MURG/001', 'MURG/002']);
    assert.equal(sourceOptions.includeUnmapped, true);
    assert.equal(report.scope.type, 'all-business');
    assert.equal(report.branchBreakdown.length, 2);
    assert.equal(report.summary.sales.netSales, 45);
    assert.deepEqual(report.dataQuality.unmappedHistoricalRecords, {
      orderLines: 2,
      purchaseRecords: 1,
      expenseRecords: 0,
    });
    assert.match(report.financialDefinitions.revenue, /not calculated/);
    assert.match(report.financialDefinitions.totalCapital, /Not calculated/);
  } finally {
    Branch.find = originalFind;
    repository.getSources = originalGetSources;
  }
});
