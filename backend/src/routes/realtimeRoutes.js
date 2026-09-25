const express = require('express');
const realtimeController = require('../controllers/realtimeController');
const { authenticate, requireBranchScope } = require('../middleware/auth');

const router = express.Router();

router.get('/branch', authenticate, requireBranchScope, realtimeController.streamBranch);

module.exports = router;
