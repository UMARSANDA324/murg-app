const crypto = require('crypto');
const { Order, Return, Stock, StockMovement, Debt, User } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');
const { recordAuditLog } = require('../services/auditLogService');

class ReturnsRepositoryMongo {
  async validateOrderForReturn(orderID, facilityID) {
    const order = await Order.findOne({ orderID, facilityID }).lean();
    if (!order) return { valid: false, message: 'Order not found' };

    const lines = await Order.find({ orderID, facilityID }).lean();
    const returned = await Return.aggregate([
      { $match: { orderID, facilityID } },
      { $unwind: '$items' },
      { $group: { _id: '$items.original_order_line_id', quantity: { $sum: '$items.quantity' } } },
    ]);
    const returnedByLine = new Map(returned.map((entry) => [String(entry._id), entry.quantity]));
    const remaining = lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity || 0) - Number(returnedByLine.get(String(line._id)) || 0)), 0);
    if (remaining <= 0) return { valid: false, message: 'This order has already been fully returned' };
    return { valid: true, order, remainingQuantity: remaining };
  }

  async processOrderReturn(orderID, facilityID, staffID, { reason = '' } = {}) {
    if (!mongoose.Types.ObjectId.isValid(staffID)) throw new Error('Invalid user.');
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const orderLines = await Order.find({ orderID, facilityID }).session(session).lean();
        if (!orderLines.length) {
          result = { success: false, message: 'Order not found' };
          return;
        }

        const priorReturns = await Return.aggregate([
          { $match: { orderID, facilityID } },
          { $unwind: '$items' },
          { $group: { _id: '$items.original_order_line_id', quantity: { $sum: '$items.quantity' } } },
        ]).session(session);
        const returnedByLine = new Map(priorReturns.map((entry) => [String(entry._id), Number(entry.quantity)]));
        const eligible = orderLines.map((line) => ({
          line,
          quantity: Math.max(0, Number(line.quantity || 0) - Number(returnedByLine.get(String(line._id)) || 0)),
        })).filter(({ quantity }) => quantity > 0);
        if (!eligible.length) {
          result = { success: false, message: 'This order has already been fully returned' };
          return;
        }

        const user = await User.findById(staffID).select('name').session(session).lean();
        if (!user) throw new Error('Processing user not found.');
        const returnCode = `RET-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
        const [returnMysqlId] = await reserveLegacyIds(Return, 'returnId', 1, session);
        const movementIds = await reserveLegacyIds(StockMovement, 'stockMovementId', eligible.length, session);
        const grossOrderTotal = orderLines.reduce((total, line) => total + (
          Number(line.subtotal) || (Number(line.price) || 0) * (Number(line.quantity) || 0)
        ), 0);
        const orderDiscount = Number(orderLines[0].discount) || 0;
        const itemDiscountTotal = orderLines.reduce((total, line) => total +
          (Number(line.item_discount) || 0) * (Number(line.quantity) || 0), 0);
        const calculatedNetTotal = Math.max(0, grossOrderTotal - orderDiscount - itemDiscountTotal);
        const orderNetTotal = Number(orderLines[0].net_total) || calculatedNetTotal;
        const orderOutstanding = Math.max(0, orderNetTotal - (Number(orderLines[0].amount_paid) || 0));
        const debtShare = orderNetTotal > 0 ? Math.min(1, orderOutstanding / orderNetTotal) : 0;
        let returnedAmount = 0;
        const returnItems = [];
        const movementDocs = [];
        let debtAmount = 0;
        let customerID = orderLines[0].customerID || null;

        for (const [index, { line, quantity }] of eligible.entries()) {
          if (!mongoose.Types.ObjectId.isValid(String(line.stockID))) throw new Error(`Stock reference for "${line.item}" is invalid.`);
          const stock = await Stock.findOne({ _id: line.stockID, facilityID }).session(session).lean();
          if (!stock) throw new Error(`Stock item for "${line.item}" no longer exists in this branch.`);
          const before = Number(stock.quantity) || 0;
          const after = before + quantity;
          const update = await Stock.updateOne(
            { _id: stock._id, facilityID },
            { $inc: { quantity, new_order: quantity }, $set: { updatedAt: new Date() } },
            { session }
          );
          if (!update.matchedCount) throw new Error(`Could not restore stock for "${line.item}".`);

          const originalQuantity = Number(line.quantity) || 0;
          const lineGross = Number(line.subtotal) || (Number(line.price) || 0) * originalQuantity;
          const itemDiscount = (Number(line.item_discount) || 0) * originalQuantity;
          const allocatedOrderDiscount = grossOrderTotal > 0 ? orderDiscount * (lineGross / grossOrderTotal) : 0;
          const lineNet = Math.max(0, lineGross - itemDiscount - allocatedOrderDiscount);
          const lineAmount = originalQuantity > 0 ? lineNet * (quantity / originalQuantity) : 0;
          const unitPrice = originalQuantity > 0 ? lineNet / originalQuantity : 0;
          returnedAmount += lineAmount;
          if (String(line.payment).toLowerCase() === 'credit' || Number(line.status) === 0) debtAmount += lineAmount * debtShare;
          customerID = line.customerID || customerID;

          const movement = {
            mysqlId: movementIds[index],
            facilityID,
            store_id: stock.store_id || null,
            stock_id: stock._id,
            movement_type: 'STOCK_IN_RETURN',
            quantity_change: quantity,
            quantity_before: before,
            quantity_after: after,
            reference_type: 'returns',
            reference_id: returnCode,
            notes: `Return from order ${orderID}`,
            performed_by: staffID,
          };
          movementDocs.push(movement);
          returnItems.push({
            original_order_line_id: line._id,
            stock_id: stock._id,
            item: line.item,
            quantity,
            price: unitPrice,
            amount: lineAmount,
          });
        }

        const createdMovements = await StockMovement.create(movementDocs, { session });
        createdMovements.forEach((movement, index) => { returnItems[index].stock_movement_id = movement._id; });

        let debtReversed = 0;
        if (customerID && debtAmount > 0) {
          const debt = await Debt.findOne({ customerID, facilityID }).session(session);
          if (debt && Number(debt.balance) > 0) {
            debtReversed = Math.min(Number(debt.balance), debtAmount);
            debt.balance = Math.max(0, Number(debt.balance) - debtReversed);
            debt.updatedAt = new Date();
            await debt.save({ session });
          }
        }

        const [returnRecord] = await Return.create([{
          mysqlId: returnMysqlId,
          return_code: returnCode,
          orderID,
          facilityID,
          customerID,
          customer_name: orderLines[0].customer_name || orderLines[0].buyer_name || null,
          reason,
          processed_by: staffID,
          processed_by_name: user.name,
          returned_amount: returnedAmount,
          debt_reversed: debtReversed,
          items: returnItems,
        }], { session });

        await recordAuditLog({
          facilityID,
          user_id: staffID,
          user_name: user.name,
          action: 'ORDER_RETURN_PROCESSED',
          entity_type: 'orders',
          entity_id: orderID,
          old_values: {},
          new_values: {
            return_id: returnRecord._id.toString(),
            return_code: returnCode,
            returned_amount: returnedAmount,
            debt_reversed: debtReversed,
            item_count: returnItems.length,
            reason,
          },
        }, session);

        result = {
          success: true,
          returnId: returnRecord._id.toString(),
          returnCode,
          orderID,
          itemsReturned: returnItems.length,
          stockRestored: true,
          debtReversed: debtReversed > 0,
          debtReversedAmount: debtReversed,
          totalReversed: returnedAmount,
          message: `Order #${orderID} return recorded successfully`,
        };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = new ReturnsRepositoryMongo();