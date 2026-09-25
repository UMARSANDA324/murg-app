const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

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
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'murg-backend-api',
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
