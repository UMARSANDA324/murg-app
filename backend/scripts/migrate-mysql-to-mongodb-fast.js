const mysql = require('mysql2/promise');
const { connectDB, mongoose } = require('../src/config/mongodb');
const {
  User, Branch, Store, Stock, Customer, Order, Debt, Deposit,
  StockMovement, Shipment, Purchase, Expense, GoodsRequest,
  Notification, PasswordReset, ShipmentReceipt, AuditLog, Counter
} = require('../src/models');
require('dotenv').config();

// MySQL connection pool
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'murg',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

// Migration statistics
const stats = {
  success: [],
  failed: [],
  totals: {},
  startTime: Date.now(),
};

const BATCH_SIZE = 1000; // Process 1000 records at a time

function log(message) {
  console.log(`[MIGRATION] ${message}`);
}

function formatNumber(num) {
  return Number(num).toLocaleString();
}

// Get MySQL row count
async function getMySQLCount(table) {
  try {
    const [rows] = await mysqlPool.query(`SELECT COUNT(*) as count FROM ${table}`);
    return rows[0].count;
  } catch (error) {
    return 0;
  }
}

// Get MongoDB document count
async function getMongoCount(Model) {
  try {
    return await Model.countDocuments();
  } catch (error) {
    return 0;
  }
}

// Build ID lookup map (mysqlId -> MongoDB ObjectId)
async function buildIdMap(Model, mysqlIdField = 'mysqlId') {
  const docs = await Model.find({}).select('_id ' + mysqlIdField).lean();
  const map = new Map();
  docs.forEach(doc => {
    map.set(doc[mysqlIdField], doc._id);
  });
  return map;
}

// Clear all existing MongoDB data (for clean migration)
async function clearAllData() {
  log('Clearing existing MongoDB data...');
  await User.deleteMany({});
  await Branch.deleteMany({});
  await Store.deleteMany({});
  await Stock.deleteMany({});
  await Customer.deleteMany({});
  await Debt.deleteMany({});
  await Deposit.deleteMany({});
  await Order.deleteMany({});
  await StockMovement.deleteMany({});
  await Purchase.deleteMany({});
  await Expense.deleteMany({});
  await Shipment.deleteMany({});
  await GoodsRequest.deleteMany({});
  await Notification.deleteMany({});
  await PasswordReset.deleteMany({});
  await ShipmentReceipt.deleteMany({});
  await AuditLog.deleteMany({});
  await Counter.deleteMany({});
  log('✓ All collections cleared');
}

// Migrate Counter
async function migrateCounter() {
  log('Migrating counter...');
  const mysqlCount = await getMySQLCount('conca');
  if (mysqlCount === 0) {
    log('[SKIP] conca — 0 rows');
    return;
  }
  
  const [rows] = await mysqlPool.query('SELECT * FROM conca');
  const docs = rows.map(row => ({
    name: 'facilityID',
    lastID: row.lastID,
    mysqlId: row.id,
  }));
  
  await Counter.insertMany(docs);
  stats.totals.counter = docs.length;
  stats.success.push('Counter');
  log(`✓ Migrated ${formatNumber(docs.length)} counter records`);
}

// Migrate Users
async function migrateUsers() {
  log('Migrating users (facility)...');
  const mysqlCount = await getMySQLCount('facility');
  if (mysqlCount === 0) {
    log('[SKIP] facility — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM facility LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      facilityID: row.facilityID,
      name: row.name,
      fname: row.fname,
      email: row.email,
      phone: row.phone,
      role: row.role,
      status: row.status,
      password: row.password,
      password_hash: row.password_hash,
      permissions: row.permissions ? JSON.parse(row.permissions) : ['*'],
    }));
    
    await User.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[users] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.users = totalMigrated;
  stats.success.push('Users');
  log(`✓ Migrated ${formatNumber(totalMigrated)} users`);
}

// Migrate Branches
async function migrateBranches() {
  log('Migrating branches...');
  const mysqlCount = await getMySQLCount('branch');
  if (mysqlCount === 0) {
    log('[SKIP] branch — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM branch LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      facilityID: row.facilityID,
      name: row.name,
      address: row.address,
      phone: row.phone,
      status: row.status || 'active',
      sales_mode: row.sales_mode || 'DEALER',
      createdAt: row.created_at || new Date(),
    }));
    
    await Branch.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[branches] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.branches = totalMigrated;
  stats.success.push('Branches');
  log(`✓ Migrated ${formatNumber(totalMigrated)} branches`);
}

