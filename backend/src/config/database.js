const mysql = require('mysql2/promise');
require('dotenv').config();

let pool = null;

// Only create MySQL pool if MySQL variables are configured
if (process.env.DB_HOST && process.env.DB_USER) {
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
      console.log('[DB] MySQL connection pool established.');
      conn.release();
    })
    .catch(err => {
      console.warn('[DB] MySQL connection failed (this is expected if using MongoDB):', err.message);
    });
} else {
  console.log('[DB] MySQL not configured - using MongoDB as primary database');
}

module.exports = pool;
