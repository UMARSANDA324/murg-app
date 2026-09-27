const db = require('../src/config/database');

async function testExpenseAPI() {
  console.log('=== Testing Expense API ===\n');

  try {
    // Test 1: Create expense
    console.log('Test 1: Creating expense...');
    const [result] = await db.query(
      'INSERT INTO expense (facilityID, item, price, type) VALUES (?, ?, ?, ?)',
      ['MURG/001', 'Test API Expense', 1500.00, 'in']
    );
    const expenseId = result.insertId;
    console.log(`✓ Expense created with ID: ${expenseId}`);

    // Test 2: Read expense
    console.log('\nTest 2: Reading expense...');
    const [rows] = await db.query(
      'SELECT * FROM expense WHERE id = ?',
      [expenseId]
    );
    const expense = rows[0];
    console.log(`✓ Expense found: ${expense.item}, ₦${expense.price}, ${expense.type}`);

    // Test 3: Update expense
    console.log('\nTest 3: Updating expense...');
    await db.query(
      'UPDATE expense SET item = ?, price = ? WHERE id = ?',
      ['Updated Test Expense', 2000.00, expenseId]
    );
    console.log('✓ Expense updated');

    // Test 4: Get totals
    console.log('\nTest 4: Getting expense totals...');
    const [totals] = await db.query(
      `SELECT 
        SUM(CASE WHEN type = 'in' THEN price ELSE 0 END) as total_in,
        SUM(CASE WHEN type = 'out' THEN price ELSE 0 END) as total_out
      FROM expense WHERE facilityID = ?`,
      ['MURG/001']
    );
    console.log(`✓ Totals: In = ₦${totals[0].total_in || 0}, Out = ₦${totals[0].total_out || 0}`);

    // Test 5: Delete expense
    console.log('\nTest 5: Deleting expense...');
    await db.query('DELETE FROM expense WHERE id = ?', [expenseId]);
    console.log('✓ Expense deleted');

    console.log('\n=== All Expense API Tests Passed ===');
  } catch (err) {
    console.error('✗ Test failed:', err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

testExpenseAPI();