// Migrate Stores
async function migrateStores() {
  log('Migrating stores...');
  const mysqlCount = await getMySQLCount('stores');
  if (mysqlCount === 0) {
    log('[SKIP] stores — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM stores LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      store_name: row.store_name,
      branch_id: row.branch_id,
      status: row.status || 'active',
    }));
    
    await Store.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[stores] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.stores = totalMigrated;
  stats.success.push('Stores');
  log(`✓ Migrated ${formatNumber(totalMigrated)} stores`);
}

// Migrate Stocks
async function migrateStocks() {
  log('Migrating stocks...');
  const mysqlCount = await getMySQLCount('stocks');
  if (mysqlCount === 0) {
    log('[SKIP] stocks — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  // Build store ID map
  const storeMap = await buildIdMap(Store);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM stocks LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      name: row.name,
      facilityID: row.facilityID,
      store_id: row.store_id ? storeMap.get(row.store_id) : null,
      quantity: parseFloat(row.quantity) || 0,
      buying: parseFloat(row.buying) || 0,
      selling: parseFloat(row.selling) || 0,
      unit_type: row.unit_type || 'belt',
      price_per_yard: row.price_per_yard ? parseFloat(row.price_per_yard) : null,
      yards_per_belt: row.yards_per_belt ? parseFloat(row.yards_per_belt) : 100,
      status: row.status || 'active',
      out_stocks: parseFloat(row.out_stocks) || 0,
    }));
    
    await Stock.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[stocks] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.stocks = totalMigrated;
  stats.success.push('Stocks');
  log(`✓ Migrated ${formatNumber(totalMigrated)} stocks`);
}

// Migrate Customers
async function migrateCustomers() {
  log('Migrating customers...');
  const mysqlCount = await getMySQLCount('customers');
  if (mysqlCount === 0) {
    log('[SKIP] customers — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM customers LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      name: row.name,
      phone: row.phone,
      facilityID: row.facilityID,
      address: row.address,
    }));
    
    await Customer.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[customers] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.customers = totalMigrated;
  stats.success.push('Customers');
  log(`✓ Migrated ${formatNumber(totalMigrated)} customers`);
}

// Migrate Debts
async function migrateDebts() {
  log('Migrating debts (outstand)...');
  const mysqlCount = await getMySQLCount('outstand');
  if (mysqlCount === 0) {
    log('[SKIP] outstand — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  // Build customer ID map
  const customerMap = await buildIdMap(Customer);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM outstand LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      customerID: customerMap.get(row.customerID) || null,
      facilityID: row.facilityID,
      balance: parseFloat(row.balance) || 0,
      last_payment: parseFloat(row.last_payment) || 0,
      last_payment_date: row.last_payment_date,
    }));
    
    await Debt.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[debts] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.debts = totalMigrated;
  stats.success.push('Debts');
  log(`✓ Migrated ${formatNumber(totalMigrated)} debt records`);
}

// Migrate Deposits
async function migrateDeposits() {
  log('Migrating deposits (deposit_history)...');
  const mysqlCount = await getMySQLCount('deposit_history');
  if (mysqlCount === 0) {
    log('[SKIP] deposit_history — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  // Build customer ID map
  const customerMap = await buildIdMap(Customer);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM deposit_history LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      customerID: customerMap.get(row.customerID) || null,
      facilityID: row.facilityID,
      amount: parseFloat(row.amount) || 0,
      payment_date: row.payment_date || new Date(),
      receipt_number: row.receipt_number,
    }));
    
    await Deposit.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[deposits] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.deposits = totalMigrated;
  stats.success.push('Deposits');
  log(`✓ Migrated ${formatNumber(totalMigrated)} deposit records`);
}

