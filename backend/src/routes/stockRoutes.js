const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const {
  authenticate,
  requireBranchScope,
  requireAdmin,
  requireAdminPriceControl,
} = require('../middleware/auth');

// All stock routes require authentication
router.use(authenticate);

// ─── Global catalog search (authenticate only, NO branch scope) ────────────
// Returns distinct product names from ALL branches.
// Used by the Goods Request form so staff can search the entire product catalog.
router.get('/catalog', stockController.catalogSearch);

// ─── Store management (authenticate only, branch scope in controller) ───────
router.get('/stores', stockController.getStores);
router.post('/stores', requireAdmin, stockController.createStore);
router.put('/stores/:id', requireAdmin, stockController.updateStore);
router.delete('/stores/:id', requireAdmin, stockController.deleteStore);
router.get('/purchases/history', stockController.getPurchaseHistory);
router.get('/purchases/totals', stockController.getPurchaseTotals);

// ─── Branch-scoped routes (authenticate + requireBranchScope) ─────────────
router.use(requireBranchScope);

router.get('/', stockController.list);
router.get('/movements', stockController.getMovements);
router.get('/:id', stockController.get);
router.patch('/:id/price', requireAdminPriceControl, stockController.updatePrice);
router.patch('/:id/yard-config', requireAdminPriceControl, stockController.updateYardConfig);
router.post('/receive', stockController.receiveStock);

module.exports = router;
