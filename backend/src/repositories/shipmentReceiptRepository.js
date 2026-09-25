const db = require('../config/database');
const shipmentRepo = require('./shipmentRepository');

class ShipmentReceiptRepository {
  /**
   * Find shipment receipt details by code.
   */
  async findByReceiptCode(receiptCode) {
    const [rows] = await db.query(
      `SELECT sr.*, s.tracking_number, s.status as shipment_status, s.dispatched_at,
              sb.name as source_branch_name, db.name as destination_branch_name
       FROM shipment_receipts sr
       JOIN shipments s ON sr.shipment_id = s.id
       LEFT JOIN branch sb ON sr.source_branch = sb.facilityID
       LEFT JOIN branch db ON sr.destination_branch = db.facilityID
       WHERE sr.receipt_code = ?`,
      [receiptCode]
    );
    return rows[0] || null;
  }

  /**
   * Atomically verify receipt, confirm goods receipt, update inventory, and mark receipt consumed.
   */
  async verifyAndReleaseReceipt({ receiptCode, staffId, staffName, destinationBranch, ipAddress = '' }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Lock receipt row
      const [receiptRows] = await conn.query(
        'SELECT * FROM shipment_receipts WHERE receipt_code = ? FOR UPDATE',
        [receiptCode]
      );

      if (!receiptRows[0]) {
        throw new Error('Receipt not found. Please check the receipt reference code.');
      }

      const receipt = receiptRows[0];

      // Security check 1: Already consumed
      if (receipt.consumed === 1) {
        throw new Error(`Receipt ${receiptCode} has ALREADY been used and released on ${new Date(receipt.consumed_at).toLocaleString()} by ${receipt.consumed_by_name || 'Staff'}. Replay prevented.`);
      }

      // Security check 2: Destination branch matching
      if (receipt.destination_branch !== destinationBranch) {
        throw new Error(`Access Denied: This shipment is intended for branch ${receipt.destination_branch}, but your account belongs to branch ${destinationBranch}.`);
      }

      // 2. Lock shipment header
      const [shipmentRows] = await conn.query(
        'SELECT * FROM shipments WHERE id = ? FOR UPDATE',
        [receipt.shipment_id]
      );

      if (!shipmentRows[0]) {
        throw new Error('Associated shipment record not found.');
      }

      const shipment = shipmentRows[0];
      if (shipment.status !== 'In Transit') {
        throw new Error(`Shipment status is '${shipment.status}'. Only shipments 'In Transit' can be verified and received.`);
      }

      // 3. Mark receipt consumed BEFORE releasing stock to prevent race condition
      await conn.query(
        `UPDATE shipment_receipts 
         SET consumed = 1, consumed_by = ?, consumed_by_name = ?, consumed_at = NOW() 
         WHERE id = ?`,
        [staffId, staffName, receipt.id]
      );

      // 4. Update associated goods request status if exists
      if (receipt.request_id) {
        await conn.query(
          'UPDATE goods_requests SET status = "RECEIVED" WHERE id = ?',
          [receipt.request_id]
        );
      }

      await conn.commit();
      conn.release();

      // 5. Execute stock intake into destination branch using existing shipment confirmation logic
      // Note: confirmReceipt manages its own transaction and belt-to-yard conversions safely
      await shipmentRepo.confirmReceipt(receipt.shipment_id, {
        receivedItems: [], // Defaults to full quantity sent
        userId: staffId,
        destinationBranch,
      });

      // 6. Write audit trail entry
      await db.query(
        `INSERT INTO audit_logs (action, user_id, user_name, facilityID, entity_type, entity_id, ip_address)
         VALUES ('SHIPMENT_RECEIPT_VERIFIED_AND_RELEASED', ?, ?, ?, 'shipment_receipts', ?, ?)`,
        [staffId, staffName, destinationBranch, receipt.id, ipAddress]
      );

      return {
        success: true,
        receiptCode,
        shipmentId: receipt.shipment_id,
        productName: receipt.product_name,
        quantity: parseFloat(receipt.quantity),
      };
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      try { conn.release(); } catch (_) {}
      throw err;
    }
  }
}

module.exports = new ShipmentReceiptRepository();