// Migrate Orders
async function migrateOrders() {
  log('Migrating orders...');
  const mysqlCount = await getMySQLCount('orders');
  if (mysqlCount === 0) {
    log('[SKIP] orders — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  // Build ID maps
  const stockMap = await buildIdMap(Stock);
  const customerMap = await buildIdMap(Customer);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM orders LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      orderID: row.orderID,
      facilityID: row.facilityID,
      stockID: stockMap.get(row.stockID) || null,
      item: row.item,
      quantity: parseFloat(row.quantity) || 0,
      subtotal: parseFloat(row.subtotal) || 0,
      net_total: parseFloat(row.net_total) || 0,
      buyer_name: row.buyer_name,
      customer_name: row.customer_name,
      customerID: row.customerID ? customerMap.get(row.customerID) : null,
      payment: row.payment,
      discount: parseFloat(row.discount) || 0,
      amount_paid: parseFloat(row.amount_paid) || 0,
      cash: parseFloat(row.cash) || 0,
      pos: parseFloat(row.pos) || 0,
      transfer: parseFloat(row.transfer) || 0,
      bank_name: row.bank_name,
      staff: row.staff,
      status: row.status,
      creation: row.creation,
    }));
    
    await Order.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[orders] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.orders = totalMigrated;
  stats.success.push('Orders');
  log(`✓ Migrated ${formatNumber(totalMigrated)} order records`);
}

// Migrate Stock Movements
async function migrateStockMovements() {
  log('Migrating stock movements...');
  const mysqlCount = await getMySQLCount('stock_movements');
  if (mysqlCount === 0) {
    log('[SKIP] stock_movements — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  // Build ID maps
  const stockMap = await buildIdMap(Stock);
  const userMap = await buildIdMap(User);
  const storeMap = await buildIdMap(Store);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM stock_movements LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      facilityID: row.facilityID,
      store_id: row.store_id ? storeMap.get(row.store_id) : null,
      stock_id: stockMap.get(row.stock_id) || null,
      movement_type: row.movement_type,
      quantity_change: parseFloat(row.quantity_change) || 0,
      quantity_before: parseFloat(row.quantity_before) || 0,
      quantity_after: parseFloat(row.quantity_after) || 0,
      reference_type: row.reference_type,
      reference_id: row.reference_id,
      notes: row.notes,
      performed_by: userMap.get(row.performed_by) || null,
      createdAt: row.created_at,
    }));
    
    await StockMovement.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[stock_movements] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.stockMovements = totalMigrated;
  stats.success.push('StockMovements');
  log(`✓ Migrated ${formatNumber(totalMigrated)} stock movement records`);
}

// Migrate Purchases
async function migratePurchases() {
  log('Migrating purchases (purchase_history)...');
  const mysqlCount = await getMySQLCount('purchase_history');
  if (mysqlCount === 0) {
    log('[SKIP] purchase_history — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  const stockMap = await buildIdMap(Stock);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM purchase_history LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      facilityID: row.facilityID,
      stock_id: stockMap.get(row.stock_id) || null,
      initial_quantity: parseFloat(row.initial_quantity) || 0,
      purchaser: row.purchaser,
      purchase_from: row.purchase_from,
      stock_name: row.stock_name,
      quantity: parseFloat(row.quantity) || 0,
      cost_price: parseFloat(row.cost_price) || 0,
      total_cost: parseFloat(row.total_cost) || 0,
      amount_paid: parseFloat(row.amount_paid) || 0,
      balance: parseFloat(row.balance) || 0,
      for_desc: row.for_desc,
      purchase_date: row.purchase_date,
    }));
    
    await Purchase.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[purchases] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.purchases = totalMigrated;
  stats.success.push('Purchases');
  log(`✓ Migrated ${formatNumber(totalMigrated)} purchase records`);
}

// Migrate Expenses
async function migrateExpenses() {
  log('Migrating expenses...');
  const mysqlCount = await getMySQLCount('expense');
  if (mysqlCount === 0) {
    log('[SKIP] expense — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM expense LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      facilityID: row.facilityID,
      item: row.item,
      price: parseFloat(row.price) || 0,
      type: row.type,
      date: row.date,
    }));
    
    await Expense.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[expenses] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.expenses = totalMigrated;
  stats.success.push('Expenses');
  log(`✓ Migrated ${formatNumber(totalMigrated)} expense records`);
}

