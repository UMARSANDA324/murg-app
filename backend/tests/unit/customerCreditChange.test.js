const test = require('node:test');
const assert = require('node:assert/strict');
const customerRepository = require('../../src/repositories/customerRepositoryMongo');
const salesRepository = require('../../src/repositories/salesRepositoryMongo');
const { Customer, Debt, Deposit, Counter, CustomerCredit, CustomerCreditTransaction, Branch, Stock, Order, StockMovement } = require('../../src/models');
const { mongoose } = require('../../src/config/mongodb');

test('recordDeposit with overpayment clears debt to 0 and adds excess to customer credit', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  // Customer mock
  const origCustomerFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => ({
      lean: async () => ({ _id: fakeCustomerId, name: 'Alhaji Overpay', facilityID: fakeFacilityId })
    })
  });

  // Debt mock with 50,000 balance
  const origDebtFindOne = Debt.findOne;
  let savedDebt = null;
  Debt.findOne = () => ({
    session: async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerID: fakeCustomerId,
      facilityID: fakeFacilityId,
      balance: 50000,
      last_payment: 0,
      save: async function () { savedDebt = this; return this; }
    })
  });

  // CustomerCredit mock
  const origCreditFindOne = CustomerCredit.findOne;
  const origCreditCreate = CustomerCredit.create;
  const origCreditTxCreate = CustomerCreditTransaction.create;
  let createdCredit = null;
  let createdCreditTx = null;

  CustomerCredit.findOne = () => ({
    session: async () => null
  });
  CustomerCredit.create = async (docs) => {
    createdCredit = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };
  CustomerCreditTransaction.create = async (docs) => {
    createdCreditTx = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  // Deposit mocks
  const origDepositFindOne = Deposit.findOne;
  Deposit.findOne = () => ({
    sort: () => ({ select: () => ({ lean: () => ({ session: async () => ({ mysqlId: 10 }) }) }) })
  });
  const origCounterFindOne = Counter.findOne;
  Counter.findOne = () => ({
    lean: () => ({ session: async () => ({ lastID: 10 }) }),
    sort: () => ({ select: () => ({ lean: () => ({ session: async () => ({ mysqlId: 1 }) }) }) })
  });
  const origCounterUpdateOne = Counter.updateOne;
  Counter.updateOne = async () => ({ matchedCount: 1 });
  const origDepositCreate = Deposit.create;
  Deposit.create = async (docs) => [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  try {
    // Customer pays 80,000 for a 50,000 debt -> 30,000 change credit
    const result = await customerRepository.recordDeposit({
      facilityID: fakeFacilityId,
      customerId: fakeCustomerId.toString(),
      amount: 80000,
      paymentMethod: 'Cash',
      description: 'Overpayment test',
      processedByName: 'Cashier 1',
    });

    assert.equal(result.amount, 80000);
    assert.equal(result.previous_balance, 50000);
    assert.equal(result.new_balance, 0);
    assert.equal(result.remainingBalance, 0);
    assert.equal(result.debt_cleared, 50000);
    assert.equal(result.overpayment, 30000);
    assert.equal(result.credit_balance_after, 30000);

    assert.equal(savedDebt.balance, 0);
    assert.equal(createdCredit.balance, 30000);
    assert.equal(createdCredit.total_credited, 30000);

    assert.equal(createdCreditTx.transaction_type, 'OVERPAYMENT_DEPOSIT');
    assert.equal(createdCreditTx.amount, 30000);
    assert.equal(createdCreditTx.previous_balance, 0);
    assert.equal(createdCreditTx.new_balance, 30000);
  } finally {
    Customer.findOne = origCustomerFindOne;
    Debt.findOne = origDebtFindOne;
    CustomerCredit.findOne = origCreditFindOne;
    CustomerCredit.create = origCreditCreate;
    CustomerCreditTransaction.create = origCreditTxCreate;
    Deposit.findOne = origDepositFindOne;
    Counter.findOne = origCounterFindOne;
    Counter.updateOne = origCounterUpdateOne;
    Deposit.create = origDepositCreate;
    mongoose.startSession = origStartSession;
  }
});

