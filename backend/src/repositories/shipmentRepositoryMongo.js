const crypto = require('crypto');
const { Shipment, ShipmentReceipt, Stock, StockMovement, Store, Branch, User } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');
const { recordAuditLog } = require('../services/auditLogService');

async function branchNameMap(shipments) {
  const ids = [...new Set(shipments.flatMap((s) => [s.source_branch, s.destination_branch]))];
  const branches = await Branch.find({ facilityID: { $in: ids } }).select('facilityID name').lean();
  return new Map(branches.map((branch) => [branch.facilityID, branch.name]));
}

function shipmentDTO(shipment, names) {
  const items = (shipment.items || []).map((item) => ({
    ...item,
    id: item._id.toString(),
    stock_id: item.stock_id?._id?.toString() || item.stock_id?.toString() || null,
    product_name: item.product_name || item.stock_id?.name,
  }));
  return {
    ...shipment,
    id: shipment._id.toString(),
    created_at: shipment.createdAt,
    source_branch_name: names.get(shipment.source_branch) || shipment.source_branch,
    destination_branch_name: names.get(shipment.destination_branch) || shipment.destination_branch,
    dispatched_by_name: shipment.dispatched_by?.name || null,
    received_by_name: shipment.received_by?.name || null,
    item_count: items.length,
    total_quantity_sent: items.reduce((sum, item) => sum + Number(item.quantity_sent || 0), 0),
    items,
  };
}

