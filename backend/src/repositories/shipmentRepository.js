const db = require('../config/database');

/**
 * ShipmentRepository — Handles inter-branch stock transfers and tracking.
 * Strictly guarantees:
 * 1. Stock is deducted from source branch upon dispatch.
 * 2. Stock is NEVER credited to destination branch until physical receipt confirmation.
 */
class ShipmentRepository {
  async findAll({ facilityID, status = null, isGlobalAdmin = false } = {}) {
    let sql = `
      SELECT s.*, 
             sb.name as source_branch_name, 
             db.name as destination_branch_name,
             f1.name as dispatched_by_name,
             f2.name as received_by_name,
             COUNT(si.id) as item_count,
             SUM(si.quantity_sent) as total_quantity_sent
      FROM shipments s
      LEFT JOIN branch sb ON s.source_branch = sb.facilityID
      LEFT JOIN branch db ON s.destination_branch = db.facilityID
      LEFT JOIN facility f1 ON s.dispatched_by = f1.id
      LEFT JOIN facility f2 ON s.received_by = f2.id
      LEFT JOIN shipment_items si ON s.id = si.shipment_id
      WHERE 1=1
    `;
    const params = [];

    if (!isGlobalAdmin && facilityID) {
      sql += ' AND (s.source_branch = ? OR s.destination_branch = ?)';
      params.push(facilityID, facilityID);
    }
    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    sql += ' GROUP BY s.id ORDER BY s.created_at DESC';
    const [rows] = await db.query(sql, params);
    return rows;
  }

  async findById(id) {
    const [rows] = await db.query(
      `SELECT s.*, 
              sb.name as source_branch_name, 
              db.name as destination_branch_name,
              f1.name as dispatched_by_name,
              f2.name as received_by_name
       FROM shipments s
       LEFT JOIN branch sb ON s.source_branch = sb.facilityID
       LEFT JOIN branch db ON s.destination_branch = db.facilityID
       LEFT JOIN facility f1 ON s.dispatched_by = f1.id
       LEFT JOIN facility f2 ON s.received_by = f2.id
       WHERE s.id = ?`,
      [id]
    );

    if (!rows[0]) return null;

    const [items] = await db.query(
      'SELECT * FROM shipment_items WHERE shipment_id = ?',
      [id]
    );

    return {
      ...rows[0],
      items: items.map(i => ({
        ...i,
        quantity_sent: parseFloat(i.quantity_sent),
        quantity_received: parseFloat(i.quantity_received),
      })),
    };
  }

