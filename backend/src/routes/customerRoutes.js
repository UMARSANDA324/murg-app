const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requireBranchScope, requireAdmin } = require('../middleware/auth');

router.use(authenticate);
router.use(requireBranchScope);

router.get('/', customerController.list);
router.post('/', requireAdmin, customerController.create);
router.get('/:id', requireAdmin, customerController.get);
router.post('/:id/deposits', requireAdmin, customerController.recordDeposit);
router.get('/:id/deposits', requireAdmin, customerController.getDeposits);
router.get('/:id/debt-history', requireAdmin, customerController.getDebtHistory);

module.exports = router;
