const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');
const { authenticate, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);
router.use(requireBranchScope);

router.post('/process', returnsController.processReturn);
router.get('/validate/:orderID', returnsController.validateOrder);

module.exports = router;
