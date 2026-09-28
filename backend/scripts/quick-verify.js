const { connectDB, mongoose } = require('../src/config/mongodb');
const {
  User, Branch, Store, Stock, Customer, Order, Debt, Deposit,
  StockMovement, Shipment, Purchase, Expense, GoodsRequest,
  Notification, PasswordReset, Counter
} = require('../src/models');
require('dotenv').config();

function log(message) {
  console.log(`[VALIDATION] ${message}`);
}

async function quickVerify() {
  log('QUICK MONGODB DATA VERIFICATION');
  log('================================================\n');
  
  await connectDB();
  log('Connected to MongoDB\n');
  
  const collections = [
    { name: 'Counter', model: Counter, expected: 1 },
    { name: 'Users', model: User, expected: 3 },
    { name: 'Branches', model: Branch, expected: 3 },
    { name: 'Stores', model: Store, expected: 3 },
    { name: 'Stocks', model: Stock, expected: 278 },
    { name: 'Customers', model: Customer, expected: 63 },
    { name: 'Debts', model: Debt, expected: 60 },
    { name: 'Deposits', model: Deposit, expected: 776 },
    { name: 'Orders', model: Order, expected: 1465 },
    { name: 'StockMovements', model: StockMovement, expected: 50 },
    { name: 'Purchases', model: Purchase, expected: 559 },
    { name: 'Expenses', model: Expense, expected: 171 },
    { name: 'Shipments', model: Shipment, expected: 17 },
    { name: 'GoodsRequests', model: GoodsRequest, expected: 13 },
    { name: 'Notifications', model: Notification, expected: 6 },
    { name: 'PasswordResets', model: PasswordReset, expected: 12 },
  ];
  
  let allMatch = true;
  let totalDocs = 0;
  
  for (const { name, model, expected } of collections) {
    try {
      const count = await model.countDocuments();
      totalDocs += count;
      const match = count === expected;
      if (!match) allMatch = false;
      console.log(`${name.padEnd(20)} Expected: ${String(expected).padStart(6)}  Actual: ${String(count).padStart(6)}  ${match ? '✓' : '✗'}`);
    } catch (error) {
      console.log(`${name.padEnd(20)} Expected: ${String(expected).padStart(6)}  Actual: ERROR  ✗`);
      allMatch = false;
    }
  }
  
  log('\n================================================');
  log(`Total Documents: ${totalDocs}`);
  log(`Status: ${allMatch ? '✓ ALL COUNTS MATCH' : '✗ COUNT MISMATCH'}`);
  log('================================================\n');
  
  await mongoose.connection.close();
  process.exit(allMatch ? 0 : 1);
}

quickVerify().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
