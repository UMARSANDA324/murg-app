/**
 * Run Migration 005: Support custom product entries in goods_requests.
 * Safe, idempotent — uses ADD COLUMN IF NOT EXISTS / MODIFY COLUMN.
 */
'use strict';
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mysql = require('mysql2/promise');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'murg_db',
    multipleStatements: true,
  });

  try {
    const migrationPath = path.join(__dirname, '../../database/migrations/005_goods_request_custom_products.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('[Migration 005] Applying goods request custom product support...');
    await pool.query(sql);
    console.log('[Migration 005] ✓ Applied successfully.');

    // Verify
    const [cols] = await pool.query('DESCRIBE goods_requests');
    const colNames = cols.map(c => c.Field);
    console.log('[Verify] goods_requests columns:', colNames.join(', '));

    const hasProductSource = colNames.includes('product_source');
    const stockIdNullable = cols.find(c => c.Field === 'stock_id')?.Null === 'YES';

    if (hasProductSource) {
      console.log('[Verify] ✓ product_source column exists.');
    } else {
      console.warn('[Verify] ✗ product_source column MISSING — check migration SQL.');
    }

    if (stockIdNullable) {
      console.log('[Verify] ✓ stock_id is now nullable.');
    } else {
      console.warn('[Verify] ✗ stock_id is still NOT NULL — check migration SQL.');
    }

    console.log('[Migration 005] Done.');
  } finally {
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Migration 005] FAILED:', err.message);
  process.exit(1);
});
