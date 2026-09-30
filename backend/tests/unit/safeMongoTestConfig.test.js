const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_TEST_DATABASE,
  getTestDatabaseName,
} = require('../support/mongoTestDatabase');
const analyticsRepository = require('../../src/repositories/analyticsRepository');
const { Order } = require('../../src/models');
const repositoryContracts = [
  ['branch', require('../../src/repositories/branchRepositoryMongo'), ['findAll', 'findByFacilityID', 'create', 'update', 'setStatus', 'getDashboardMetrics']],
  ['staff', require('../../src/repositories/staffRepositoryMongo'), ['findAll', 'findById', 'create', 'updateRole', 'setStatus', 'emailExists', 'delete', 'updateEmail', 'updatePassword']],
  ['stock', require('../../src/repositories/stockRepositoryMongo'), ['findAll', 'findById', 'updatePrice', 'updateYardConfig', 'receiveStock', 'getMovements', 'getStores', 'createStore', 'updateStore', 'deleteStore', 'getPurchaseHistory', 'getPurchaseTotals', 'globalCatalogSearch']],
  ['goods request', require('../../src/repositories/goodsRequestRepositoryMongo'), ['createRequest', 'findByStaff', 'findAll', 'findById', 'findApprovedForBranch', 'findByReceiptCode', 'validateReceiptForRelease', 'getEligibleBranchesForProduct', 'getEligibleBranchesByName', 'rejectRequest', 'approveRequest', 'releaseGoods', 'approveAndShipRequest']],
  ['shipment', require('../../src/repositories/shipmentRepositoryMongo'), ['findAll', 'findById', 'createAndDispatch', 'confirmReceipt']],
  ['shipment receipt', require('../../src/repositories/shipmentReceiptRepository'), ['findByReceiptCode', 'verifyAndReleaseReceipt']],
  ['returns', require('../../src/repositories/returnsRepositoryMongo'), ['validateOrderForReturn', 'processOrderReturn']],
  ['customer', require('../../src/repositories/customerRepositoryMongo'), ['findAll', 'findById', 'create', 'recordDeposit', 'getDepositHistory']],
  ['expense', require('../../src/repositories/expenseRepositoryMongo'), ['getExpenses', 'getExpenseById', 'createExpense', 'updateExpense', 'deleteExpense', 'getExpenseTotals', 'getTodayTotals', 'getAllTimeTotals']],
  ['notification', require('../../src/repositories/notificationRepositoryMongo'), ['getForUser', 'getUnreadCount', 'markAsRead', 'markAllAsRead', 'markListAsRead', 'create']],
];

test('accepts only the dedicated murg_test database', () => {
  const uri = 'mongodb+srv://test-user:test-password@example.mongodb.net/murg_test?retryWrites=true&w=majority';

  assert.equal(getTestDatabaseName(uri), EXPECTED_TEST_DATABASE);
});

test('rejects missing, malformed, production, and unexpected test URIs', () => {
  assert.throws(() => getTestDatabaseName(), /MONGODB_TEST_URI is required/);
  assert.throws(() => getTestDatabaseName('not a MongoDB URI'), /valid MongoDB connection URI/);
  assert.throws(
    () => getTestDatabaseName('mongodb://localhost/murg'),
    /database must resolve exactly to murg_test/
  );
  assert.throws(
    () => getTestDatabaseName('mongodb://localhost/murg_production'),
    /database must resolve exactly to murg_test/
  );
  assert.throws(
    () => getTestDatabaseName('mongodb://localhost/murg_test?dbName=murg'),
    /database must resolve exactly to murg_test/
  );
});

test('calculates Lagos analytics periods across month and year boundaries', async () => {
  const bounds = await analyticsRepository.getDateBoundaries('2026-01-01');

  assert.deepEqual(bounds, {
    today: '2026-01-01',
    weekStart: '2025-12-29',
    weekEnd: '2026-01-04',
    monthStart: '2026-01-01',
    monthEnd: '2026-01-31',
    timezone: 'Africa/Lagos (+01:00)',
  });
});

test('rejects invalid analytics date parameters', async () => {
  await assert.rejects(analyticsRepository.getDateBoundaries('2026-02-30'), /valid calendar date/);
  await assert.rejects(analyticsRepository.getDateBoundaries('2026/02/28'), /YYYY-MM-DD/);
});

test('builds branch-scoped Mongo aggregation and preserves the analytics DTO', async () => {
  const originalAggregate = Order.aggregate;
  let pipeline;
  Order.aggregate = async (value) => {
    pipeline = value;
    return [{ das: 2, was: 5, mas: 12, das_normal: 1, das_debt: 1, was_normal: 4, was_debt: 1, mas_normal: 9, mas_debt: 3 }];
  };

  try {
    const bounds = await analyticsRepository.getDateBoundaries('2026-09-28');
    const metrics = await analyticsRepository.getSalesActivity({
      facilityID: 'MURG/007',
      date: bounds.today,
      weekStart: bounds.weekStart,
      weekEnd: bounds.weekEnd,
      monthStart: bounds.monthStart,
      monthEnd: bounds.monthEnd,
    });

    assert.equal(pipeline[0].$match.facilityID, 'MURG/007');
    assert.equal(pipeline[1].$group._id, '$orderID');
    assert.ok(pipeline[2].$group.das.$sum);
    assert.deepEqual(metrics, {
      das: 2,
      was: 5,
      mas: 12,
      breakdown: {
        daily: { normalSales: 1, debtSales: 1, total: 2 },
        weekly: { normalSales: 4, debtSales: 1, total: 5 },
        monthly: { normalSales: 9, debtSales: 3, total: 12 },
      },
    });
  } finally {
    Order.aggregate = originalAggregate;
  }
});

test('all active Mongo repositories expose the methods their controllers require', () => {
  for (const [name, repository, methods] of repositoryContracts) {
    for (const method of methods) {
      assert.equal(typeof repository[method], 'function', `${name} repository implements ${method}`);
    }
  }
});