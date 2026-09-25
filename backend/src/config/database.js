const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
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
    console.log('[DB] MySQL connection pool established.');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect to MySQL:', err.message);
  });

module.exports = pool;
