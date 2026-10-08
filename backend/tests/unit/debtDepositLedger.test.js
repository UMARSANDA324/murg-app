const test = require('node:test');
const assert = require('node:assert/strict');
const customerRepository = require('../../src/repositories/customerRepositoryMongo');
const { Customer, Debt, Deposit, Counter, CustomerCredit, CustomerCreditTransaction } = require('../../src/models');
const { mongoose } = require('../../src/config/mongodb');

test('recordDeposit accurately calculates previous_balance, new_balance, and updates Debt balance', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  // Mock Customer.findOne
  const origCustomerFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => ({
      lean: async () => ({ _id: fakeCustomerId, name: 'Alhaji Test', facilityID: fakeFacilityId })
    })
  });

  // Mock Debt.findOne with 100,000 balance
  const origDebtFindOne = Debt.findOne;
  let savedDebt = null;
  Debt.findOne = () => ({
    session: async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerID: fakeCustomerId,
      facilityID: fakeFacilityId,
      balance: 100000,
      last_payment: 0,
      save: async function () { savedDebt = this; return this; }
    })
  });

  // Mock CustomerCredit.findOne
  const origCustomerCreditFindOne = CustomerCredit.findOne;
  CustomerCredit.findOne = () => ({
    session: async () => null
  });

  // Mock Deposit.findOne & Counter.findOne for reserveLegacyIds
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

  // Mock Deposit.create
  const origDepositCreate = Deposit.create;
  let createdDeposit = null;
  Deposit.create = async (docs) => {
    createdDeposit = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  // Mock mongoose transaction session
  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  try {
    const result = await customerRepository.recordDeposit({
      facilityID: fakeFacilityId,
      customerId: fakeCustomerId.toString(),
      amount: 30000,
      paymentMethod: 'Bank Transfer',
      description: 'Part payment',
      processedByName: 'Bilya staff',
    });

    assert.equal(result.amount, 30000);
    assert.equal(result.previous_balance, 100000);
    assert.equal(result.new_balance, 70000);
    assert.equal(result.remainingBalance, 70000);
    assert.equal(result.customerName, 'Alhaji Test');

    assert.equal(createdDeposit.previous_balance, 100000);
    assert.equal(createdDeposit.new_balance, 70000);
    assert.equal(createdDeposit.amount, 30000);

    assert.equal(savedDebt.balance, 70000);
    assert.equal(savedDebt.last_payment, 30000);
  } finally {
    Customer.findOne = origCustomerFindOne;
    Debt.findOne = origDebtFindOne;
    CustomerCredit.findOne = origCustomerCreditFindOne;
    Deposit.findOne = origDepositFindOne;
    Counter.findOne = origCounterFindOne;
    Counter.updateOne = origCounterUpdateOne;
    Deposit.create = origDepositCreate;
    mongoose.startSession = origStartSession;
  }
});

test('recordDeposit when fully paying debt brings balance to exactly 0', async () => {
  const fakeCustomerId = new mongoose.Types.ObjectId();
  const fakeFacilityId = 'MURG/001';

  const origCustomerFindOne = Customer.findOne;
  Customer.findOne = () => ({
    session: () => ({
      lean: async () => ({ _id: fakeCustomerId, name: 'Alhaji Full Pay', facilityID: fakeFacilityId })
    })
  });

  const origDebtFindOne = Debt.findOne;
  let savedDebt = null;
  Debt.findOne = () => ({
    session: async () => ({
      _id: new mongoose.Types.ObjectId(),
      customerID: fakeCustomerId,
      facilityID: fakeFacilityId,
      balance: 70000,
      save: async function () { savedDebt = this; return this; }
    })
  });

  const origCustomerCreditFindOne = CustomerCredit.findOne;
  CustomerCredit.findOne = () => ({
    session: async () => null
  });

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
  let createdDeposit = null;
  Deposit.create = async (docs) => {
    createdDeposit = docs[0];
    return [{ _id: new mongoose.Types.ObjectId(), ...docs[0] }];
  };

  const origStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  try {
    const result = await customerRepository.recordDeposit({
      facilityID: fakeFacilityId,
      customerId: fakeCustomerId.toString(),
      amount: 70000,
      paymentMethod: 'Cash',
      description: 'Complete clearance',
      processedByName: 'Bilya staff',
    });

    assert.equal(result.amount, 70000);
    assert.equal(result.previous_balance, 70000);
    assert.equal(result.new_balance, 0);
    assert.equal(result.remainingBalance, 0);

    assert.equal(createdDeposit.previous_balance, 70000);
    assert.equal(createdDeposit.new_balance, 0);
    assert.equal(savedDebt.balance, 0);
  } finally {
    Customer.findOne = origCustomerFindOne;
    Debt.findOne = origDebtFindOne;
    CustomerCredit.findOne = origCustomerCreditFindOne;
    Deposit.findOne = origDepositFindOne;
    Counter.findOne = origCounterFindOne;
    Counter.updateOne = origCounterUpdateOne;
    Deposit.create = origDepositCreate;
    mongoose.startSession = origStartSession;
  }
});


