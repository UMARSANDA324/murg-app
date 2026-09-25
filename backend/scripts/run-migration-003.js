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
    const migrationPath = path.join(__dirname, '../../database/migrations/003_auth_bridge_and_management.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('[Migration] Applying 003_auth_bridge_and_management.sql...');
    await pool.query(sql);
    console.log('[Migration] Successfully applied 003.');

    const [tableCols] = await pool.query('DESCRIBE auth_bridge_tickets');
    console.log('[Verify] auth_bridge_tickets columns count:', tableCols.length);
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
