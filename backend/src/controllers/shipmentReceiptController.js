const shipmentReceiptRepo = require('../repositories/shipmentReceiptRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, error, forbidden } = require('../utils/responseUtils');

class ShipmentReceiptController {
  /**
   * Verify / lookup shipment receipt information by code.
   */
  async verifyReceipt(req, res, next) {
    try {
      const { code } = req.params;
      if (!code) {
        return error(res, 'Receipt reference code is required', 400);
      }

      const receipt = await shipmentReceiptRepo.findByReceiptCode(code.trim());
      if (!receipt) {
        return error(res, 'Receipt reference code not found. Please verify the code and try again.', 404);
      }

      if (
        !req.user.isGlobalAdmin &&
        receipt.source_branch !== req.user.facilityID &&
        receipt.destination_branch !== req.user.facilityID
      ) {
        return forbidden(res, 'You are not authorized to view this shipment receipt.');
      }

      return success(res, receipt);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Atomically release shipment and credit destination inventory.
   */
  async releaseReceipt(req, res, next) {
    try {
      const { code } = req.params;
      const user = req.user;

      if (!code) {
        return error(res, 'Receipt reference code is required', 400);
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] || '';

      const result = await shipmentReceiptRepo.verifyAndReleaseReceipt({
        receiptCode: code.trim(),
        staffId: user.id,
        staffName: user.name,
        destinationBranch: user.facilityID,
        ipAddress: String(clientIp),
      });

      publishBranchEvent({
        branchIds: [user.facilityID],
        type: 'branch-operation',
        operation: 'SHIPMENT_RECEIVED',
        referenceId: result.shipmentId,
      });

      return success(res, result, 'Shipment receipt successfully verified and inventory released to destination branch.');
    } catch (err) {
      console.error('[RECEIPT_RELEASE_ERR]', err.message || err);
      // Return 400/403 with exact human-readable validation error message
      return error(res, err.message, 400);
    }
  }
}

module.exports = new ShipmentReceiptController();
