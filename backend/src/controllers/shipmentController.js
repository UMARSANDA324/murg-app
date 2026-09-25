const shipmentRepo = require('../repositories/shipmentRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, created, error, notFound } = require('../utils/responseUtils');

class ShipmentController {
  async list(req, res, next) {
    try {
      const facilityID = req.user.isGlobalAdmin ? null : req.user.facilityID;
      const status = req.query.status || null;
      const shipments = await shipmentRepo.findAll({
        facilityID,
        status,
        isGlobalAdmin: req.user.isGlobalAdmin,
      });
      return success(res, shipments);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const shipment = await shipmentRepo.findById(req.params.id);
      if (!shipment) {
        return notFound(res, 'Shipment not found');
      }

      // Check permission: Global admin or source/destination branch
      if (!req.user.isGlobalAdmin &&
          shipment.source_branch !== req.user.facilityID &&
          shipment.destination_branch !== req.user.facilityID) {
        return error(res, 'Access denied to this shipment', 403);
      }

      return success(res, shipment);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const {
        sourceBranch,
        destinationBranch,
        sourceStoreId,
        destinationStoreId,
        items,
        notes,
      } = req.body;

      const effectiveSource = req.user.isGlobalAdmin ? sourceBranch : req.user.facilityID;

      if (!effectiveSource || !destinationBranch) {
        return error(res, 'Source and destination branches are required', 400);
      }

      if (effectiveSource === destinationBranch) {
        return error(res, 'Source and destination branches cannot be the same', 400);
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return error(res, 'At least one product item is required for shipment', 400);
      }

      const result = await shipmentRepo.createAndDispatch({
        sourceBranch: effectiveSource,
        destinationBranch,
        sourceStoreId: sourceStoreId ? parseInt(sourceStoreId) : null,
        destinationStoreId: destinationStoreId ? parseInt(destinationStoreId) : null,
        items: items.map(i => ({
          stockId: parseInt(i.stockId),
          quantity: parseFloat(i.quantity),
        })),
        notes: notes ? notes.trim() : '',
        userId: req.user.id,
      });

      publishBranchEvent({
        branchIds: [effectiveSource, destinationBranch],
        type: 'branch-operation',
        operation: 'SHIPMENT_DISPATCHED',
        referenceId: result.shipmentId,
      });

      return created(res, result, 'Shipment created and dispatched successfully');
    } catch (err) {
      if (err.message.includes('Insufficient stock')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }

  async confirmReceipt(req, res, next) {
    try {
      const shipmentId = req.params.id;
      const { receivedItems } = req.body;
      const destinationBranch = req.user.isGlobalAdmin ? req.body.destinationBranch : req.user.facilityID;

      const shipment = await shipmentRepo.findById(shipmentId);
      if (!shipment) {
        return notFound(res, 'Shipment not found');
      }

      const effectiveDest = req.user.isGlobalAdmin ? shipment.destination_branch : destinationBranch;

      await shipmentRepo.confirmReceipt(shipmentId, {
        receivedItems,
        userId: req.user.id,
        destinationBranch: effectiveDest,
      });

      publishBranchEvent({
        branchIds: [shipment.source_branch, shipment.destination_branch],
        type: 'branch-operation',
        operation: 'SHIPMENT_RECEIVED',
        referenceId: shipmentId,
      });

      return success(res, null, 'Shipment received and destination inventory updated successfully');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShipmentController();
