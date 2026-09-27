const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returnsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/process', returnsController.processReturn);
router.get('/validate/:orderID', returnsController.validateOrder);

module.exports = router;
