const mysql = require('mysql2/promise');
const { connectDB, mongoose } = require('../src/config/mongodb');
const {
  User, Branch, Store, Stock, Customer, Order, Debt, Deposit,
  StockMovement, Shipment, Purchase, Expense, GoodsRequest,
  Notification, PasswordReset, ShipmentReceipt, AuditLog, Counter
} = require('../src/models');
require('dotenv').config();

/**
 * MySQL to MongoDB Migration Script
 * 
 * This script migrates data from MySQL to MongoDB Atlas.
 * It is designed to be idempotent - can be run multiple times safely.
 * 
 * Usage: node scripts/migrate-mysql-to-mongodb.js
 */

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
};

/**
 * Helper: Log migration progress
 */
function log(message) {
  console.log(`[MIGRATION] ${message}`);
}

/**
 * Helper: Format numbers for display
 */
function formatNumber(num) {
  return Number(num).toLocaleString();
}

/**
 * Migrate Counter table (initialize facilityID counter)
 */
async function migrateCounter() {
  log('Migrating counter table...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM conca WHERE id = 1');
    if (rows.length > 0) {
      const existing = await Counter.findOne({ name: 'facilityID' });
      if (!existing) {
        await Counter.create({
          name: 'facilityID',
          lastID: rows[0].lastID,
          mysqlId: rows[0].id,
        });
        stats.success.push('Counter');
        stats.totals.counter = 1;
        log(`  ✓ Counter migrated: lastID = ${rows[0].lastID}`);
      } else {
        log(`  ⊘ Counter already exists, skipping`);
        stats.totals.counter = 1;
      }
    }
  } catch (error) {
    stats.failed.push({ table: 'counter', error: error.message });
    log(`  ✗ Counter migration failed: ${error.message}`);
  }
}

/**
 * Migrate Users (facility table)
 */
async function migrateUsers() {
  log('Migrating users (facility table)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM facility');
    log(`  Found ${rows.length} users in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await User.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            facilityID: row.facilityID,
            name: row.name,
            fname: row.fname,
            email: row.email,
            phone: row.phone,
            role: row.role,
            status: row.status,
            password: row.password, // Preserve MD5 for migration compatibility
            password_hash: row.password_hash,
            permissions: row.permissions ? JSON.parse(row.permissions) : ['*'],
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate user ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Users');
    stats.totals.users = migrated;
    log(`  ✓ Migrated ${migrated} users`);
  } catch (error) {
    stats.failed.push({ table: 'users', error: error.message });
    log(`  ✗ Users migration failed: ${error.message}`);
  }
}

/**
 * Migrate Branches
 */
async function migrateBranches() {
  log('Migrating branches...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM branch');
    log(`  Found ${rows.length} branches in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await Branch.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            facilityID: row.facilityID,
            name: row.name,
            address: row.address,
            phone: row.phone,
            status: row.status || 'active',
            sales_mode: row.sales_mode || 'DEALER',
            createdAt: row.created_at || new Date(),
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate branch ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Branches');
    stats.totals.branches = migrated;
    log(`  ✓ Migrated ${migrated} branches`);
  } catch (error) {
    stats.failed.push({ table: 'branches', error: error.message });
    log(`  ✗ Branches migration failed: ${error.message}`);
  }
}

/**
 * Migrate Stores
 */
async function migrateStores() {
  log('Migrating stores...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM stores');
    log(`  Found ${rows.length} stores in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await Store.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            store_name: row.store_name,
            branch_id: row.branch_id,
            status: row.status || 'active',
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate store ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Stores');
    stats.totals.stores = migrated;
    log(`  ✓ Migrated ${migrated} stores`);
  } catch (error) {
    stats.failed.push({ table: 'stores', error: error.message });
    log(`  ✗ Stores migration failed: ${error.message}`);
  }
}

/**
 * Migrate Stocks
 */
async function migrateStocks() {
  log('Migrating stocks...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM stocks');
    log(`  Found ${rows.length} stocks in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await Stock.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            name: row.name,
            facilityID: row.facilityID,
            store_id: row.store_id || null,
            quantity: parseFloat(row.quantity) || 0,
            buying: parseFloat(row.buying) || 0,
            selling: parseFloat(row.selling) || 0,
            unit_type: row.unit_type || 'belt',
            price_per_yard: row.price_per_yard ? parseFloat(row.price_per_yard) : null,
            yards_per_belt: row.yards_per_belt ? parseFloat(row.yards_per_belt) : 100,
            status: row.status || 'active',
            out_stocks: parseFloat(row.out_stocks) || 0,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate stock ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Stocks');
    stats.totals.stocks = migrated;
    log(`  ✓ Migrated ${migrated} stocks`);
  } catch (error) {
    stats.failed.push({ table: 'stocks', error: error.message });
    log(`  ✗ Stocks migration failed: ${error.message}`);
  }
}

