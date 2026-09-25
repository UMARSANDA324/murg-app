const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', staffController.list);
router.get('/:id', staffController.get);
router.post('/', requireAdmin, staffController.create);
router.patch('/:id/role', requireAdmin, staffController.updateRole);
router.patch('/:id/status', requireAdmin, staffController.toggleStatus);
router.patch('/:id/email', requireAdmin, staffController.updateEmail);
router.patch('/:id/password', requireAdmin, staffController.updatePassword);
router.delete('/:id', requireAdmin, staffController.deleteStaff);

module.exports = router;
