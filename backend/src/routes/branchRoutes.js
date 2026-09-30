const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { authenticate, requireAdmin, requireBranchScope } = require('../middleware/auth');

router.use(authenticate);

const normalizeSlashBranchId = (req, res, next) => {
  req.params.branchId = `${req.params.prefix}/${req.params.suffix}`;
  next();
};

router.get('/', branchController.list);
router.post('/', requireAdmin, branchController.create);
router.get('/dashboard', requireBranchScope, branchController.getDashboard);
router.get('/:branchId/dashboard', requireBranchScope, branchController.getDashboard);
router.get('/:prefix/:suffix/dashboard', normalizeSlashBranchId, requireBranchScope, branchController.getDashboard);
router.get('/:prefix/:suffix', normalizeSlashBranchId, requireBranchScope, branchController.get);
router.put('/:prefix/:suffix', normalizeSlashBranchId, requireAdmin, branchController.update);
router.patch('/:prefix/:suffix/status', normalizeSlashBranchId, requireAdmin, branchController.setStatus);
router.get('/:branchId', requireBranchScope, branchController.get);
router.put('/:branchId', requireAdmin, branchController.update);
router.patch('/:branchId/status', requireAdmin, branchController.setStatus);

module.exports = router;