/**
 * Migrate Customers
 */
async function migrateCustomers() {
  log('Migrating customers...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM customers');
    log(`  Found ${rows.length} customers in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await Customer.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            name: row.name,
            phone: row.phone,
            facilityID: row.facilityID,
            address: row.address,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate customer ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Customers');
    stats.totals.customers = migrated;
    log(`  ✓ Migrated ${migrated} customers`);
  } catch (error) {
    stats.failed.push({ table: 'customers', error: error.message });
    log(`  ✗ Customers migration failed: ${error.message}`);
  }
}

/**
 * Migrate Debts (outstand table)
 */
async function migrateDebts() {
  log('Migrating debts (outstand table)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM outstand');
    log(`  Found ${rows.length} debt records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        // Find customer by MySQL ID
        const customer = await Customer.findOne({ mysqlId: row.customerID });
        if (!customer) {
          log(`  ⚠ Skipping debt for customer ${row.customerID} - customer not found`);
          continue;
        }

        await Debt.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            customerID: customer._id,
            facilityID: row.facilityID,
            balance: parseFloat(row.balance) || 0,
            last_payment: parseFloat(row.last_payment) || 0,
            last_payment_date: row.last_payment_date,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate debt ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Debts');
    stats.totals.debts = migrated;
    log(`  ✓ Migrated ${migrated} debt records`);
  } catch (error) {
    stats.failed.push({ table: 'debts', error: error.message });
    log(`  ✗ Debts migration failed: ${error.message}`);
  }
}

/**
 * Migrate Deposits (deposit_history table)
 */
async function migrateDeposits() {
  log('Migrating deposits (deposit_history table)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM deposit_history');
    log(`  Found ${rows.length} deposit records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        // Find customer by MySQL ID
        const customer = await Customer.findOne({ mysqlId: row.customerID });
        if (!customer) {
          log(`  ⚠ Skipping deposit for customer ${row.customerID} - customer not found`);
          continue;
        }

        await Deposit.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            customerID: customer._id,
            facilityID: row.facilityID,
            amount: parseFloat(row.amount) || 0,
            payment_date: row.payment_date,
            receipt_number: row.receipt_number,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate deposit ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Deposits');
    stats.totals.deposits = migrated;
    log(`  ✓ Migrated ${migrated} deposit records`);
  } catch (error) {
    stats.failed.push({ table: 'deposits', error: error.message });
    log(`  ✗ Deposits migration failed: ${error.message}`);
  }
}

/**
 * Migrate Orders
 */
async function migrateOrders() {
  log('Migrating orders...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM orders');
    log(`  Found ${rows.length} order records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        // Find stock by MySQL ID
        const stock = await Stock.findOne({ mysqlId: row.stockID });
        const customer = row.customerID ? await Customer.findOne({ mysqlId: row.customerID }) : null;

        await Order.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            orderID: row.orderID,
            facilityID: row.facilityID,
            stockID: stock?._id || null,
            item: row.item,
            quantity: parseFloat(row.quantity) || 0,
            subtotal: parseFloat(row.subtotal) || 0,
            net_total: parseFloat(row.net_total) || 0,
            buyer_name: row.buyer_name,
            customer_name: row.customer_name,
            customerID: customer?._id || null,
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
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate order ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Orders');
    stats.totals.orders = migrated;
    log(`  ✓ Migrated ${migrated} order records`);
  } catch (error) {
    stats.failed.push({ table: 'orders', error: error.message });
    log(`  ✗ Orders migration failed: ${error.message}`);
  }
}

/**
 * Migrate Stock Movements
 */