test('collectChange safely deducts from customer credit and creates audit transaction', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  const origCustomerFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => ({
      lean: async () => ({ _id: fakeCustomerId, name: 'Alhaji Collector', facilityID: fakeFacilityId, phone: '08012345678' })
    })
  });

  const origCreditFindOne = CustomerCredit.findOne;
  const origCreditTxCreate = CustomerCreditTransaction.create;
  let savedCredit = null;
  let createdCreditTx = null;

  CustomerCredit.findOne = () => ({
    session: async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerID: fakeCustomerId,
      facilityID: fakeFacilityId,
      balance: 30000,
      total_collected: 0,
      save: async function () { savedCredit = this; return this; }
    })
  });

  CustomerCreditTransaction.create = async (docs) => {
    createdCreditTx = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  try {
    const result = await customerRepository.collectChange({
      facilityID: fakeFacilityId,
      customerId: fakeCustomerId.toString(),
      amount: 10000,
      paymentMethod: 'Cash',
      notes: 'Customer picked up 10k cash',
      processedByName: 'Cashier 2',
    });

    assert.equal(result.amount_collected, 10000);
    assert.equal(result.previous_change, 30000);
    assert.equal(result.remaining_change, 20000);
    assert.equal(result.customer_name, 'Alhaji Collector');

    assert.equal(savedCredit.balance, 20000);
    assert.equal(savedCredit.total_collected, 10000);

    assert.equal(createdCreditTx.transaction_type, 'CASH_COLLECTED');
    assert.equal(createdCreditTx.amount, 10000);
    assert.equal(createdCreditTx.previous_balance, 30000);
    assert.equal(createdCreditTx.new_balance, 20000);
  } finally {
    Customer.findOne = origCustomerFindOne;
    CustomerCredit.findOne = origCreditFindOne;
    CustomerCreditTransaction.create = origCreditTxCreate;
    mongoose.startSession = origStartSession;
  }
});

test('collectChange rejects requests exceeding available credit balance', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  const origCustomerFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => ({
      lean: async () => ({ _id: fakeCustomerId, name: 'Alhaji Insufficient', facilityID: fakeFacilityId })
    })
  });

  const origCreditFindOne = CustomerCredit.findOne;
  CustomerCredit.findOne = () => ({
    session: async () => ({
      balance: 5000,
    })
  });

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  try {
    await assert.rejects(
      async () => {
        await customerRepository.collectChange({
          facilityID: fakeFacilityId,
          customerId: fakeCustomerId.toString(),
          amount: 15000,
          processedByName: 'Cashier 1',
        });
      },
      /Insufficient customer credit/
    );
  } finally {
    Customer.findOne = origCustomerFindOne;
    CustomerCredit.findOne = origCreditFindOne;
    mongoose.startSession = origStartSession;
  }
});

