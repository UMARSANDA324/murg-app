const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'murg',
    port: 3306,
    multipleStatements: true,
  });

  try {
    const migrationPath = path.join(__dirname, '../../database/migrations/002_branch_sales_mode_and_yard_pricing.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('[Migration] Applying 002_branch_sales_mode_and_yard_pricing.sql...');
    await pool.query(sql);
    console.log('[Migration] Successfully applied 002.');

    const [branchCols] = await pool.query("SHOW COLUMNS FROM branch LIKE 'sales_mode'");
    console.log('[Verify] branch.sales_mode column:', branchCols);

    const [stockCols] = await pool.query("SHOW COLUMNS FROM stocks LIKE 'price_per_yard'");
    console.log('[Verify] stocks.price_per_yard column:', stockCols);

    const [branches] = await pool.query('SELECT facilityID, name, sales_mode, status FROM branch');
    console.log('[Verify] Branches with sales_mode:', branches);
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
