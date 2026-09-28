const { connectDB, mongoose } = require('../src/config/mongodb');
const {
  User, Branch, Store, Stock, Customer, Order, Debt, Deposit,
  StockMovement, Shipment, Purchase, Expense, GoodsRequest,
  Notification, PasswordReset
} = require('../src/models');
require('dotenv').config();

function log(message) {
  console.log(`[VALIDATION] ${message}`);
}

async function validateRelationships() {
  await connectDB();
  log('STARTING RELATIONSHIP INTEGRITY VALIDATION');
  log('================================================\n');
  
  let totalErrors = 0;
  const errors = [];
  
  // Build ID maps once
  log('Building ID maps...');
  const stockDocs = await Stock.find({}).select('_id').lean();
  const stockIds = new Set(stockDocs.map(s => s._id.toString()));
  
  const customerDocs = await Customer.find({}).select('_id').lean();
  const customerIds = new Set(customerDocs.map(c => c._id.toString()));
  
  const userDocs = await User.find({}).select('_id').lean();
  const userIds = new Set(userDocs.map(u => u._id.toString()));
  
  const storeDocs = await Store.find({}).select('_id').lean();
  const storeIds = new Set(storeDocs.map(s => s._id.toString()));
  
  const shipmentDocs = await Shipment.find({}).select('_id').lean();
  const shipmentIds = new Set(shipmentDocs.map(s => s._id.toString()));
  
  log('ID maps built\n');
  
  // Validate Orders -> Stock
  log('Validating Orders -> Stock references...');
  const orders = await Order.find({ stockID: { $ne: null } }).select('orderID stockID').lean();
  let orderErrors = 0;
  for (const order of orders) {
    if (!stockIds.has(order.stockID.toString())) {
      errors.push(`Order ${order.orderID} references non-existent stock: ${order.stockID}`);
      orderErrors++;
    }
  }
  log(`  ${orderErrors} errors (out of ${orders.length} orders)`);
  totalErrors += orderErrors;
  
  // Validate Debts -> Customer
  log('Validating Debts -> Customer references...');
  const debts = await Debt.find({ customerID: { $ne: null } }).select('mysqlId customerID').lean();
  let debtErrors = 0;
  for (const debt of debts) {
    if (debt.customerID && !customerIds.has(debt.customerID.toString())) {
      errors.push(`Debt ${debt.mysqlId} references non-existent customer: ${debt.customerID}`);
      debtErrors++;
    }
  }
  log(`  ${debtErrors} errors (out of ${debts.length} debts)`);
  totalErrors += debtErrors;
  
  // Validate Deposits -> Customer
  log('Validating Deposits -> Customer references...');
  const deposits = await Deposit.find({ customerID: { $ne: null } }).select('mysqlId customerID').lean();
  let depositErrors = 0;
  for (const deposit of deposits) {
    if (deposit.customerID && !customerIds.has(deposit.customerID.toString())) {
      errors.push(`Deposit ${deposit.mysqlId} references non-existent customer: ${deposit.customerID}`);
      depositErrors++;
    }
  }
  log(`  ${depositErrors} errors (out of ${deposits.length} deposits)`);
  totalErrors += depositErrors;
  
  // Validate StockMovements -> Stock
  log('Validating StockMovements -> Stock references...');
  const stockMovements = await StockMovement.find({ stock_id: { $ne: null } }).select('mysqlId stock_id').lean();
  let stockMovementErrors = 0;
  for (const sm of stockMovements) {
    if (sm.stock_id && !stockIds.has(sm.stock_id.toString())) {
      errors.push(`StockMovement ${sm.mysqlId} references non-existent stock: ${sm.stock_id}`);
      stockMovementErrors++;
    }
  }
  log(`  ${stockMovementErrors} errors (out of ${stockMovements.length} stock movements)`);
  totalErrors += stockMovementErrors;
  
  // Validate Purchases -> Stock
  log('Validating Purchases -> Stock references...');
  const purchases = await Purchase.find({ stock_id: { $ne: null } }).select('mysqlId stock_id').lean();
  let purchaseErrors = 0;
  for (const purchase of purchases) {
    if (purchase.stock_id && !stockIds.has(purchase.stock_id.toString())) {
      errors.push(`Purchase ${purchase.mysqlId} references non-existent stock: ${purchase.stock_id}`);
      purchaseErrors++;
    }
  }
  log(`  ${purchaseErrors} errors (out of ${purchases.length} purchases)`);
  totalErrors += purchaseErrors;
  
  // Validate Shipments -> User
  log('Validating Shipments -> User references...');
  const shipments = await Shipment.find({}).select('tracking_number dispatched_by received_by created_by').lean();
  let shipmentErrors = 0;
  for (const shipment of shipments) {
    if (shipment.dispatched_by && !userIds.has(shipment.dispatched_by.toString())) {
      errors.push(`Shipment ${shipment.tracking_number} references non-existent dispatched_by user: ${shipment.dispatched_by}`);
      shipmentErrors++;
    }
    if (shipment.received_by && !userIds.has(shipment.received_by.toString())) {
      errors.push(`Shipment ${shipment.tracking_number} references non-existent received_by user: ${shipment.received_by}`);
      shipmentErrors++;
    }
    if (shipment.created_by && !userIds.has(shipment.created_by.toString())) {
      errors.push(`Shipment ${shipment.tracking_number} references non-existent created_by user: ${shipment.created_by}`);
      shipmentErrors++;
    }
  }
  log(`  ${shipmentErrors} errors (out of ${shipments.length} shipments)`);
  totalErrors += shipmentErrors;
  
  // Validate GoodsRequests -> User, Stock, Shipment
  log('Validating GoodsRequests -> User/Stock/Shipment references...');
  const goodsRequests = await GoodsRequest.find({}).select('request_code staff_id stock_id shipment_id reviewed_by').lean();
  let goodsRequestErrors = 0;
  for (const gr of goodsRequests) {
    if (gr.staff_id && !userIds.has(gr.staff_id.toString())) {
      errors.push(`GoodsRequest ${gr.request_code} references non-existent staff_id user: ${gr.staff_id}`);
      goodsRequestErrors++;
    }
    if (gr.stock_id && !stockIds.has(gr.stock_id.toString())) {
      errors.push(`GoodsRequest ${gr.request_code} references non-existent stock: ${gr.stock_id}`);
      goodsRequestErrors++;
    }
    if (gr.shipment_id && !shipmentIds.has(gr.shipment_id.toString())) {
      errors.push(`GoodsRequest ${gr.request_code} references non-existent shipment: ${gr.shipment_id}`);
      goodsRequestErrors++;
    }
    if (gr.reviewed_by && !userIds.has(gr.reviewed_by.toString())) {
      errors.push(`GoodsRequest ${gr.request_code} references non-existent reviewed_by user: ${gr.reviewed_by}`);
      goodsRequestErrors++;
    }
  }
  log(`  ${goodsRequestErrors} errors (out of ${goodsRequests.length} goods requests)`);
  totalErrors += goodsRequestErrors;
  
  // Validate Notifications -> User
  log('Validating Notifications -> User references...');
  const notifications = await Notification.find({ user_id: { $ne: null } }).select('mysqlId user_id').lean();
  let notificationErrors = 0;
  for (const notif of notifications) {
    if (notif.user_id && !userIds.has(notif.user_id.toString())) {
      errors.push(`Notification ${notif.mysqlId} references non-existent user: ${notif.user_id}`);
      notificationErrors++;
    }
  }
  log(`  ${notificationErrors} errors (out of ${notifications.length} notifications)`);
  totalErrors += notificationErrors;
  
  // Validate PasswordResets -> User
  log('Validating PasswordResets -> User references...');
  const passwordResets = await PasswordReset.find({ user_id: { $ne: null } }).select('mysqlId user_id').lean();
  let passwordResetErrors = 0;
  for (const pr of passwordResets) {
    if (pr.user_id && !userIds.has(pr.user_id.toString())) {
      errors.push(`PasswordReset ${pr.mysqlId} references non-existent user: ${pr.user_id}`);
      passwordResetErrors++;
    }
  }
  log(`  ${passwordResetErrors} errors (out of ${passwordResets.length} password resets)`);
  totalErrors += passwordResetErrors;
  
  // Validate Stock -> Store
  log('Validating Stock -> Store references...');
  const stocks = await Stock.find({ store_id: { $ne: null } }).select('mysqlId store_id').lean();
  let stockStoreErrors = 0;
  for (const stock of stocks) {
    if (stock.store_id && !storeIds.has(stock.store_id.toString())) {
      errors.push(`Stock ${stock.mysqlId} references non-existent store: ${stock.store_id}`);
      stockStoreErrors++;
    }
  }
  log(`  ${stockStoreErrors} errors (out of ${stocks.length} stocks)`);
  totalErrors += stockStoreErrors;
  
  // Validate StockMovement -> Store
  log('Validating StockMovement -> Store references...');
  const stockMovementsStore = await StockMovement.find({ store_id: { $ne: null } }).select('mysqlId store_id').lean();
  let stockMovementStoreErrors = 0;
  for (const sm of stockMovementsStore) {
    if (sm.store_id && !storeIds.has(sm.store_id.toString())) {
      errors.push(`StockMovement ${sm.mysqlId} references non-existent store: ${sm.store_id}`);
      stockMovementStoreErrors++;
    }
  }
  log(`  ${stockMovementStoreErrors} errors (out of ${stockMovementsStore.length} stock movements)`);
  totalErrors += stockMovementStoreErrors;
  
  log('\n================================================');
  log('RELATIONSHIP VALIDATION COMPLETE');
  log('================================================');
  log(`Total Errors: ${totalErrors}`);
  
  if (errors.length > 0) {
    log('\nError Details:');
    errors.forEach(err => log(`  - ${err}`));
  }
  
  log('\n================================================');
  log(`Status: ${totalErrors === 0 ? '✓ ALL RELATIONSHIPS VALID' : '✗ RELATIONSHIP ERRORS DETECTED'}`);
  log('================================================\n');
  
  await mongoose.connection.close();
  process.exit(totalErrors === 0 ? 0 : 1);
}

validateRelationships().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
