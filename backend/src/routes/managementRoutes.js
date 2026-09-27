const express = require('express');
const router = express.Router();
const managementController = require('../controllers/managementController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// Global administrative operations (strictly require Global Admin)
router.get('/overview', requireAdmin, managementController.getOverview);
router.get('/audit-logs', requireAdmin, managementController.getAuditLogs);

module.exports = router;
