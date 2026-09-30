const { ShipmentReceipt, Shipment, Branch } = require('../models');
const { mongoose } = require('../config/mongodb');
const shipmentRepo = require('./shipmentRepositoryMongo');

class ShipmentReceiptRepository {
  /**
   * Find shipment receipt details by code.
   */
  async findByReceiptCode(receiptCode) {
    const receipt = await ShipmentReceipt.findOne({ receipt_code: receiptCode }).lean();
    if (!receipt) return null;
    const shipment = await Shipment.findById(receipt.shipment_id).select('tracking_number status dispatched_at').lean();
    if (!shipment) return null;
    const branches = await Branch.find({ facilityID: { $in: [receipt.source_branch, receipt.destination_branch] } })
      .select('facilityID name').lean();
    const names = new Map(branches.map((branch) => [branch.facilityID, branch.name]));
    return {
      ...receipt,
      id: receipt._id.toString(),
      shipment_id: receipt.shipment_id.toString(),
      tracking_number: shipment.tracking_number,
      shipment_status: shipment.status,
      dispatched_at: shipment.dispatched_at,
      source_branch_name: names.get(receipt.source_branch) || receipt.source_branch,
      destination_branch_name: names.get(receipt.destination_branch) || receipt.destination_branch,
    };
  }

  /**
   * Atomically verify receipt, confirm goods receipt, update inventory, and mark receipt consumed.
   */
  async verifyAndReleaseReceipt({ receiptCode, staffId, staffName, destinationBranch, ipAddress = '' }) {
    if (!mongoose.Types.ObjectId.isValid(staffId)) throw new Error('Invalid receiving user.');
    const receipt = await ShipmentReceipt.findOne({ receipt_code: receiptCode }).lean();
    if (!receipt) throw new Error('Receipt not found. Please check the receipt reference code.');
    if (receipt.consumed) throw new Error(`Receipt ${receiptCode} has already been used. Replay prevented.`);
    if (receipt.destination_branch !== destinationBranch) throw new Error('This shipment is assigned to a different destination branch.');
    const shipment = await Shipment.findById(receipt.shipment_id).lean();
    if (!shipment) throw new Error('Associated shipment record not found.');

    const result = await shipmentRepo.confirmReceipt(shipment._id.toString(), {
      receivedItems: [],
      userId: staffId,
      destinationBranch,
      receiptCode,
      ipAddress,
    });
    return {
      success: true,
      receiptCode,
      shipmentId: receipt.shipment_id.toString(),
      productName: receipt.product_name,
      quantity: Number(receipt.quantity),
      receivingReceiptCode: result.receivingReceiptCode,
      ipAddress,
    };
  }
}

module.exports = new ShipmentReceiptRepository();
