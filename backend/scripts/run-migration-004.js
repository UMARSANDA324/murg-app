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
    const migrationPath = path.join(__dirname, '../../database/migrations/004_password_reset_and_goods_requests.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('[Migration] Applying 004_password_reset_and_goods_requests.sql...');
    await pool.query(sql);
    console.log('[Migration] Successfully applied 004.');

    const [pwCols] = await pool.query('DESCRIBE password_resets');
    console.log('[Verify] password_resets columns count:', pwCols.length);
    const [grCols] = await pool.query('DESCRIBE goods_requests');
    console.log('[Verify] goods_requests columns count:', grCols.length);
    const [ntCols] = await pool.query('DESCRIBE notifications');
    console.log('[Verify] notifications columns count:', ntCols.length);
    const [srCols] = await pool.query('DESCRIBE shipment_receipts');
    console.log('[Verify] shipment_receipts columns count:', srCols.length);
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
