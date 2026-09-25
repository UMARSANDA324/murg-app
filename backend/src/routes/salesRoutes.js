const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);

// Historical receipt retrieval handles its own authoritative authorization check & branch isolation
router.get('/:orderId/receipt', salesController.getReceipt);

// Branch-scoped POS operations require requireBranchScope
router.use(requireBranchScope);

router.get('/', salesController.list);
router.get('/by-date', salesController.getSalesByDate);
router.post('/checkout', salesController.checkout);
router.get('/:orderId/items', salesController.getOrderItems);

module.exports = router;
