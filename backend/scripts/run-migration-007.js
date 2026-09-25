const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'murg',
    port: parseInt(process.env.DB_PORT) || 3306,
    multipleStatements: true,
  });

  try {
    const migrationPath = path.join(__dirname, '../../database/migrations/007_historical_receipts_and_analytics_indexes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('[Migration] Applying 007_historical_receipts_and_analytics_indexes.sql...');
    await pool.query(sql);
    console.log('[Migration] Successfully applied 007.');

    const [orderIndexes] = await pool.query("SHOW INDEX FROM orders WHERE Key_name LIKE 'idx_orders_%'");
    console.log('[Verify] Orders added indexes:', orderIndexes.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name })));

    const [smIndexes] = await pool.query("SHOW INDEX FROM stock_movements WHERE Key_name LIKE 'idx_sm_%'");
    console.log('[Verify] Stock movements added indexes:', smIndexes.map(i => ({ Key_name: i.Key_name, Column_name: i.Column_name })));
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
