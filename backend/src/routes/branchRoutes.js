const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { authenticate, requireAdmin, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);

router.get('/', branchController.list);
router.post('/', requireAdmin, branchController.create);
router.get('/dashboard', requireBranchScope, branchController.getDashboard);
router.get('/:branchId/dashboard', requireBranchScope, branchController.getDashboard);
router.get('/:prefix/:suffix/dashboard', (req, res, next) => {
  req.params.branchId = `${req.params.prefix}/${req.params.suffix}`;
  next();
}, requireBranchScope, branchController.getDashboard);
router.get('/:branchId', requireBranchScope, branchController.get);
router.put('/:branchId', requireAdmin, branchController.update);
router.patch('/:branchId/status', requireAdmin, branchController.setStatus);

module.exports = router;