async function migrateStockMovements() {
  log('Migrating stock movements...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM stock_movements');
    log(`  Found ${rows.length} stock movement records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const stock = await Stock.findOne({ mysqlId: row.stock_id });
        const user = await User.findOne({ mysqlId: row.performed_by });

        await StockMovement.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            facilityID: row.facilityID,
            store_id: row.store_id || null,
            stock_id: stock?._id || null,
            movement_type: row.movement_type,
            quantity_change: parseFloat(row.quantity_change) || 0,
            quantity_before: parseFloat(row.quantity_before) || 0,
            quantity_after: parseFloat(row.quantity_after) || 0,
            reference_type: row.reference_type,
            reference_id: row.reference_id,
            notes: row.notes,
            performed_by: user?._id || null,
            createdAt: row.created_at,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate stock movement ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('StockMovements');
    stats.totals.stockMovements = migrated;
    log(`  ✓ Migrated ${migrated} stock movement records`);
  } catch (error) {
    stats.failed.push({ table: 'stockMovements', error: error.message });
    log(`  ✗ Stock movements migration failed: ${error.message}`);
  }
}

/**
 * Migrate Purchases
 */
async function migratePurchases() {
  log('Migrating purchases (purchase_history table)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM purchase_history');
    log(`  Found ${rows.length} purchase records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const stock = await Stock.findOne({ mysqlId: row.stock_id });

        await Purchase.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            facilityID: row.facilityID,
            stock_id: stock?._id || null,
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
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate purchase ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Purchases');
    stats.totals.purchases = migrated;
    log(`  ✓ Migrated ${migrated} purchase records`);
  } catch (error) {
    stats.failed.push({ table: 'purchases', error: error.message });
    log(`  ✗ Purchases migration failed: ${error.message}`);
  }
}

/**
 * Migrate Expenses
 */
async function migrateExpenses() {
  log('Migrating expenses...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM expense');
    log(`  Found ${rows.length} expense records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        await Expense.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            facilityID: row.facilityID,
            item: row.item,
            price: parseFloat(row.price) || 0,
            type: row.type,
            date: row.date,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate expense ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Expenses');
    stats.totals.expenses = migrated;
    log(`  ✓ Migrated ${migrated} expense records`);
  } catch (error) {
    stats.failed.push({ table: 'expenses', error: error.message });
    log(`  ✗ Expenses migration failed: ${error.message}`);
  }
}

/**
 * Migrate Shipments
 */
async function migrateShipments() {
  log('Migrating shipments...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM shipments');
    log(`  Found ${rows.length} shipment records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const dispatchedBy = await User.findOne({ mysqlId: row.dispatched_by });
        const receivedBy = row.received_by ? await User.findOne({ mysqlId: row.received_by }) : null;
        const createdBy = await User.findOne({ mysqlId: row.created_by });

        // Get shipment items
        const [itemRows] = await mysqlPool.query('SELECT * FROM shipment_items WHERE shipment_id = ?', [row.id]);
        const items = itemRows.map(item => ({
          stock_id: item.stock_id, // Will be updated after stock migration
          product_name: item.product_name,
          quantity_sent: parseFloat(item.quantity_sent) || 0,
          quantity_received: parseFloat(item.quantity_received) || 0,
        }));

        await Shipment.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            tracking_number: row.tracking_number,
            source_branch: row.source_branch,
            destination_branch: row.destination_branch,
            source_store_id: row.source_store_id || null,
            destination_store_id: row.destination_store_id || null,
            status: row.status,
            dispatched_by: dispatchedBy?._id || null,
            dispatched_at: row.dispatched_at,
            received_by: receivedBy?._id || null,
            received_at: row.received_at,
            notes: row.notes,
            created_by: createdBy?._id || null,
            createdAt: row.created_at,
            items,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate shipment ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Shipments');
    stats.totals.shipments = migrated;
    log(`  ✓ Migrated ${migrated} shipment records`);
  } catch (error) {
    stats.failed.push({ table: 'shipments', error: error.message });
    log(`  ✗ Shipments migration failed: ${error.message}`);
  }
}

/**
 * Migrate Goods Requests
 */
