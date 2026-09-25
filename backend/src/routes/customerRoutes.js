const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);
router.use(requireBranchScope);

router.get('/', customerController.list);
router.post('/', customerController.create);
router.get('/:id', customerController.get);
router.post('/:id/deposits', customerController.recordDeposit);
router.get('/:id/deposits', customerController.getDeposits);

module.exports = router;
