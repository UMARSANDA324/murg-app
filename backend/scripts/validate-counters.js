require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/mongodb');
const Counter = require('../src/models/Counter');
const {
  User, Branch, Store, Stock, Customer, Order, Debt, Deposit,
  StockMovement, Shipment, Purchase, Expense, GoodsRequest,
  Notification, PasswordReset
} = require('../src/models');

function log(message) {
  console.log(`[COUNTER VALIDATION] ${message}`);
}

async function validateCounters() {
  await connectDB();
  log('STARTING COUNTER/SEQUENCE VALIDATION');
  log('================================================\n');
  
  // Check Counter collection
  log('Checking Counter collection...');
  const counter = await Counter.findOne({ name: 'facilityID' });
  if (counter) {
    log(`  Counter name: ${counter.name}`);
    log(`  Last ID: ${counter.lastID}`);
    log(`  MySQL ID: ${counter.mysqlId}`);
  } else {
    log(`  Counter not found`);
  }
  
  // Check highest mysqlId values across all collections
  log('\nChecking highest MySQL IDs across collections...');
  
  const collections = [
    { name: 'Users', model: User },
    { name: 'Branches', model: Branch },
    { name: 'Stores', model: Store },
    { name: 'Stocks', model: Stock },
    { name: 'Customers', model: Customer },
    { name: 'Orders', model: Order },
    { name: 'Debts', model: Debt },
    { name: 'Deposits', model: Deposit },
    { name: 'StockMovements', model: StockMovement },
    { name: 'Purchases', model: Purchase },
    { name: 'Expenses', model: Expense },
    { name: 'Shipments', model: Shipment },
    { name: 'GoodsRequests', model: GoodsRequest },
    { name: 'Notifications', model: Notification },
    { name: 'PasswordResets', model: PasswordReset },
  ];
  
  let issues = [];
  
  for (const { name, model } of collections) {
    try {
      const maxDoc = await model.findOne({}).sort({ mysqlId: -1 }).select('mysqlId').lean();
      if (maxDoc && maxDoc.mysqlId) {
        log(`  ${name.padEnd(20)} Max mysqlId: ${maxDoc.mysqlId}`);
        
        // Check if counter lastID is higher than all mysqlIds
        if (counter && counter.lastID && counter.lastID < maxDoc.mysqlId) {
          issues.push(`Counter lastID (${counter.lastID}) is less than ${name} max mysqlId (${maxDoc.mysqlId})`);
        }
      } else {
        log(`  ${name.padEnd(20)} No mysqlId field or empty collection`);
      }
    } catch (error) {
      log(`  ${name.padEnd(20)} Error: ${error.message}`);
    }
  }
  
  log('\n================================================');
  log('COUNTER VALIDATION COMPLETE');
  log('================================================');
  
  if (issues.length > 0) {
    log('\nIssues detected:');
    issues.forEach(issue => log(`  ✗ ${issue}`));
    log('\nAction required: Update counter.lastID to be higher than all migrated mysqlIds');
  } else {
    log('\nNo counter collision issues detected');
    if (counter) {
      log(`Counter lastID (${counter.lastID}) is safe for future writes`);
    }
  }
  
  log('================================================\n');
  
  await mongoose.connection.close();
  process.exit(issues.length > 0 ? 1 : 0);
}

validateCounters().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
