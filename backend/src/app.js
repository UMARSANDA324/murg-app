const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { randomUUID } = require('crypto');
require('dotenv').config();

const { connectDB, mongoose } = require('./config/mongodb');

const authRoutes = require('./routes/authRoutes');
const branchRoutes = require('./routes/branchRoutes');
const staffRoutes = require('./routes/staffRoutes');
const stockRoutes = require('./routes/stockRoutes');
const salesRoutes = require('./routes/salesRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const customerRoutes = require('./routes/customerRoutes');
const managementRoutes = require('./routes/managementRoutes');
const goodsRequestRoutes = require('./routes/goodsRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const shipmentReceiptRoutes = require('./routes/shipmentReceiptRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const returnsRoutes = require('./routes/returnsRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security and utility middleware
app.use(helmet());
const configuredCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production'
      && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin || '');
    if (isLocalDevelopmentOrigin) {
      callback(null, true);
    } else if (!origin) {
      callback(null, true);
    } else if (origin === configuredCorsOrigin) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize MongoDB connection
if (process.env.MONGODB_URI) {
  connectDB().catch(err => {
    console.error('[APP] Failed to connect to MongoDB:', err.message);
    // Don't exit - allow server to start but log the error
  });
} else {
  console.warn('[APP] MONGODB_URI not set - MongoDB features will be disabled');
}

// Root endpoint - API info and health status
app.get('/', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    success: true,
    message: 'MURG Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: '/api/health',
      api: '/api',
    },
    service: 'murg-backend-api',
    database: {
      type: 'mongodb',
      status: mongoStatus,
    },
  });
});

// Healthcheck endpoint
app.get('/api/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'murg-backend-api',
    database: {
      type: 'mongodb',
      status: mongoStatus,
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/management', managementRoutes);
app.use('/api/goods-requests', goodsRequestRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shipment-receipts', shipmentReceiptRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/returns', returnsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
