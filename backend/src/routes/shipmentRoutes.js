const express = require('express');
const router = express.Router();
const shipmentController = require('../controllers/shipmentController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/', shipmentController.list);
router.post('/', shipmentController.create);
router.get('/:id', shipmentController.get);
router.post('/:id/receive', shipmentController.confirmReceipt);

module.exports = router;