test('atomicCheckout applies customer credit and decreases change balance', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeStockId = new mongoose.Types.ObjectId();
  const fakeStoreId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  // Mock Branch
  const origBranchFindOne = Branch.findOne;
  Branch.findOne = () => ({
    session: () => ({
      lean: async () => ({ facilityID: fakeFacilityId, sales_mode: 'PER_PIECE' })
    })
  });

  // Mock Customer
  const origCustomerExists = Customer.exists;
  Customer.exists = () => ({
    session: async () => true
  });

  // Mock Stock
  const origStockFindOne = Stock.findOne;
  const origStockUpdateOne = Stock.updateOne;
  Stock.findOne = () => ({
    session: () => ({
      lean: async () => ({
        _id: fakeStockId,
        name: 'Super Lace',
        store_id: fakeStoreId,
        unit_type: 'piece',
        selling: 20000,
        quantity: 10,
      })
    })
  });
  Stock.updateOne = async () => ({ matchedCount: 1 });

  // Mock CustomerCredit
  const origCreditFindOne = CustomerCredit.findOne;
  const origCreditTxCreate = CustomerCreditTransaction.create;
  let savedCredit = null;
  let createdCreditTx = null;

  CustomerCredit.findOne = () => ({
    session: async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerID: fakeCustomerId,
      facilityID: fakeFacilityId,
      balance: 50000,
      total_used_goods: 0,
      save: async function () { savedCredit = this; return this; }
    })
  });

  CustomerCreditTransaction.create = async (docs) => {
    createdCreditTx = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  // Mock Legacy Id Service (Counter, Order, StockMovement)
  const origOrderFindOne = Order.findOne;
  const origStockMovementFindOne = StockMovement.findOne;
  const origCounterFindOne = Counter.findOne;
  const origCounterUpdateOne = Counter.updateOne;

  Order.findOne = () => ({ sort: () => ({ select: () => ({ lean: () => ({ session: async () => ({ mysqlId: 10 }) }) }) }) });
  StockMovement.findOne = () => ({ sort: () => ({ select: () => ({ lean: () => ({ session: async () => ({ mysqlId: 10 }) }) }) }) });
  Counter.findOne = () => ({
    lean: () => ({ session: async () => ({ lastID: 10 }) }),
    sort: () => ({ select: () => ({ lean: () => ({ session: async () => ({ mysqlId: 1 }) }) }) })
  });
  Counter.updateOne = async () => ({ matchedCount: 1 });

  const origOrderCreate = Order.create;
  let createdOrder = null;
  Order.create = async (docs) => {
    createdOrder = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  const origStockMovementCreate = StockMovement.create;
  StockMovement.create = async (docs) => [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    startTransaction: () => {},
    commitTransaction: async () => {},
    abortTransaction: async () => {},
    endSession: async () => {},
  });

  try {
    // Buy 2 pieces of 20,000 = 40,000. Apply 40,000 change credit.
    const result = await salesRepository.atomicCheckout({
      facilityID: fakeFacilityId,
      staffID: new mongoose.Types.ObjectId(),
      staffName: 'Sales Staff 1',
      items: [{ stockId: fakeStockId.toString(), quantity: 2, price: 20000 }],
      buyerName: 'Alhaji Buyer',
      customerName: 'Alhaji Buyer',
      customerID: fakeCustomerId.toString(),
      creditUsed: 40000,
      payment: { cash: 0, pos: 0, transfer: 0 },
      isCredit: false,
    });

    assert.equal(result.netTotal, 40000);
    assert.equal(result.creditApplied, 40000);
    assert.equal(result.amountPaid, 0);

    assert.equal(savedCredit.balance, 10000);
    assert.equal(savedCredit.total_used_goods, 40000);

    assert.equal(createdCreditTx.transaction_type, 'USED_FOR_PURCHASE');
    assert.equal(createdCreditTx.amount, 40000);
    assert.equal(createdCreditTx.previous_balance, 50000);
    assert.equal(createdCreditTx.new_balance, 10000);

    assert.equal(createdOrder.credit_applied, 40000);
    assert.equal(createdOrder.customer_credit_before, 50000);
    assert.equal(createdOrder.customer_credit_after, 10000);
    assert.equal(createdOrder.payment, 'Customer Credit');
  } finally {
    Branch.findOne = origBranchFindOne;
    Customer.exists = origCustomerExists;
    Stock.findOne = origStockFindOne;
    Stock.updateOne = origStockUpdateOne;
    CustomerCredit.findOne = origCreditFindOne;
    CustomerCreditTransaction.create = origCreditTxCreate;
    Order.findOne = origOrderFindOne;
    StockMovement.findOne = origStockMovementFindOne;
    Counter.findOne = origCounterFindOne;
    Counter.updateOne = origCounterUpdateOne;
    Order.create = origOrderCreate;
    StockMovement.create = origStockMovementCreate;
    mongoose.startSession = origStartSession;
  }
});

