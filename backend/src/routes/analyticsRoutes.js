const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);
router.get('/sales-activity', analyticsController.getSalesActivity);
router.get('/financial', analyticsController.getFinancialReport);
router.get('/weekly', analyticsController.getWeeklyReport);
router.get('/monthly', analyticsController.getMonthlyReport);
router.get('/yearly', analyticsController.getYearlyReport);
router.get('/debtors', analyticsController.getDebtorReport);
router.get('/history', analyticsController.getHistoryReport);

module.exports = router;
