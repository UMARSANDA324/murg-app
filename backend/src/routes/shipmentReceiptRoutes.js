const express = require('express');
const router = express.Router();
const shipmentReceiptController = require('../controllers/shipmentReceiptController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:code/verify', shipmentReceiptController.verifyReceipt);
router.post('/:code/release', shipmentReceiptController.releaseReceipt);

module.exports = router;
