const {
  GoodsRequest, User, Stock, Shipment, ShipmentReceipt, Notification, Branch, StockMovement,
} = require('../models');
const { mongoose } = require('../config/mongodb');
const crypto = require('crypto');
const { reserveLegacyIds } = require('../services/legacyIdService');
const { recordAuditLog } = require('../services/auditLogService');

function makeCode(prefix) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function withBranchNames(requests) {
  const branchIds = [...new Set(requests.flatMap((request) => [request.requesting_branch, request.source_branch]).filter(Boolean))];
  const branches = await Branch.find({ facilityID: { $in: branchIds } }).select('facilityID name').lean();
  const names = new Map(branches.map((branch) => [branch.facilityID, branch.name]));
  return requests.map((request) => ({
    ...request,
    id: request._id.toString(),
    staff_id: request.staff_id?._id?.toString() || request.staff_id?.toString() || null,
    stock_id: request.stock_id?._id?.toString() || request.stock_id?.toString() || null,
    source_stock_id: request.source_stock_id?._id?.toString() || request.source_stock_id?.toString() || null,
    requesting_branch_name: names.get(request.requesting_branch) || request.requesting_branch,
    source_branch_name: names.get(request.source_branch) || request.source_branch || null,
    approved_by_name_display: request.approved_by?.name || request.approved_by_name || null,
    released_by_name_display: request.released_by?.name || request.released_by_name || null,
  }));
}

async function notify(session, values) {
  const [mysqlId] = await reserveLegacyIds(Notification, 'notificationId', 1, session);
  await Notification.create([{ ...values, mysqlId, is_read: false }], { session });
}

/**
 * GoodsRequestRepositoryMongo — MongoDB-based goods request operations.
 */