class ShipmentRepositoryMongo {
  async findAll({ facilityID = null, status = null, isGlobalAdmin = false } = {}) {
    const query = {};
    if (!isGlobalAdmin && facilityID) query.$or = [{ source_branch: facilityID }, { destination_branch: facilityID }];
    if (status) query.status = status;
    const rows = await Shipment.find(query)
      .populate('items.stock_id', 'name').populate('dispatched_by', 'name').populate('received_by', 'name')
      .sort({ createdAt: -1 }).lean();
    const names = await branchNameMap(rows);
    return rows.map((row) => shipmentDTO(row, names));
  }

  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const row = await Shipment.findById(id)
      .populate('items.stock_id', 'name').populate('dispatched_by', 'name').populate('received_by', 'name').lean();
    if (!row) return null;
    return shipmentDTO(row, await branchNameMap([row]));
  }

  async createAndDispatch({ sourceBranch, destinationBranch, sourceStoreId = null, destinationStoreId = null, items, notes = '', userId }) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !Array.isArray(items) || !items.length) {
      throw new Error('A valid dispatching user and at least one item are required.');
    }

    const stockRollbacks = [];
    let shipmentId = null;

    try {
      const [source, destination] = await Promise.all([
        Branch.findOne({ facilityID: sourceBranch, status: 'active' }).lean(),
        Branch.findOne({ facilityID: destinationBranch, status: 'active' }).lean(),
      ]);
      if (!source || !destination) throw new Error('Source or destination branch not found or inactive.');
      if (sourceBranch === destinationBranch) throw new Error('Source and destination branches cannot be the same.');

      for (const [storeId, branchId] of [[sourceStoreId, sourceBranch], [destinationStoreId, destinationBranch]]) {
        if (storeId && (!mongoose.Types.ObjectId.isValid(storeId) || !await Store.exists({ _id: storeId, branch_id: branchId, status: 'active' }))) {
          throw new Error('Shipment store not found for the selected branch.');
        }
      }

      const validated = [];
      for (const item of items) {
        const quantity = Number(item.quantity);
        if (!mongoose.Types.ObjectId.isValid(item.stockId) || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Shipment item ID or quantity is invalid.');
        }

        const query = { _id: item.stockId, facilityID: sourceBranch, status: 'active' };
        if (sourceStoreId) query.store_id = sourceStoreId;

        const stock = await Stock.findOne(query).lean();
        if (!stock) throw new Error(`Product ID ${item.stockId} not found in source branch.`);

        const before = Number(stock.quantity) || 0;
        if (quantity > before) {
          throw new Error(`Insufficient stock for "${stock.name}". Available: ${before}, Sending: ${quantity}.`);
        }

        validated.push({ stock, quantity, before });
      }

      const trackingNumber = `TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const [shipmentIdFromLegacy] = await reserveLegacyIds(Shipment, 'shipmentId', 1);
      const [shipment] = await Shipment.create([{
        mysqlId: shipmentIdFromLegacy,
        tracking_number: trackingNumber,
        source_branch: sourceBranch,
        destination_branch: destinationBranch,
        source_store_id: sourceStoreId || null,
        destination_store_id: destinationStoreId || null,
        status: 'In Transit',
        dispatched_by: userId,
        dispatched_at: new Date(),
        created_by: userId,
        notes,
        items: validated.map(({ stock, quantity }) => ({
          stock_id: stock._id,
          product_name: stock.name,
          quantity_sent: quantity,
          quantity_received: 0,
        })),
      }]);
      shipmentId = shipment._id.toString();

      const movementIds = await reserveLegacyIds(StockMovement, 'stockMovementId', validated.length);
      for (const [index, { stock, quantity, before }] of validated.entries()) {
        const updatedStock = await Stock.findOneAndUpdate(
          { _id: stock._id, facilityID: sourceBranch, quantity: { $gte: quantity } },
          { $inc: { quantity: -quantity, out_stocks: quantity } },
          { new: true }
        );

        if (!updatedStock) {
          throw new Error(`Insufficient stock for "${stock.name}".`);
        }

        stockRollbacks.push({
          stockId: stock._id,
          facilityID: sourceBranch,
          quantity,
          outStocks: quantity,
        });

        await StockMovement.create({
          mysqlId: movementIds[index],
          facilityID: sourceBranch,
          store_id: stock.store_id || sourceStoreId || null,
          stock_id: stock._id,
          movement_type: 'STOCK_OUT_TRANSFER',
          quantity_change: -quantity,
          quantity_before: before,
          quantity_after: before - quantity,
          reference_type: 'shipments',
          reference_id: shipment._id.toString(),
          notes: `Shipment to ${destinationBranch}`,
          performed_by: userId,
        });
      }

      return { id: shipment._id.toString(), shipmentId: shipment._id.toString(), trackingNumber };
    } catch (error) {
      // Safe rollback: if the deployment does not support transactional multi-document writes,
      // reverse any stock deductions that already succeeded before the failing step.
      for (const rollback of stockRollbacks.slice().reverse()) {
        await Stock.updateOne(
          { _id: rollback.stockId, facilityID: rollback.facilityID },
          { $inc: { quantity: rollback.quantity, out_stocks: -rollback.outStocks } }
        );
      }

      if (shipmentId) {
        await StockMovement.deleteMany({ reference_id: shipmentId, reference_type: 'shipments', movement_type: 'STOCK_OUT_TRANSFER' });
        await Shipment.deleteOne({ _id: shipmentId });
      }

      throw error;
    }
  }

  async confirmReceipt(shipmentId, { receivedItems, userId, destinationBranch, receiptCode = null, ipAddress = '' }) {
    if (!mongoose.Types.ObjectId.isValid(shipmentId) || !mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error('Invalid shipment or receiving user.');
    }

    const stockRollbacks = [];
    let shipmentStatusBefore = null;
    let currentShipmentId = shipmentId;

    try {
      const shipment = await Shipment.findById(shipmentId);
      if (!shipment) throw new Error('Shipment not found.');
      if (shipment.status !== 'In Transit') throw new Error(`Cannot receive shipment with status '${shipment.status}'.`);
      if (shipment.destination_branch !== destinationBranch) throw new Error('Only staff at the destination branch may confirm receipt.');

      shipmentStatusBefore = shipment.status;

      let receipt = null;
      if (receiptCode) {
        receipt = await ShipmentReceipt.findOne({ receipt_code: receiptCode });
        if (!receipt || String(receipt.shipment_id) !== String(shipment._id)) throw new Error('Receipt not found or not associated with this shipment.');
        if (receipt.consumed) throw new Error(`Receipt ${receiptCode} has already been used. Replay prevented.`);
        if (receipt.destination_branch !== destinationBranch) throw new Error('This receipt is assigned to a different destination branch.');
        receipt.consumed = true;
        receipt.consumed_by = userId;
        receipt.consumed_by_name = (await User.findById(userId).select('name').lean())?.name || 'Unknown';
        receipt.consumed_at = new Date();
      }

      const destination = await Branch.findOne({ facilityID: destinationBranch, status: 'active' }).lean();
      if (!destination) throw new Error('Destination branch not found or inactive.');
      if (shipment.destination_store_id && !await Store.exists({ _id: shipment.destination_store_id, branch_id: destinationBranch, status: 'active' })) {
        throw new Error('Destination store no longer exists or is inactive.');
      }

      const supplied = Array.isArray(receivedItems) ? receivedItems : [];
      const itemIds = new Set(shipment.items.map((item) => item._id.toString()));
      if (supplied.some((item) => !itemIds.has(String(item.id)))) throw new Error('Received items do not match this shipment.');

      const receiver = await User.findById(userId).select('name').lean();
      const isPerYard = destination.sales_mode === 'PER_YARD';
      const receiptLines = [];
      for (const item of shipment.items) {
        const receivedEntry = supplied.find((entry) => String(entry.id) === item._id.toString());
        const received = receivedEntry ? Number(receivedEntry.quantityReceived) : Number(item.quantity_sent);
        if (!Number.isFinite(received) || received < 0 || received > item.quantity_sent) {
          throw new Error(`Received quantity for "${item.product_name}" must be between 0 and ${item.quantity_sent}.`);
        }

        item.quantity_received = received;
        const sourceStock = await Stock.findOne({ _id: item.stock_id, facilityID: shipment.source_branch }).lean();
        if (!sourceStock) throw new Error(`Original stock item for "${item.product_name}" is unavailable.`);

        const yardsPerBelt = Number(sourceStock.yards_per_belt) || 100;
        const quantity = isPerYard && sourceStock.unit_type === 'belt' ? received * yardsPerBelt : received;
        const unitType = isPerYard && sourceStock.unit_type === 'belt' ? 'yard' : (sourceStock.unit_type || 'belt');
        let before = 0;

        if (quantity > 0) {
          const query = { name: item.product_name, facilityID: destinationBranch, status: 'active' };
          if (shipment.destination_store_id) query.store_id = shipment.destination_store_id;
          const target = await Stock.findOne(query).lean();
          if (target) {
            before = Number(target.quantity) || 0;
            const updatedTarget = await Stock.findOneAndUpdate(
              { _id: target._id, facilityID: destinationBranch },
              { $inc: { quantity, new_order: quantity }, $set: { unit_type: unitType } },
              { new: true }
            );
            if (!updatedTarget) throw new Error(`Unable to update target stock for "${item.product_name}".`);
            stockRollbacks.push({ stockId: target._id, facilityID: destinationBranch, quantity, increase: quantity });
            receiptLines.push({ item, stockId: target._id, quantity, unitType, before });
          } else {
            const [stockMysqlId] = await reserveLegacyIds(Stock, 'stockId', 1);
            const createdStock = await Stock.create({
              mysqlId: stockMysqlId,
              facilityID: destinationBranch,
              store_id: shipment.destination_store_id || null,
              name: item.product_name,
              unit_type: unitType,
              yards_per_belt: yardsPerBelt,
              selling: sourceStock.selling,
              buying: sourceStock.buying,
              price_per_yard: sourceStock.price_per_yard ?? (isPerYard ? Number(sourceStock.selling) / yardsPerBelt : null),
              quantity,
              new_order: quantity,
              opening_quantity: 0,
              Bsubtotal: Number(sourceStock.buying || 0) * quantity,
              Ssubtotal: Number(sourceStock.selling || 0) * quantity,
              status: 'active',
            });
            stockRollbacks.push({ stockId: createdStock._id, facilityID: destinationBranch, quantity, increase: quantity, created: true });
            receiptLines.push({ item, stockId: createdStock._id, quantity, unitType, before: 0 });
          }
        } else {
          receiptLines.push({ item, stockId: null, quantity: 0, unitType, before: 0 });
        }
      }

      const movements = receiptLines.filter((line) => line.quantity > 0);
      const movementIds = await reserveLegacyIds(StockMovement, 'stockMovementId', movements.length);
      let movementIndex = 0;
      for (const line of receiptLines) {
        if (line.quantity > 0) {
          await StockMovement.create({
            mysqlId: movementIds[movementIndex++],
            facilityID: destinationBranch,
            store_id: shipment.destination_store_id || null,
            stock_id: line.stockId,
            movement_type: 'STOCK_IN_TRANSFER',
            quantity_change: line.quantity,
            quantity_before: line.before,
            quantity_after: line.before + line.quantity,
            reference_type: 'shipments',
            reference_id: shipment._id.toString(),
            notes: `Received from ${shipment.source_branch}`,
            performed_by: userId,
          });

          if (line.item.quantity_received < line.item.quantity_sent) {
            await recordAuditLog({
              facilityID: destinationBranch,
              user_id: userId,
              user_name: receiver?.name || 'Unknown',
              action: 'SHIPMENT_RECEIPT_DISCREPANCY',
              entity_type: 'shipments',
              entity_id: shipment._id.toString(),
              old_values: { product_name: line.item.product_name, quantity_sent: line.item.quantity_sent },
              new_values: { quantity_received: line.item.quantity_received },
            });
          }
        }
      }

      const receivedAt = new Date();
      const receivingReceiptCode = `RCV-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      shipment.status = 'Received';
      shipment.received_by = userId;
      shipment.received_at = receivedAt;
      shipment.receiving_receipt_code = receivingReceiptCode;
      await shipment.save();

      if (receipt) {
        await receipt.save();
      }

      if (receipt?.request_id) {
        const { GoodsRequest } = require('../models');
        await GoodsRequest.updateOne({ _id: receipt.request_id }, { status: 'RECEIVED', updatedAt: receivedAt });
      }

      if (receipt) {
        await recordAuditLog({
          facilityID: destinationBranch,
          user_id: userId,
          user_name: receiver?.name || 'Unknown',
          action: 'SHIPMENT_RECEIPT_VERIFIED_AND_RELEASED',
          entity_type: 'shipment_receipts',
          entity_id: receipt._id.toString(),
          ip_address: ipAddress,
          new_values: { shipment_id: shipment._id.toString(), receipt_code: receipt.receipt_code },
        });
      }

      const [receiptMysqlId] = await reserveLegacyIds(ShipmentReceipt, 'shipmentReceiptId', 1);
      await ShipmentReceipt.create({
        mysqlId: receiptMysqlId,
        receipt_code: receivingReceiptCode,
        receipt_type: 'RECEIVING',
        shipment_id: shipment._id,
        source_branch: shipment.source_branch,
        destination_branch: shipment.destination_branch,
        product_name: shipment.items.length === 1 ? shipment.items[0].product_name : `${shipment.items.length} shipment items`,
        quantity: receiptLines.reduce((sum, line) => sum + line.quantity, 0),
        unit_type: isPerYard ? 'yard' : (receiptLines[0]?.unitType || 'belt'),
        dispatched_by: shipment.dispatched_by || shipment.created_by || userId,
        dispatched_by_name: (await User.findById(shipment.dispatched_by || shipment.created_by || userId).select('name').lean())?.name || 'Unknown',
        consumed: true,
        consumed_by: userId,
        consumed_by_name: receiver?.name || 'Unknown',
        consumed_at: receivedAt,
      });

      return { receiptCode: receivingReceiptCode, receivingReceiptCode, shipmentId: shipment._id.toString() };
    } catch (error) {
      for (const rollback of stockRollbacks.slice().reverse()) {
        await Stock.updateOne(
          { _id: rollback.stockId, facilityID: rollback.facilityID },
          { $inc: { quantity: -rollback.quantity, new_order: -rollback.quantity } }
        );
        if (rollback.created) {
          await Stock.deleteOne({ _id: rollback.stockId });
        }
      }

      if (shipmentStatusBefore && shipmentStatusBefore !== 'Received') {
        const shipment = await Shipment.findById(currentShipmentId).lean();
        if (shipment) {
          await Shipment.updateOne({ _id: currentShipmentId }, { $set: { status: shipmentStatusBefore } });
        }
      }

      if (currentShipmentId) {
        await StockMovement.deleteMany({ reference_id: currentShipmentId, reference_type: 'shipments' });
      }

      throw error;
    }
  }

  async receiveShipment(id, facilityID, receivedBy, receivedItems = null) {
    return this.confirmReceipt(id, { receivedItems, userId: receivedBy, destinationBranch: facilityID });
  }
}

module.exports = new ShipmentRepositoryMongo();
