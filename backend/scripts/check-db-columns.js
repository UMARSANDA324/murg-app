/**
 * check-db-columns.js
 *
 * Startup pre-flight check for the MURG backend.
 * Verifies that all required columns exist in the `facility` table.
 *
 * If the migration has not been applied, this script prints a clear
 * actionable warning — it does NOT crash the server.
 *
 * Run automatically as part of `npm run dev`.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const REQUIRED_FACILITY_COLUMNS = ['password_hash', 'permissions'];

const MIGRATION_FILE = 'database/migrations/001_multibranch_and_stock_ledger.sql';

async function checkDbColumns() {
  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'murg',
      port: parseInt(process.env.DB_PORT) || 3306,
      connectTimeout: 5000,
    });

    // Verify DB connectivity first
    await pool.query('SELECT 1');
    console.log('[DB-CHECK] ✓ MySQL connection established');

    // Verify required columns in facility table
    const [cols] = await pool.query('DESCRIBE facility');
    const presentColumns = cols.map(c => c.Field);

    const missingColumns = REQUIRED_FACILITY_COLUMNS.filter(
      col => !presentColumns.includes(col)
    );

    if (missingColumns.length > 0) {
      console.error('');
      console.error('┌─────────────────────────────────────────────────────────────────┐');
      console.error('│  [DB-CHECK] ✗  MISSING COLUMNS DETECTED IN `facility` TABLE     │');
      console.error('├─────────────────────────────────────────────────────────────────┤');
      console.error(`│  Missing: ${missingColumns.join(', ').padEnd(57)}│`);
      console.error('│                                                                   │');
      console.error('│  The database migration has not been applied.                    │');
      console.error('│  Run this command to apply it:                                   │');
      console.error('│                                                                   │');
      console.error(`│  mysql -u root murg < ${MIGRATION_FILE.padEnd(43)}│`);
      console.error('│                                                                   │');
      console.error('│  Authentication (POST /api/auth/login) will fail until           │');
      console.error('│  this migration is applied.                                      │');
      console.error('└─────────────────────────────────────────────────────────────────┘');
      console.error('');
    } else {
      console.log('[DB-CHECK] ✓ All required facility columns present (password_hash, permissions)');
    }

    // Verify branch.sales_mode
    const [bCols] = await pool.query('DESCRIBE branch');
    if (!bCols.some(c => c.Field === 'sales_mode')) {
      console.warn('[DB-CHECK] ⚠️  branch.sales_mode missing. Run migration 002.');
    } else {
      console.log('[DB-CHECK] ✓ branch.sales_mode present');
    }

    // Verify stocks.price_per_yard
    const [sCols] = await pool.query('DESCRIBE stocks');
    if (!sCols.some(c => c.Field === 'price_per_yard')) {
      console.warn('[DB-CHECK] ⚠️  stocks.price_per_yard missing. Run migration 002.');
    } else {
      console.log('[DB-CHECK] ✓ stocks.price_per_yard present');
    }

    // Verify auth_bridge_tickets table
    const [ticketTable] = await pool.query("SHOW TABLES LIKE 'auth_bridge_tickets'");
    if (ticketTable.length === 0) {
      console.warn('[DB-CHECK] ⚠️  auth_bridge_tickets table missing. Run migration 003.');
    } else {
      console.log('[DB-CHECK] ✓ auth_bridge_tickets table present');
    }

  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error('');
      console.error('┌─────────────────────────────────────────────────────────────────┐');
      console.error('│  [DB-CHECK] ✗  CANNOT CONNECT TO MYSQL                          │');
      console.error('├─────────────────────────────────────────────────────────────────┤');
      console.error('│  MySQL is not running or is unreachable.                        │');
      console.error('│                                                                   │');
      console.error('│  → Start XAMPP and ensure MySQL is running on port 3306.         │');
      console.error('│  → Check DB_HOST and DB_PORT in backend/.env                    │');
      console.error('│                                                                   │');
      console.error(`│  DB_HOST: ${(process.env.DB_HOST || 'localhost').padEnd(56)}│`);
      console.error(`│  DB_PORT: ${(process.env.DB_PORT || '3306').padEnd(56)}│`);
      console.error(`│  DB_NAME: ${(process.env.DB_NAME || 'murg').padEnd(56)}│`);
      console.error('└─────────────────────────────────────────────────────────────────┘');
      console.error('');
    } else {
      console.error('[DB-CHECK] ✗ Unexpected error during pre-flight check:', err.message);
    }
  } finally {
    if (pool) {
      try { await pool.end(); } catch (_) { /* ignore */ }
    }
  }
}

checkDbColumns();
