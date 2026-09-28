const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

// Only create MySQL pool if explicitly requested for migration
// MongoDB is now the primary database for the application
const isMigrationMode = process.env.MYSQL_MIGRATION_MODE === 'true';

if (isMigrationMode && process.env.DB_HOST && process.env.DB_USER) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'murg',
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    timezone: '+01:00', // Africa/Lagos
    dateStrings: false,
  });

  // Test connection on startup
  pool.getConnection()
    .then(conn => {
      console.log('[DB] MySQL connection pool established (migration mode).');
      conn.release();
    })
    .catch(err => {
      console.warn('[DB] MySQL connection failed:', err.message);
    });
} else {
  console.log('[DB] MySQL disabled - using MongoDB as primary database');
  console.log('[DB] To enable MySQL for migration, set MYSQL_MIGRATION_MODE=true');
}

module.exports = pool;
