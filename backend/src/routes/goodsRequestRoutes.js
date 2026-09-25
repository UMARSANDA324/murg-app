const express = require('express');
const router = express.Router();
const goodsRequestController = require('../controllers/goodsRequestController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

// ── Staff endpoints ────────────────────────────────────────────────────────────
// Create a new goods request
router.post('/', goodsRequestController.createRequest);

// View own requests (includes approved receipts and collection receipts)
router.get('/my', goodsRequestController.getMyRequests);

// Source branch: view APPROVED requests pending release at their branch
router.get('/pending-release', goodsRequestController.getApprovedForMyBranch);

// Lookup approval receipt by code (for release interface)
router.get('/receipt/:code', goodsRequestController.lookupByReceiptCode);

// Release goods against an approved receipt
// Security: releasing staff's branch is taken from JWT — client cannot override it
router.post('/receipt/:code/release', goodsRequestController.releaseGoods);

// View specific request (scoped: own branch only for non-admin)
router.get('/:id', goodsRequestController.getRequestById);

// ── Admin endpoints ────────────────────────────────────────────────────────────
// View all goods requests (optionally filtered by status)
router.get('/', requireAdmin, goodsRequestController.getAllRequests);

// Get eligible source branches for a request
router.get('/:id/eligible-branches', requireAdmin, goodsRequestController.getEligibleBranches);

// Reject a pending request
router.post('/:id/reject', requireAdmin, goodsRequestController.rejectRequest);

// Approve a pending request (PENDING → APPROVED, no stock deduction)
router.post('/:id/approve', requireAdmin, goodsRequestController.approveRequest);

// Legacy: approve-and-ship (redirects to approve; kept for backward compat)
router.post('/:id/approve-and-ship', requireAdmin, goodsRequestController.approveAndShipRequest);

module.exports = router;
