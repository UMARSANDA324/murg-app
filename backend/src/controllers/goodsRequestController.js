const goodsRequestRepo = require('../repositories/goodsRequestRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, error, forbidden } = require('../utils/responseUtils');

class GoodsRequestController {
  /**
   * Staff creates a new goods request.
   * Identity comes from JWT (req.user) — never from request body.
   */
  async createRequest(req, res, next) {
    try {
      const user = req.user;
      const { stockId, productName, requestedQuantity, unitType, reason, productSource } = req.body;

      // Determine mode
      const parsedStockId = stockId ? parseInt(stockId) : null;
      const isCustom = !parsedStockId || productSource === 'CUSTOM';
      const resolvedSource = isCustom ? 'CUSTOM' : 'CATALOG';

      // Validation
      if (isCustom && (!productName || !productName.trim())) {
        return error(res, 'Product name is required for custom (non-catalog) requests', 400);
      }
      if (!isCustom && !parsedStockId) {
        return error(res, 'Product stock ID is required for catalog requests', 400);
      }

      const qty = parseFloat(requestedQuantity);
      if (isNaN(qty) || qty <= 0) {
        return error(res, 'Quantity must be a number greater than zero', 400);
      }

      const resolvedProductName = isCustom
        ? productName.trim().substring(0, 200)
        : productName
        ? productName.trim()
        : `Product #${parsedStockId}`;

      // Staff identity from JWT — never trusted from body
      const result = await goodsRequestRepo.createRequest({
        staffId: user.id,
        staffName: user.name,
        requestingBranch: user.facilityID,
        stockId: parsedStockId,
        productName: resolvedProductName,
        productSource: resolvedSource,
        requestedQuantity: qty,
        unitType: unitType || 'belt',
        reason: reason ? reason.trim() : '',
      });

      return success(res, result, 'Goods request submitted successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Staff views their own branch goods requests (including approved receipts & collection receipts).
   */
  async getMyRequests(req, res, next) {
    try {
      const user = req.user;
      const requests = await goodsRequestRepo.findByStaff({
        staffId: user.role === 'Admin' ? null : user.id,
        branchId: user.isGlobalAdmin ? null : user.facilityID,
      });
      return success(res, requests);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin views all goods requests across all branches.
   */
  async getAllRequests(req, res, next) {
    try {
      const status = req.query.status || null;
      const requests = await goodsRequestRepo.findAll({ status });
      return success(res, requests);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin or Staff views request details.
   * Branch staff may only view requests for their own branch (requesting or source).
   */
  async getRequestById(req, res, next) {
    try {
      const { id } = req.params;
      const request = await goodsRequestRepo.findById(id);

      if (!request) {
        return error(res, 'Goods request not found', 404);
      }

      // Branch authorization check
      if (
        !req.user.isGlobalAdmin &&
        req.user.facilityID !== request.requesting_branch &&
        req.user.facilityID !== request.source_branch
      ) {
        return forbidden(res, 'You are not authorized to view requests from other branches');
      }

      return success(res, request);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Source branch staff views APPROVED requests pending release at their branch.
   * Only returns requests where source_branch = authenticated staff's branch.
   */
  async getApprovedForMyBranch(req, res, next) {
    try {
      const user = req.user;

      if (user.role === 'Admin') {
        // Admin can see all approved requests
        const requests = await goodsRequestRepo.findAll({ status: 'APPROVED' });
        return success(res, requests);
      }

      // Branch staff — scoped to their branch as source
      const requests = await goodsRequestRepo.findApprovedForBranch({
        sourceBranch: user.facilityID,
      });
      return success(res, requests);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Lookup a goods request by its approval receipt code.
   * Used by branch staff before releasing goods.
   * Backend validates source_branch against authenticated user's branch.
   */
  async lookupByReceiptCode(req, res, next) {
    try {
      const { code } = req.params;
      const user = req.user;

      if (!code) {
        return error(res, 'Receipt code is required', 400);
      }

      let request;
      try {
        request = await goodsRequestRepo.validateReceiptForRelease(code.trim(), user.facilityID);
      } catch (validationError) {
        // Use 400 for all validation errors to avoid leaking state details to unauthorized users
        return error(res, validationError.message, 400);
      }

      return success(res, request);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin queries eligible source branches with sufficient stock.
   */
  async getEligibleBranches(req, res, next) {
    try {
      const { id } = req.params;
      const request = await goodsRequestRepo.findById(id);

      if (!request) {
        return error(res, 'Goods request not found', 404);
      }

      let branches;

      if (request.stock_id) {
        branches = await goodsRequestRepo.getEligibleBranchesForProduct(
          request.stock_id,
          request.requested_quantity
        );
      } else {
        branches = await goodsRequestRepo.getEligibleBranchesByName(
          request.product_name,
          request.requested_quantity
        );
      }

      // Exclude requesting branch from source selection
      const filteredBranches = branches.filter((b) => b.facilityID !== request.requesting_branch);

      return success(res, filteredBranches);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin rejects a goods request.
   */
  async rejectRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;
      const user = req.user;

      await goodsRequestRepo.rejectRequest(id, user.id, user.name, adminNotes);
      const request = await goodsRequestRepo.findById(id);
      publishBranchEvent({
        branchIds: [request?.requesting_branch, request?.source_branch],
        type: 'branch-operation',
        operation: 'GOODS_REQUEST_REJECTED',
        referenceId: id,
      });
      return success(res, null, 'Goods request rejected successfully');
    } catch (err) {
      if (err.message.includes('Cannot reject')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }

  /**
   * Admin approves a goods request.
   * Transitions: PENDING → APPROVED
   * Generates approval receipt code.
   * Does NOT deduct stock (that happens at release time).
   */
  async approveRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { sourceBranch, sourceStockId, adminNotes } = req.body;
      const user = req.user;

      if (!sourceBranch || !sourceStockId) {
        return error(res, 'Source branch and source stock ID are required to approve the request', 400);
      }

      const result = await goodsRequestRepo.approveRequest({
        requestId: id,
        adminId: user.id,
        adminName: user.name,
        sourceBranch,
        sourceStockId: parseInt(sourceStockId),
        adminNotes: adminNotes ? adminNotes.trim() : '',
      });

      const request = await goodsRequestRepo.findById(id);
      publishBranchEvent({
        branchIds: [request?.requesting_branch, sourceBranch],
        type: 'branch-operation',
        operation: 'GOODS_REQUEST_APPROVED',
        referenceId: id,
      });

      return success(res, result, 'Goods request approved. Staff can now collect goods using the receipt code.');
    } catch (err) {
      if (err.message.includes('Cannot approve') || err.message.includes('Insufficient')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }

  /**
   * Source branch staff releases goods against an approved receipt.
   * Transitions: APPROVED → RELEASED
   * Deducts stock atomically.
   * Generates final collection receipt.
   *
   * Security: releasingStaffBranch comes from JWT — never from client body.
   */
  async releaseGoods(req, res, next) {
    try {
      const { code } = req.params;
      const user = req.user;

      if (!code) {
        return error(res, 'Receipt code is required', 400);
      }

      const result = await goodsRequestRepo.releaseGoods({
        receiptCode: code.trim(),
        releasingStaffId: user.id,
        releasingStaffName: user.name,
        releasingStaffBranch: user.facilityID,
      });

      publishBranchEvent({
        branchIds: [user.facilityID],
        type: 'branch-operation',
        operation: 'GOODS_RELEASED',
        referenceId: result.requestId || result.collectionCode,
      });

      return success(
        res,
        result,
        `Goods successfully released. Collection Receipt: ${result.collectionCode}`
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  }

  /**
   * Legacy: approve-and-ship (kept for backward compat with old records).
   */
  async approveAndShipRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { sourceBranch, sourceStockId, adminNotes } = req.body;
      const user = req.user;

      if (!sourceBranch || !sourceStockId) {
        return error(res, 'Source branch and source stock ID are required to approve the request', 400);
      }

      const result = await goodsRequestRepo.approveAndShipRequest({
        requestId: id,
        adminId: user.id,
        adminName: user.name,
        sourceBranch,
        sourceStockId: parseInt(sourceStockId),
        adminNotes: adminNotes ? adminNotes.trim() : '',
      });

      return success(res, result, 'Goods request approved and shipment dispatched.');
    } catch (err) {
      if (err.message.includes('Cannot approve') || err.message.includes('Insufficient')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }
}

module.exports = new GoodsRequestController();