class GoodsRequestRepositoryMongo {
  async findAll({ status = null, limit = 100, offset = 0 } = {}) {
    const query = {};
    if (status) query.status = status;
    const requests = await GoodsRequest.find(query)
      .populate('staff_id', 'name').populate('stock_id', 'name unit_type')
      .populate('source_stock_id', 'name').populate('approved_by', 'name').populate('released_by', 'name')
      .sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 500)).skip(Math.max(Number(offset) || 0, 0)).lean();
    return withBranchNames(requests);
  }

  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const request = await GoodsRequest.findById(id)
      .populate('staff_id', 'name').populate('stock_id', 'name unit_type')
      .populate('source_stock_id', 'name').populate('approved_by', 'name').populate('released_by', 'name').lean();
    return request ? (await withBranchNames([request]))[0] : null;
  }

  async findByStaff({ staffId = null, branchId = null, limit = 100 } = {}) {
    const query = {};
    if (staffId) query.staff_id = staffId;
    if (branchId) query.requesting_branch = branchId;
    const requests = await GoodsRequest.find(query)
      .populate('staff_id', 'name').populate('approved_by', 'name').populate('released_by', 'name')
      .sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean();
    return withBranchNames(requests);
  }

  async createRequest({ staffId, staffName, requestingBranch, stockId, productName, productSource = 'CATALOG', requestedQuantity, unitType = 'belt', reason = '' }) {
    if (!mongoose.Types.ObjectId.isValid(staffId)) throw new Error('Invalid requesting user.');
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const branch = await Branch.findOne({ facilityID: requestingBranch, status: 'active' }).session(session).lean();
        if (!branch) throw new Error('Requesting branch not found or inactive.');
        if (productSource === 'CATALOG') {
          if (!mongoose.Types.ObjectId.isValid(stockId)) throw new Error('Catalog stock ID is invalid.');
          const catalogStock = await Stock.findOne({ _id: stockId, status: 'active' }).session(session).lean();
          if (!catalogStock) throw new Error('Catalog product not found.');
        }
        const [mysqlId] = await reserveLegacyIds(GoodsRequest, 'goodsRequestId', 1, session);
        const requestCode = makeCode('GR');
        const [request] = await GoodsRequest.create([{
          mysqlId, request_code: requestCode, staff_id: staffId, staff_name: staffName,
          requesting_branch: requestingBranch, stock_id: productSource === 'CATALOG' ? stockId : null,
          product_source: productSource, product_name: productName, requested_quantity: requestedQuantity,
          unit_type: unitType, reason, status: 'PENDING',
        }], { session });
        await notify(session, {
          role_target: 'Admin', title: `New Goods Request - ${branch.name}`,
          message: `Staff: ${staffName}\nBranch: ${branch.name} (${requestingBranch})\nProduct: ${productName}${productSource === 'CUSTOM' ? ' [Custom]' : ''}\nQuantity: ${requestedQuantity} ${unitType}(s)\nReason: ${reason || 'N/A'}`,
          type: 'GOODS_REQUEST', reference_id: request._id.toString(),
        });
        result = { id: request._id.toString(), requestCode };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async findApprovedForBranch({ sourceBranch, limit = 100 } = {}) {
    const requests = await GoodsRequest.find({ source_branch: sourceBranch, status: 'APPROVED' })
      .populate('staff_id', 'name').populate('approved_by', 'name')
      .sort({ approved_at: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean();
    return withBranchNames(requests);
  }

  async findByReceiptCode(receiptCode) {
    const request = await GoodsRequest.findOne({ receipt_code: receiptCode })
      .populate('staff_id', 'name').populate('approved_by', 'name').populate('released_by', 'name').lean();
    return request ? (await withBranchNames([request]))[0] : null;
  }

  async getEligibleBranchesForProduct(stockId, requestedQuantity) {
    if (!mongoose.Types.ObjectId.isValid(stockId)) return [];
    const stock = await Stock.findById(stockId).select('name').lean();
    return stock ? this.getEligibleBranchesByName(stock.name, requestedQuantity) : [];
  }

  async getEligibleBranchesByName(productName, requestedQuantity) {
    const quantity = Number(requestedQuantity);
    const stocks = await Stock.find({ name: productName, status: 'active', quantity: { $gte: quantity } }).lean();
    const branches = await Branch.find({ facilityID: { $in: stocks.map((stock) => stock.facilityID) }, status: 'active' }).select('facilityID name sales_mode').lean();
    const byId = new Map(branches.map((branch) => [branch.facilityID, branch]));
    return stocks.filter((stock) => byId.has(stock.facilityID)).map((stock) => ({
      stockId: stock._id.toString(), facilityID: stock.facilityID,
      branchName: byId.get(stock.facilityID).name, availableQuantity: Number(stock.quantity),
      unitType: stock.unit_type, salesMode: byId.get(stock.facilityID).sales_mode,
    })).sort((a, b) => b.availableQuantity - a.availableQuantity);
  }

  async rejectRequest(id, adminId, adminName, adminNotes = '') {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(adminId)) throw new Error('Invalid request or administrator.');
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const request = await GoodsRequest.findOne({ _id: id, status: 'PENDING' }).session(session);
        if (!request) throw new Error('Cannot reject request: request is missing or no longer pending.');
        request.status = 'REJECTED'; request.rejection_reason = adminNotes; request.admin_notes = adminNotes;
        request.reviewed_by = adminId; request.reviewed_at = new Date(); request.updatedAt = new Date();
        await request.save({ session });
        await notify(session, {
          user_id: request.staff_id, facility_id: request.requesting_branch,
          title: `Goods Request Rejected - ${request.request_code}`,
          message: `Your request for "${request.product_name}" was rejected by ${adminName}. Reason: ${adminNotes || 'No reason provided.'}`,
          type: 'GOODS_REQUEST_REJECTED', reference_id: request._id.toString(),
        });
      });
      return true;
    } finally { await session.endSession(); }
  }

  async approveRequest({ requestId, adminId, adminName, sourceBranch, sourceStockId, adminNotes = '' }) {
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(adminId) || !mongoose.Types.ObjectId.isValid(sourceStockId)) {
      throw new Error('Request, administrator, or source stock ID is invalid.');
    }
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const request = await GoodsRequest.findOne({ _id: requestId, status: 'PENDING' }).session(session);
        if (!request) throw new Error('Cannot approve request: request is missing or no longer pending.');
        if (sourceBranch === request.requesting_branch) throw new Error('Source branch cannot be the same as requesting branch.');
        const sourceLocation = await Branch.findOne({ facilityID: sourceBranch, status: 'active' }).session(session).lean();
        if (!sourceLocation) throw new Error('Source branch not found or inactive.');
        const stock = await Stock.findOne({ _id: sourceStockId, facilityID: sourceBranch, status: 'active' }).session(session).lean();
        if (!stock) throw new Error(`Product not found in source branch ${sourceBranch}.`);
        if (Number(stock.quantity) < Number(request.requested_quantity)) throw new Error(`Insufficient stock in source branch. Available: ${stock.quantity}, Requested: ${request.requested_quantity}.`);
        const branch = await Branch.findOne({ facilityID: sourceBranch }).select('name').session(session).lean();
        const receiptCode = makeCode('RCP');
        request.status = 'APPROVED'; request.source_branch = sourceBranch; request.source_stock_id = stock._id;
        request.receipt_code = receiptCode; request.admin_notes = adminNotes;
        request.approved_by = adminId; request.approved_by_name = adminName; request.approved_at = new Date();
        request.reviewed_by = adminId; request.reviewed_at = new Date(); request.updatedAt = new Date();
        await request.save({ session });
        await notify(session, {
          user_id: request.staff_id, facility_id: request.requesting_branch,
          title: `Goods Request Approved - ${request.request_code}`,
          message: `Request approved. Receipt: ${receiptCode}; product: ${request.product_name}; quantity: ${request.requested_quantity}; source: ${branch?.name || sourceBranch}.`,
          type: 'GOODS_REQUEST_APPROVED', reference_id: request._id.toString(),
        });
        result = {
          requestId: request._id.toString(), receiptCode, sourceBranch,
          sourceBranchName: branch?.name || sourceBranch, productName: request.product_name,
          quantity: request.requested_quantity, unitType: request.unit_type,
        };
      });
      return result;
    } finally { await session.endSession(); }
  }

  async validateReceiptForRelease(receiptCode, authenticatedStaffBranch) {
    const request = await this.findByReceiptCode(receiptCode);
    if (!request) throw new Error('Receipt not found. Please verify the receipt code and try again.');
    if (request.status !== 'APPROVED') throw new Error(request.status === 'RELEASED'
      ? 'This receipt has already been fulfilled. Goods have already been released.'
      : `Receipt is not in APPROVED state (current: ${request.status}). Cannot release.`);
    if (request.source_branch !== authenticatedStaffBranch) {
      throw new Error(`Access denied: this receipt is designated for source branch ${request.source_branch}.`);
    }
    return request;
  }

  async releaseGoods({ receiptCode, releasingStaffId, releasingStaffName, releasingStaffBranch }) {
    if (!mongoose.Types.ObjectId.isValid(releasingStaffId)) throw new Error('Invalid releasing user.');
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const request = await GoodsRequest.findOne({ receipt_code: receiptCode }).session(session);
        if (!request) throw new Error('Receipt not found. Please verify the receipt code.');
        if (request.status !== 'APPROVED') throw new Error(request.status === 'RELEASED'
          ? 'Receipt already fulfilled. Goods have already been released.'
          : `Cannot release goods. Receipt status is '${request.status}'.`);
        if (request.source_branch !== releasingStaffBranch) throw new Error('This branch is not authorized to release the approved goods.');
        const stock = await Stock.findOne({ _id: request.source_stock_id, facilityID: releasingStaffBranch, status: 'active' }).session(session).lean();
        if (!stock) throw new Error('Approved stock item was not found in the source branch.');
        const quantity = Number(request.requested_quantity);
        const before = Number(stock.quantity) || 0;
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > before) throw new Error(`Insufficient stock. Available: ${before}, required: ${quantity}.`);
        const update = await Stock.updateOne({ _id: stock._id, facilityID: releasingStaffBranch, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity, out_stocks: quantity } }, { session });
        if (!update.matchedCount) throw new Error('Stock changed before release could be completed.');
        const [movementId] = await reserveLegacyIds(StockMovement, 'stockMovementId', 1, session);
        await StockMovement.create([{
          mysqlId: movementId, facilityID: releasingStaffBranch, store_id: stock.store_id || null, stock_id: stock._id,
          movement_type: 'STOCK_OUT_TRANSFER', quantity_change: -quantity, quantity_before: before,
          quantity_after: before - quantity, reference_type: 'goods_requests', reference_id: request._id.toString(),
          notes: `Goods release for ${receiptCode} to ${request.requesting_branch}`, performed_by: releasingStaffId,
        }], { session });
        const collectionCode = makeCode('COL');
        request.status = 'RELEASED'; request.released_by = releasingStaffId; request.released_by_name = releasingStaffName;
        request.released_at = new Date(); request.collection_code = collectionCode; request.updatedAt = new Date();
        await request.save({ session });
        await notify(session, {
          user_id: request.staff_id, facility_id: request.requesting_branch,
          title: `Goods Released - ${request.request_code}`,
          message: `Goods released. Collection receipt: ${collectionCode}; product: ${request.product_name}; quantity: ${quantity} ${request.unit_type}.`,
          type: 'GOODS_RELEASED', reference_id: request._id.toString(),
        });
        await recordAuditLog({
          facilityID: releasingStaffBranch, user_id: releasingStaffId, user_name: releasingStaffName,
          action: 'GOODS_RELEASED', entity_type: 'goods_requests', entity_id: request._id.toString(),
          new_values: { receipt_code: receiptCode, collection_code: collectionCode, product: request.product_name, quantity, destination_branch: request.requesting_branch },
        }, session);
        result = {
          requestId: request._id.toString(), requestCode: request.request_code, receiptCode,
          collectionCode, productName: request.product_name, quantity, unitType: request.unit_type,
          sourceBranch: releasingStaffBranch, requestingBranch: request.requesting_branch,
        };
      });
      return result;
    } finally { await session.endSession(); }
  }

  async approveAndShipRequest({ requestId, adminId, adminName, sourceBranch, sourceStockId, adminNotes = '' }) {
    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(adminId) || !mongoose.Types.ObjectId.isValid(sourceStockId)) {
      throw new Error('Request, administrator, or source stock ID is invalid.');
    }
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const request = await GoodsRequest.findOne({ _id: requestId, status: 'PENDING' }).session(session);
        if (!request) throw new Error('Cannot approve request: request is missing or no longer pending.');
        if (sourceBranch === request.requesting_branch) throw new Error('Source branch cannot be the same as requesting branch.');
        const stock = await Stock.findOne({ _id: sourceStockId, facilityID: sourceBranch, status: 'active' }).session(session).lean();
        if (!stock) throw new Error('Product not found in source branch.');
        const quantity = Number(request.requested_quantity);
        const before = Number(stock.quantity) || 0;
        if (!Number.isFinite(quantity) || quantity <= 0 || quantity > before) throw new Error(`Insufficient stock in source branch. Available: ${before}, Requested: ${quantity}.`);
        const [shipmentId] = await reserveLegacyIds(Shipment, 'shipmentId', 1, session);
        const [movementId] = await reserveLegacyIds(StockMovement, 'stockMovementId', 1, session);
        const [receiptId] = await reserveLegacyIds(ShipmentReceipt, 'shipmentReceiptId', 1, session);
        const trackingNumber = `TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const receiptCode = makeCode('RCP');
        const [shipment] = await Shipment.create([{
          mysqlId: shipmentId, tracking_number: trackingNumber, source_branch: sourceBranch,
          destination_branch: request.requesting_branch, status: 'In Transit', request_id: request._id,
          dispatched_by: adminId, dispatched_at: new Date(), created_by: adminId, notes: adminNotes,
          items: [{ stock_id: stock._id, product_name: stock.name, quantity_sent: quantity, quantity_received: 0 }],
        }], { session });
        const sourceUpdate = await Stock.updateOne({ _id: stock._id, facilityID: sourceBranch, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity, out_stocks: quantity } }, { session });
        if (!sourceUpdate.matchedCount) throw new Error('Source stock changed before dispatch could be completed.');
        await StockMovement.create([{
          mysqlId: movementId, facilityID: sourceBranch, store_id: stock.store_id || null, stock_id: stock._id,
          movement_type: 'STOCK_OUT_TRANSFER', quantity_change: -quantity, quantity_before: before,
          quantity_after: before - quantity, reference_type: 'goods_requests', reference_id: request._id.toString(),
          notes: `Approved request ${request.request_code} dispatched to ${request.requesting_branch}`, performed_by: adminId,
        }], { session });
        await ShipmentReceipt.create([{
          mysqlId: receiptId, receipt_code: receiptCode, receipt_type: 'DISPATCH', shipment_id: shipment._id,
          request_id: request._id, source_branch: sourceBranch, destination_branch: request.requesting_branch,
          product_name: request.product_name, quantity, unit_type: request.unit_type,
          dispatched_by: adminId, dispatched_by_name: adminName, consumed: false,
        }], { session });
        request.status = 'IN_TRANSIT'; request.source_branch = sourceBranch; request.source_stock_id = stock._id;
        request.receipt_code = receiptCode; request.shipment_id = shipment._id; request.admin_notes = adminNotes;
        request.approved_by = adminId; request.approved_by_name = adminName; request.approved_at = new Date();
        request.reviewed_by = adminId; request.reviewed_at = new Date(); request.updatedAt = new Date();
        await request.save({ session });
        await notify(session, {
          user_id: request.staff_id, facility_id: request.requesting_branch,
          title: `Goods Request Dispatched - ${request.request_code}`,
          message: `Goods dispatched from ${sourceBranch}. Receipt: ${receiptCode}; tracking: ${trackingNumber}.`,
          type: 'GOODS_REQUEST_APPROVED', reference_id: request._id.toString(),
        });
        result = { requestId: request._id.toString(), receiptCode, shipmentId: shipment._id.toString(), trackingNumber, sourceBranch, requestingBranch: request.requesting_branch };
      });
      return result;
    } finally { await session.endSession(); }
  }
}

module.exports = new GoodsRequestRepositoryMongo();
