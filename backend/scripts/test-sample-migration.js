const mysql = require('mysql2/promise');
const { connectDB, mongoose } = require('../src/config/mongodb');
const { User, Branch, Stock } = require('../src/models');
require('dotenv').config();

/**
 * Sample Migration Test
 * Migrates only a few records from each table to verify the mapping works correctly.
 */

const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'murg',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

function log(message) {
  console.log(`[SAMPLE TEST] ${message}`);
}

async function testUserMigration() {
  log('Testing user migration (first 3 users)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM facility LIMIT 3');
    log(`  Found ${rows.length} users to migrate`);
    
    for (const row of rows) {
      const user = await User.findOneAndUpdate(
        { mysqlId: row.id },
        {
          mysqlId: row.id,
          facilityID: row.facilityID,
          name: row.name,
          email: row.email,
          role: row.role,
          status: row.status,
          password_hash: row.password_hash,
        },
        { upsert: true, returnDocument: 'after' }
      );
      log(`  ✓ Migrated user: ${row.name} (${row.email})`);
    }
    
    // Verify
    const count = await User.countDocuments();
    log(`  Total users in MongoDB: ${count}`);
    return true;
  } catch (error) {
    log(`  ✗ Failed: ${error.message}`);
    return false;
  }
}

async function testBranchMigration() {
  log('Testing branch migration (first 3 branches)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM branch LIMIT 3');
    log(`  Found ${rows.length} branches to migrate`);
    
    for (const row of rows) {
      const branch = await Branch.findOneAndUpdate(
        { mysqlId: row.id },
        {
          mysqlId: row.id,
          facilityID: row.facilityID,
          name: row.name,
          address: row.address,
          phone: row.phone,
          status: row.status || 'active',
          sales_mode: row.sales_mode || 'DEALER',
        },
        { upsert: true, returnDocument: 'after' }
      );
      log(`  ✓ Migrated branch: ${row.name} (${row.facilityID})`);
    }
    
    // Verify
    const count = await Branch.countDocuments();
    log(`  Total branches in MongoDB: ${count}`);
    return true;
  } catch (error) {
    log(`  ✗ Failed: ${error.message}`);
    return false;
  }
}

async function testStockMigration() {
  log('Testing stock migration (first 5 stocks)...');
  
  try {
    const [rows] = await mysqlPool.query('SELECT * FROM stocks LIMIT 5');
    log(`  Found ${rows.length} stocks to migrate`);
    
    for (const row of rows) {
      const stock = await Stock.findOneAndUpdate(
        { mysqlId: row.id },
        {
          mysqlId: row.id,
          name: row.name,
          facilityID: row.facilityID,
          quantity: parseFloat(row.quantity) || 0,
          selling: parseFloat(row.selling) || 0,
          unit_type: row.unit_type || 'belt',
          status: row.status || 'active',
        },
        { upsert: true, returnDocument: 'after' }
      );
      log(`  ✓ Migrated stock: ${row.name} (qty: ${row.quantity})`);
    }
    
    // Verify
    const count = await Stock.countDocuments();
    log(`  Total stocks in MongoDB: ${count}`);
    return true;
  } catch (error) {
    log(`  ✗ Failed: ${error.message}`);
    return false;
  }
}

async function runSampleTest() {
  log('Starting sample migration test...');
  log('==========================================');
  
  try {
    await connectDB();
    log('Connected to MongoDB Atlas');
    
    const results = {
      users: await testUserMigration(),
      branches: await testBranchMigration(),
      stocks: await testStockMigration(),
    };
    
    log('==========================================');
    log('SAMPLE TEST RESULTS');
    log('==========================================');
    Object.entries(results).forEach(([table, success]) => {
      log(`  ${table}: ${success ? '✓ PASS' : '✗ FAIL'}`);
    });
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
      log('==========================================');
      log('Sample test PASSED. Ready for full migration.');
      log('Run: node scripts/migrate-mysql-to-mongodb.js');
    } else {
      log('==========================================');
      log('Sample test FAILED. Fix errors before full migration.');
    }
    
    await mysqlPool.end();
    await mongoose.connection.close();
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    log(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

runSampleTest();