// Migrate Shipments
async function migrateShipments() {
  log('Migrating shipments...');
  const mysqlCount = await getMySQLCount('shipments');
  if (mysqlCount === 0) {
    log('[SKIP] shipments — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  const userMap = await buildIdMap(User);
  const storeMap = await buildIdMap(Store);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM shipments LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      tracking_number: row.tracking_number,
      source_branch: row.source_branch,
      destination_branch: row.destination_branch,
      source_store_id: row.source_store_id ? storeMap.get(row.source_store_id) : null,
      destination_store_id: row.destination_store_id ? storeMap.get(row.destination_store_id) : null,
      status: row.status,
      dispatched_by: userMap.get(row.dispatched_by) || null,
      dispatched_at: row.dispatched_at,
      received_by: row.received_by ? userMap.get(row.received_by) : null,
      received_at: row.received_at,
      notes: row.notes,
      created_by: userMap.get(row.created_by) || null,
      createdAt: row.created_at,
      items: [], // Will be populated separately
    }));
    
    await Shipment.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[shipments] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.shipments = totalMigrated;
  stats.success.push('Shipments');
  log(`✓ Migrated ${formatNumber(totalMigrated)} shipment records`);
}

// Migrate Goods Requests
async function migrateGoodsRequests() {
  log('Migrating goods requests...');
  const mysqlCount = await getMySQLCount('goods_requests');
  if (mysqlCount === 0) {
    log('[SKIP] goods_requests — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  const userMap = await buildIdMap(User);
  const stockMap = await buildIdMap(Stock);
  const shipmentMap = await buildIdMap(Shipment);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM goods_requests LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      request_code: row.request_code,
      staff_id: userMap.get(row.staff_id) || null,
      legacy_staff_id: row.staff_id,
      staff_name: row.staff_name,
      requesting_branch: row.requesting_branch,
      stock_id: stockMap.get(row.stock_id) || null,
      product_name: row.product_name,
      requested_quantity: parseFloat(row.requested_quantity) || 0,
      unit_type: row.unit_type,
      reason: row.reason,
      status: row.status,
      admin_notes: row.admin_notes,
      source_branch: row.source_branch,
      shipment_id: row.shipment_id ? shipmentMap.get(row.shipment_id) : null,
      legacy_shipment_id: row.shipment_id,
      reviewed_by: row.reviewed_by ? userMap.get(row.reviewed_by) : null,
      reviewed_at: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    await GoodsRequest.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[goods_requests] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.goodsRequests = totalMigrated;
  stats.success.push('GoodsRequests');
  log(`✓ Migrated ${formatNumber(totalMigrated)} goods request records`);
}

// Migrate Notifications
async function migrateNotifications() {
  log('Migrating notifications...');
  const mysqlCount = await getMySQLCount('notifications');
  if (mysqlCount === 0) {
    log('[SKIP] notifications — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  const userMap = await buildIdMap(User);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM notifications LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      user_id: row.user_id ? userMap.get(row.user_id) : null,
      role_target: row.role_target,
      facility_id: row.facility_id,
      title: row.title,
      message: row.message,
      type: row.type,
      reference_id: row.reference_id,
      is_read: row.is_read === 1,
      createdAt: row.created_at,
    }));
    
    await Notification.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[notifications] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.notifications = totalMigrated;
  stats.success.push('Notifications');
  log(`✓ Migrated ${formatNumber(totalMigrated)} notification records`);
}

// Migrate Password Resets
async function migratePasswordResets() {
  log('Migrating password resets...');
  const mysqlCount = await getMySQLCount('password_resets');
  if (mysqlCount === 0) {
    log('[SKIP] password_resets — 0 rows');
    return;
  }
  
  log(`MySQL rows: ${formatNumber(mysqlCount)}`);
  
  const userMap = await buildIdMap(User);
  
  let offset = 0;
  let totalMigrated = 0;
  
  while (offset < mysqlCount) {
    const [rows] = await mysqlPool.query(`SELECT * FROM password_resets LIMIT ${BATCH_SIZE} OFFSET ${offset}`);
    
    const docs = rows.map(row => ({
      mysqlId: row.id,
      user_id: userMap.get(row.user_id) || null,
      email: row.email,
      otp_hash: row.otp_hash,
      reset_token: row.reset_token,
      attempts: row.attempts,
      max_attempts: row.max_attempts,
      is_verified: row.is_verified === 1,
      is_used: row.is_used === 1,
      expires_at: row.expires_at,
      createdAt: row.created_at,
    }));
    
    await PasswordReset.insertMany(docs);
    totalMigrated += docs.length;
    offset += BATCH_SIZE;
    
    if (offset % (BATCH_SIZE * 5) === 0 || offset >= mysqlCount) {
      log(`[password_resets] ${formatNumber(totalMigrated)} / ${formatNumber(mysqlCount)}`);
    }
  }
  
  stats.totals.passwordResets = totalMigrated;
  stats.success.push('PasswordResets');
  log(`✓ Migrated ${formatNumber(totalMigrated)} password reset records`);
}

// Verify counts
async function verifyCounts() {
  log('\n================================================');
  log('VERIFYING MIGRATION COUNTS');
  log('================================================\n');
  
  const tables = [
    { name: 'Counter', mysqlTable: 'conca', model: Counter },
    { name: 'Users', mysqlTable: 'facility', model: User },
    { name: 'Branches', mysqlTable: 'branch', model: Branch },
    { name: 'Stores', mysqlTable: 'stores', model: Store },
    { name: 'Stocks', mysqlTable: 'stocks', model: Stock },
    { name: 'Customers', mysqlTable: 'customers', model: Customer },
    { name: 'Debts', mysqlTable: 'outstand', model: Debt },
    { name: 'Deposits', mysqlTable: 'deposit_history', model: Deposit },
    { name: 'Orders', mysqlTable: 'orders', model: Order },
    { name: 'StockMovements', mysqlTable: 'stock_movements', model: StockMovement },
    { name: 'Purchases', mysqlTable: 'purchase_history', model: Purchase },
    { name: 'Expenses', mysqlTable: 'expense', model: Expense },
    { name: 'Shipments', mysqlTable: 'shipments', model: Shipment },
    { name: 'GoodsRequests', mysqlTable: 'goods_requests', model: GoodsRequest },
    { name: 'Notifications', mysqlTable: 'notifications', model: Notification },
    { name: 'PasswordResets', mysqlTable: 'password_resets', model: PasswordReset },
  ];
  
  let allMatch = true;
  
  for (const { name, mysqlTable, model } of tables) {
    const mysqlCount = await getMySQLCount(mysqlTable);
    const mongoCount = await getMongoCount(model);
    const match = mysqlCount === mongoCount;
    
    if (!match) allMatch = false;
    
    console.log(`${name.padEnd(20)} MySQL: ${String(mysqlCount).padStart(8)}  MongoDB: ${String(mongoCount).padStart(8)}  ${match ? '✓' : '✗'}`);
  }
  
  return allMatch;
}

// Main migration function
async function runMigration() {
  const startTime = Date.now();
  
  log('STARTING OPTIMIZED MYSQL → MONGODB MIGRATION');
  log('================================================\n');
  
  try {
    await connectDB();
    log('Connected to MongoDB Atlas\n');
    
    // Clear existing data for clean migration
    await clearAllData();
    log('');
    
    // Run migrations in dependency order
    await migrateCounter();
    await migrateUsers();
    await migrateBranches();
    await migrateStores();
    await migrateStocks();
    await migrateCustomers();
    await migrateDebts();
    await migrateDeposits();
    await migrateOrders();
    await migrateStockMovements();
    await migratePurchases();
    await migrateExpenses();
    await migrateShipments();
    await migrateGoodsRequests();
    await migrateNotifications();
    await migratePasswordResets();
    
    // Verify counts
    const allMatch = await verifyCounts();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    log('\n================================================');
    log('MIGRATION COMPLETE');
    log('================================================');
    log(`Duration: ${duration} minutes`);
    log(`Status: ${allMatch ? '✓ ALL COUNTS MATCH' : '✗ COUNT MISMATCH DETECTED'}`);
    log('================================================\n');
    
    // Close connections
    await mysqlPool.end();
    await mongoose.connection.close();
    
    process.exit(allMatch ? 0 : 1);
  } catch (error) {
    log(`\nFATAL ERROR: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
