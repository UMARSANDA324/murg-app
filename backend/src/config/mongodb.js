const mongoose = require('mongoose');
require('dotenv').config();

/**
 * MongoDB Connection Module
 * Handles connection to MongoDB Atlas for MURG application
 * Connection is established via MONGODB_URI environment variable
 */

const MONGODB_URI = process.env.MONGODB_URI;

const mongoOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

const connectDB = async () => {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required to connect the application database.');
  }
  try {
    const conn = await mongoose.connect(MONGODB_URI, mongoOptions);
    console.log('[MongoDB] Connected to MongoDB Atlas successfully');
    console.log(`[MongoDB] Database: ${conn.connection.name}`);
    console.log(`[MongoDB] Host: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error('[MongoDB] Failed to connect to MongoDB Atlas:', err.message);
    throw err;
  }
};

// Connection event listeners
mongoose.connection.on('connected', () => {
  console.log('[MongoDB] Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Mongoose disconnected from MongoDB Atlas');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('[MongoDB] Mongoose connection closed through app termination');
  process.exit(0);
});

module.exports = { connectDB, mongoose };
