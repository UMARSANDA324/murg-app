const test = require('node:test');
const assert = require('node:assert/strict');
const stockRepository = require('../../src/repositories/stockRepositoryMongo');
const { Stock } = require('../../src/models');

function queryFor(rows) {
  return {
    populate() { return this; },
    sort() { return this; },
    lean: async () => rows,
  };
}

test('stock list normalizes optional numeric fields and filters cost for non-Admins', async () => {
  const originalFind = Stock.find;
  Stock.find = () => queryFor([{
    _id: { toString: () => 'stock-id' },
    name: 'Legacy Stock',
    facilityID: 'MURG/007',
    quantity: null,
    selling: null,
    price_per_yard: null,
    yards_per_belt: null,
    buying: 125,
    Bsubtotal: 250,
    store_id: null,
  }]);

  try {
    const [stock] = await stockRepository.findAll({
      facilityID: 'MURG/007',
      includeCost: false,
    });

    assert.equal(stock.id, 'stock-id');
    assert.equal(stock.quantity, 0);
    assert.equal(stock.selling, 0);
    assert.equal(stock.price_per_yard, null);
    assert.equal(stock.yards_per_belt, null);
    assert.equal(Object.hasOwn(stock, 'buying'), false);
    assert.equal(Object.hasOwn(stock, 'Bsubtotal'), false);
  } finally {
    Stock.find = originalFind;
  }
});

test('Admin stock list returns numeric cost values even when legacy cost is missing', async () => {
  const originalFind = Stock.find;
  Stock.find = () => queryFor([{
    _id: { toString: () => 'stock-id' },
    name: 'Legacy Stock',
    facilityID: 'MURG/007',
    quantity: 2,
    selling: 100,
    price_per_yard: null,
    yards_per_belt: 100,
    store_id: null,
  }]);

  try {
    const [stock] = await stockRepository.findAll({
      facilityID: 'MURG/007',
      includeCost: true,
    });

    assert.equal(stock.buying, 0);
    assert.equal(stock.Bsubtotal, 0);
    assert.equal(typeof stock.selling, 'number');
    assert.equal(typeof stock.quantity, 'number');
  } finally {
    Stock.find = originalFind;
  }
});
