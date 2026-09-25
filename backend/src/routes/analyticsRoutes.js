const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);
// Analytics endpoint doesn't require branch scope - it handles both branch and global admin
router.get('/sales-activity', analyticsController.getSalesActivity);

module.exports = router;
