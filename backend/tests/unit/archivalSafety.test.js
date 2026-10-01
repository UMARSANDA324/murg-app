const test = require('node:test');
const assert = require('node:assert/strict');
const expenseRepository = require('../../src/repositories/expenseRepositoryMongo');
const branchRepository = require('../../src/repositories/branchRepositoryMongo');
const { Expense, Branch } = require('../../src/models');

test('expense archive updates the record and never permanently deletes it', async () => {
  const originalUpdateOne = Expense.updateOne;
  const originalDeleteOne = Expense.deleteOne;
  let update;
  let permanentDeleteCalled = false;
  Expense.updateOne = async (...args) => {
    update = args;
    return { modifiedCount: 1 };
  };
  Expense.deleteOne = async () => {
    permanentDeleteCalled = true;
    return { deletedCount: 1 };
  };

  try {
    const archived = await expenseRepository.archiveExpense(
      '64b000000000000000000001',
      'MURG/007',
      '64b000000000000000000002'
    );
    assert.equal(archived, true);
    assert.equal(update[0].isArchived.$ne, true);
    assert.equal(update[1].isArchived, true);
    assert.ok(update[1].archivedAt instanceof Date);
    assert.equal(permanentDeleteCalled, false);
  } finally {
    Expense.updateOne = originalUpdateOne;
    Expense.deleteOne = originalDeleteOne;
  }
});

test('branch status changes are status updates, not branch deletion', async () => {
  const originalUpdateOne = Branch.updateOne;
  const originalDeleteOne = Branch.deleteOne;
  let update;
  let permanentDeleteCalled = false;
  Branch.updateOne = async (...args) => {
    update = args;
    return { matchedCount: 1 };
  };
  Branch.deleteOne = async () => {
    permanentDeleteCalled = true;
    return { deletedCount: 1 };
  };

  try {
    const updated = await branchRepository.setStatus('MURG/007', 'inactive');
    assert.equal(updated, true);
    assert.deepEqual(update[0], { facilityID: 'MURG/007' });
    assert.deepEqual(update[1], { status: 'inactive' });
    assert.equal(permanentDeleteCalled, false);
  } finally {
    Branch.updateOne = originalUpdateOne;
    Branch.deleteOne = originalDeleteOne;
  }
});