  /**
   * Create and Dispatch shipment atomically:
   * 1. Validates source stock
   * 2. Deducts source inventory immediately
   * 3. Writes 'STOCK_OUT_TRANSFER' to stock_movements
   * 4. Creates shipment record with status 'In Transit'
   */
  async createAndDispatch({
    sourceBranch,
    destinationBranch,
    sourceStoreId = null,
    destinationStoreId = null,
    items,
    notes = '',
    userId,
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const trackingNumber = `TRF-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

      // Insert shipment header
      const [shipmentResult] = await conn.query(
        `INSERT INTO shipments 
         (tracking_number, source_branch, destination_branch, source_store_id, destination_store_id, status, dispatched_by, dispatched_at, notes, created_by)
         VALUES (?, ?, ?, ?, ?, 'In Transit', ?, NOW(), ?, ?)`,
        [trackingNumber, sourceBranch, destinationBranch, sourceStoreId, destinationStoreId, userId, notes, userId]
      );
      const shipmentId = shipmentResult.insertId;

      for (const item of items) {
        // Lock stock item in source branch
        const [stockRows] = await conn.query(
          'SELECT id, name, quantity, store_id FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
          [item.stockId, sourceBranch]
        );

        if (!stockRows[0]) {
          throw new Error(`Product ID ${item.stockId} not found in source branch.`);
        }

        const stock = stockRows[0];
        const currentQty = parseFloat(stock.quantity);
        if (item.quantity > currentQty) {
          throw new Error(`Insufficient stock for "${stock.name}". Available: ${currentQty}, Sending: ${item.quantity}.`);
        }

        const newQty = currentQty - item.quantity;

        // Deduct from source branch
        await conn.query(
          'UPDATE stocks SET quantity = ?, out_stocks = out_stocks + ? WHERE id = ?',
          [newQty, item.quantity, item.stockId]
        );

        // Insert shipment item
        await conn.query(
          'INSERT INTO shipment_items (shipment_id, stock_id, product_name, quantity_sent, quantity_received) VALUES (?, ?, ?, ?, 0)',
          [shipmentId, item.stockId, stock.name, item.quantity]
        );

        // Log to immutable stock movement ledger
        await conn.query(
          `INSERT INTO stock_movements 
           (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
           VALUES (?, ?, ?, 'STOCK_OUT_TRANSFER', ?, ?, ?, 'shipments', ?, ?, ?)`,
          [sourceBranch, stock.store_id, item.stockId, -item.quantity, currentQty, newQty, shipmentId, `Transfer to ${destinationBranch}`, userId]
        );
      }

      await conn.commit();
      return { id: shipmentId, shipmentId, trackingNumber };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Confirm receipt at destination branch:
   * 1. Updates shipment status to 'Received'
   * 2. Finds or creates corresponding stock in destination branch
   * 3. Increments destination inventory
   * 4. Writes 'STOCK_IN_TRANSFER' to stock_movements
   */
  async confirmReceipt(shipmentId, { receivedItems, userId, destinationBranch }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [shipmentRows] = await conn.query(
        'SELECT * FROM shipments WHERE id = ? FOR UPDATE',
        [shipmentId]
      );

      if (!shipmentRows[0]) {
        throw new Error('Shipment not found.');
      }

      const shipment = shipmentRows[0];
      if (shipment.status !== 'In Transit') {
        throw new Error(`Cannot receive shipment with status '${shipment.status}'.`);
      }

      if (shipment.destination_branch !== destinationBranch) {
        throw new Error('Only staff at the destination branch may confirm receipt.');
      }

      const [destBranchRows] = await conn.query(
        'SELECT sales_mode FROM branch WHERE facilityID = ?',
        [destinationBranch]
      );
      const isDestPerYard = destBranchRows[0]?.sales_mode === 'PER_YARD';

      const [items] = await conn.query(
        'SELECT * FROM shipment_items WHERE shipment_id = ?',
        [shipmentId]
      );

      for (const item of items) {
        const receivedItem = receivedItems?.find(r => r.id === item.id);
        const rawQtyReceived = receivedItem ? parseFloat(receivedItem.quantityReceived) : parseFloat(item.quantity_sent);

        // Update shipment item with received count (in units sent)
        await conn.query(
          'UPDATE shipment_items SET quantity_received = ? WHERE id = ?',
          [rawQtyReceived, item.id]
        );

        // Get details of the source stock for pricing & unit type
        const [sourceStock] = await conn.query(
          'SELECT name, unit_type, yards_per_belt, buying, selling, price_per_yard FROM stocks WHERE id = ?',
          [item.stock_id]
        );

        const productName = sourceStock[0]?.name || item.product_name;
        const sourceUnitType = sourceStock[0]?.unit_type || 'belt';
        const yardsPerBelt = parseFloat(sourceStock[0]?.yards_per_belt) || 100;

        let effectiveQtyReceived = rawQtyReceived;
        let destUnitType = sourceUnitType;
        let transferNote = `Received from ${shipment.source_branch}`;

        // If destination is PER_YARD branch and goods were dispatched in belts, convert to yards
        if (isDestPerYard && sourceUnitType === 'belt') {
          effectiveQtyReceived = rawQtyReceived * yardsPerBelt;
          destUnitType = 'yard';
          transferNote = `Received ${rawQtyReceived} belts converted to ${effectiveQtyReceived} yards from ${shipment.source_branch}`;
        }

        // Find matching stock in destination branch
        const [destStockRows] = await conn.query(
          'SELECT id, quantity, store_id, unit_type FROM stocks WHERE name = ? AND facilityID = ? LIMIT 1 FOR UPDATE',
          [productName, destinationBranch]
        );

        let destStockId;
        let beforeQty = 0;
        let afterQty = effectiveQtyReceived;

        if (destStockRows[0]) {
          destStockId = destStockRows[0].id;
          beforeQty = parseFloat(destStockRows[0].quantity) || 0;
          afterQty = beforeQty + effectiveQtyReceived;

          await conn.query(
            'UPDATE stocks SET quantity = ?, new_order = new_order + ?, unit_type = ? WHERE id = ?',
            [afterQty, effectiveQtyReceived, destUnitType, destStockId]
          );
        } else {
          // Create new stock record in destination branch
          const buying = sourceStock[0]?.buying || '0';
          const selling = sourceStock[0]?.selling || '0';
          const pricePerYard = sourceStock[0]?.price_per_yard || (isDestPerYard ? (parseFloat(selling) / yardsPerBelt).toFixed(2) : null);

          const [newStockResult] = await conn.query(
            `INSERT INTO stocks 
             (facilityID, store_id, name, unit_type, yards_per_belt, selling, buying, price_per_yard, quantity, opening_quantity, new_order, Bsubtotal, Ssubtotal, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active')`,
            [
              destinationBranch,
              shipment.destination_store_id,
              productName,
              destUnitType,
              yardsPerBelt,
              selling,
              buying,
              pricePerYard,
              effectiveQtyReceived,
              effectiveQtyReceived,
              buying * effectiveQtyReceived,
              selling * effectiveQtyReceived,
            ]
          );
          destStockId = newStockResult.insertId;
        }

        // Log movement in destination branch
        await conn.query(
          `INSERT INTO stock_movements 
           (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
           VALUES (?, ?, ?, 'STOCK_IN_TRANSFER', ?, ?, ?, 'shipments', ?, ?, ?)`,
          [destinationBranch, shipment.destination_store_id, destStockId, effectiveQtyReceived, beforeQty, afterQty, shipmentId, transferNote, userId]
        );
      }

      // Mark shipment as Received
      await conn.query(
        'UPDATE shipments SET status = "Received", received_by = ?, received_at = NOW() WHERE id = ?',
        [userId, shipmentId]
      );

      await conn.commit();
      return { success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new ShipmentRepository();
