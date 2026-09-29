const mysql = require('mysql2/promise');
require('dotenv').config();

async function getCounts() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'murg',
    port: parseInt(process.env.DB_PORT) || 3306,
  });

  try {
    console.log('MySQL Source Data Count Snapshot');
    console.log('=====================================\n');

    const tables = [
      'facility',
      'branch',
      'stores',
      'stocks',
      'customers',
      'outstand',
      'deposit_history',
      'orders',
      'stock_movements',
      'purchase_history',
      'expense',
      'shipments',
      'shipment_items',
      'goods_requests',
      'notifications',
      'password_resets',
      'auth_bridge_tickets',
      'audit_logs',
      'shipment_receipts',
      'conca',
      'cart',
      'debt_cart',
    ];

    for (const table of tables) {
      try {
        const [rows] = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        console.log(`${table.padEnd(25)} ${String(count).padStart(10)}`);
      } catch (err) {
        console.log(`${table.padEnd(25)} ERROR - ${err.message}`);
      }
    }

    console.log('\n=====================================');
    console.log('Snapshot complete');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

getCounts();