async function migrateGoodsRequests() {
  log('Migrating goods requests...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM goods_requests');
    log(`  Found ${rows.length} goods request records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const staff = await User.findOne({ mysqlId: row.staff_id });
        const stock = row.stock_id ? await Stock.findOne({ mysqlId: row.stock_id }) : null;
        const reviewedBy = row.reviewed_by ? await User.findOne({ mysqlId: row.reviewed_by }) : null;

        await GoodsRequest.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            request_code: row.request_code,
            staff_id: staff?._id || null,
            staff_name: row.staff_name,
            requesting_branch: row.requesting_branch,
            stock_id: stock?._id || null,
            product_name: row.product_name,
            requested_quantity: parseFloat(row.requested_quantity) || 0,
            unit_type: row.unit_type,
            reason: row.reason,
            status: row.status,
            admin_notes: row.admin_notes,
            source_branch: row.source_branch,
            shipment_id: row.shipment_id || null,
            reviewed_by: reviewedBy?._id || null,
            reviewed_at: row.reviewed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate goods request ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('GoodsRequests');
    stats.totals.goodsRequests = migrated;
    log(`  ✓ Migrated ${migrated} goods request records`);
  } catch (error) {
    stats.failed.push({ table: 'goodsRequests', error: error.message });
    log(`  ✗ Goods requests migration failed: ${error.message}`);
  }
}

/**
 * Migrate Notifications
 */
async function migrateNotifications() {
  log('Migrating notifications...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM notifications');
    log(`  Found ${rows.length} notification records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const user = row.user_id ? await User.findOne({ mysqlId: row.user_id }) : null;

        await Notification.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            user_id: user?._id || null,
            role_target: row.role_target,
            facility_id: row.facility_id,
            title: row.title,
            message: row.message,
            type: row.type,
            reference_id: row.reference_id,
            is_read: row.is_read === 1,
            createdAt: row.created_at,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate notification ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('Notifications');
    stats.totals.notifications = migrated;
    log(`  ✓ Migrated ${migrated} notification records`);
  } catch (error) {
    stats.failed.push({ table: 'notifications', error: error.message });
    log(`  ✗ Notifications migration failed: ${error.message}`);
  }
}

/**
 * Migrate Password Resets
 */
async function migratePasswordResets() {
  log('Migrating password resets...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM password_resets');
    log(`  Found ${rows.length} password reset records in MySQL`);
    
    let migrated = 0;
    for (const row of rows) {
      try {
        const user = await User.findOne({ mysqlId: row.user_id });

        await PasswordReset.findOneAndUpdate(
          { mysqlId: row.id },
          {
            mysqlId: row.id,
            user_id: user?._id || null,
            email: row.email,
            otp_hash: row.otp_hash,
            reset_token: row.reset_token,
            attempts: row.attempts,
            max_attempts: row.max_attempts,
            is_verified: row.is_verified === 1,
            is_used: row.is_used === 1,
            expires_at: row.expires_at,
            createdAt: row.created_at,
          },
          { upsert: true, new: true }
        );
        migrated++;
      } catch (error) {
        log(`  ✗ Failed to migrate password reset ${row.id}: ${error.message}`);
      }
    }
    
    stats.success.push('PasswordResets');
    stats.totals.passwordResets = migrated;
    log(`  ✓ Migrated ${migrated} password reset records`);
  } catch (error) {
    stats.failed.push({ table: 'passwordResets', error: error.message });
    log(`  ✗ Password resets migration failed: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function runMigration() {
  log('Starting MySQL to MongoDB migration...');
  log('================================================');
  
  try {
    // Connect to MongoDB
    await connectDB();
    log('Connected to MongoDB Atlas');
    
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
    
    // Print summary
    log('================================================');
    log('MIGRATION SUMMARY');
    log('================================================');
    log(`Successful migrations: ${stats.success.length}`);
    stats.success.forEach(table => log(`  ✓ ${table}`));
    
    if (stats.failed.length > 0) {
      log(`Failed migrations: ${stats.failed.length}`);
      stats.failed.forEach(({ table, error }) => log(`  ✗ ${table}: ${error}`));
    }
    
    log('================================================');
    log('RECORD COUNTS');
    log('================================================');
    Object.entries(stats.totals).forEach(([table, count]) => {
      log(`  ${table}: ${formatNumber(count)}`);
    });
    
    log('================================================');
    log('Migration completed!');
    
    // Close connections
    await mysqlPool.end();
    await mongoose.connection.close();
    
    process.exit(stats.failed.length > 0 ? 1 : 0);
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
runMigration();
