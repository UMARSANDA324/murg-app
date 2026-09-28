const { Stock, Store, Branch, Purchase, StockMovement, User, Order } = require('../models');
const { mongoose } = require('../config/mongodb');

/**
 * StockRepositoryMongo — MongoDB-based inventory management.
 * Preserves all business logic from MySQL version including transactions.
 */
class StockRepositoryMongo {
  /**
   * List all stocks for a branch, optionally filtered by store.
   */
  async findAll({ facilityID, storeId = null, search = null, status = 'active' } = {}) {
    const query = { facilityID };
    if (status) query.status = status;
    if (storeId) query.store_id = storeId;
    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }];
    }

    const stocks = await Stock.find(query)
      .populate('store_id', 'store_name status')
      .sort({ name: 1 })
      .lean();

    return stocks.map(s => ({
      ...s,
      quantity: parseFloat(s.quantity) || 0,
      buying: parseFloat(s.buying) || 0,
      selling: parseFloat(s.selling) || 0,
      price_per_yard: s.price_per_yard !== null && s.price_per_yard !== undefined ? parseFloat(s.price_per_yard) : null,
      yards_per_belt: s.yards_per_belt !== null && s.yards_per_belt !== undefined ? parseFloat(s.yards_per_belt) : null,
      store_name: s.store_id?.store_name || null,
      store_status: s.store_id?.status || null,
    }));
  }

  /**
   * Get a single stock item, scoped to branch.
   */
  async findById(id, facilityID) {
    const stock = await Stock.findOne({ _id: id, facilityID })
      .populate('store_id', 'store_name status')
      .lean();
    
    if (!stock) return null;
    
    return {
      ...stock,
      quantity: parseFloat(stock.quantity) || 0,
      buying: parseFloat(stock.buying) || 0,
      selling: parseFloat(stock.selling) || 0,
      price_per_yard: stock.price_per_yard !== null && stock.price_per_yard !== undefined ? parseFloat(stock.price_per_yard) : null,
      yards_per_belt: stock.yards_per_belt !== null && stock.yards_per_belt !== undefined ? parseFloat(stock.yards_per_belt) : null,
      store_name: stock.store_id?.store_name || null,
    };
  }

  /**
   * Get a stock item locked for update (inside a transaction).
   */
  async findByIdForUpdate(session, id, facilityID) {
    const stock = await Stock.findOne({ _id: id, facilityID })
      .session(session)
      .lean();
    return stock || null;
  }

  /**
   * Decrement stock quantity (inside a transaction).
   * Also increments out_stocks accumulator.
   */
  async decrementQuantity(session, id, quantity) {
    await Stock.findByIdAndUpdate(
      id,
      {
        $inc: { quantity: -quantity, out_stocks: quantity },
      },
      { session }
    );
  }

  /**
   * Increment stock quantity (for receiving, returns, or incoming transfers).
   */
  async incrementQuantity(session, id, quantity) {
    await Stock.findByIdAndUpdate(
      id,
      {
        $inc: { quantity: quantity, new_order: quantity },
      },
      { session }
    );
  }

  /**
   * Update selling, buying, price_per_yard, and yards_per_belt (Admin only).
   */
  async updatePrice(id, { selling, buying, price_per_yard = null, yards_per_belt = null }, facilityID) {
    const updateData = {
      selling,
      buying,
      Ssubtotal: selling * (await Stock.findById(id)).quantity,
      Bsubtotal: buying * (await Stock.findById(id)).quantity,
    };
    if (price_per_yard !== undefined && price_per_yard !== null) {
      updateData.price_per_yard = price_per_yard;
    }
    if (yards_per_belt !== undefined && yards_per_belt !== null) {
      updateData.yards_per_belt = yards_per_belt;
    }

    const result = await Stock.updateOne({ _id: id, facilityID }, updateData);
    return result.modifiedCount > 0;
  }

  /**
   * Dedicated yard configuration update (Admin only).
   */
  async updateYardConfig(id, { price_per_yard, yards_per_belt }, facilityID) {
    const result = await Stock.updateOne(
      { _id: id, facilityID },
      { price_per_yard, yards_per_belt }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Record new stock receipt (supplier intake).
   * Automatically converts belts to yards when receiving in a PER_YARD branch.
   */
  async receiveStock(session, {
    facilityID, storeId, stockId, quantity, costPrice, purchaseFrom, forDesc, amountPaid, performedBy, unitType
  }) {
    // Get current quantity, unit type, and branch sales mode
    const stock = await Stock.findOne({ _id: stockId, facilityID })
      .populate('facilityID')
      .session(session)
      .lean();
    
    if (!stock) throw new Error('Stock item not found');

    const branch = await Branch.findOne({ facilityID }).session(session).lean();
    const isPerYard = branch?.sales_mode === 'PER_YARD';
    const yardsPerBelt = parseFloat(stock.yards_per_belt) || 100;

    let receivedQuantity = quantity;
    let conversionNote = '';

    // If receiving in PER_YARD branch and unit received is 'belt', convert to yards
    if (isPerYard && unitType === 'belt') {
      receivedQuantity = quantity * yardsPerBelt;
      conversionNote = ` [Converted: ${quantity} belts × ${yardsPerBelt} yds/belt = ${receivedQuantity} yards]`;
    }

    const currentQty = parseFloat(stock.quantity) || 0;
    const newQty = currentQty + receivedQuantity;
    const totalCost = costPrice * quantity;
    const balance = totalCost - amountPaid;

    // Increment stock
    const nextUnitType = isPerYard ? 'yard' : (stock.unit_type || 'belt');
    await Stock.findByIdAndUpdate(
      stockId,
      {
        quantity: newQty,
        new_order: stock.new_order + receivedQuantity,
        unit_type: nextUnitType,
        Bsubtotal: stock.buying * newQty,
      },
      { session }
    );

    // Record in purchase_history
    const purchase = await Purchase.create(
      [{
        facilityID,
        stock_id: stockId,
        initial_quantity: currentQty,
        stock_name: stock.name,
        quantity: receivedQuantity,
        cost_price: costPrice,
        total_cost: totalCost,
        amount_paid: amountPaid,
        balance: balance,
        for_desc: (forDesc || '') + conversionNote,
        purchase_date: new Date(),
        purchase_from: purchaseFrom,
        mysqlId: Date.now(),
      }],
      { session }
    );

    // Record in stock_movements ledger
    await StockMovement.create(
      [{
        facilityID,
        store_id: storeId || null,
        stock_id: stockId,
        movement_type: 'STOCK_IN_SUPPLIER',
        quantity_change: receivedQuantity,
        quantity_before: currentQty,
        quantity_after: newQty,
        reference_type: 'purchase_history',
        reference_id: String(purchase[0]._id),
        notes: `From: ${purchaseFrom}${conversionNote}`,
        performed_by: performedBy,
        mysqlId: Date.now(),
      }],
      { session }
    );

    return {
      purchaseHistoryId: purchase[0]._id,
      newQuantity: newQty,
      quantityAdded: receivedQuantity,
      unitType: nextUnitType,
    };
  }

  /**
   * Get stock movement history for a branch.
   * Enriched with order metadata for sales movements.
   */
  async getMovements({ facilityID, stockId = null, startDate = null, endDate = null, limit = 500, offset = 0 } = {}) {
    const matchQuery = { facilityID };
    if (stockId) matchQuery.stock_id = stockId;
    if (startDate) matchQuery.created_at = { ...matchQuery.created_at, $gte: new Date(startDate) };
    if (endDate) matchQuery.created_at = { ...matchQuery.created_at, $lte: new Date(endDate) };

    const movements = await StockMovement.find(matchQuery)
      .populate('stock_id', 'name')
      .populate('performed_by', 'name')
      .sort({ created_at: -1 })
      .limit(Math.min(Math.max(parseInt(limit) || 500, 1), 500))
      .skip(Math.max(parseInt(offset) || 0, 0))
      .lean();

    // Enrich with order data for sales movements
    const enriched = await Promise.all(
      movements.map(async (sm) => {
        let orderData = {};
        if (sm.reference_type === 'orders') {
          const order = await Order.findOne({ orderID: sm.reference_id }).lean();
          if (order) {
            orderData = {
              order_payment: order.payment,
              order_status: order.status,
              order_customer_name: order.customer_name,
              order_buyer_name: order.buyer_name,
              order_net_total: order.net_total,
              order_amount_paid: order.amount_paid,
              is_credit: order.payment === 'credit' || order.status === 0 ? 1 : 0,
            };
          }
        }

        return {
          ...sm,
          business_date: sm.createdAt.toISOString().split('T')[0],
          business_time: sm.createdAt.toTimeString().split(' ')[0].substring(0, 5),
          product_name: sm.stock_id?.name || null,
          performed_by_name: sm.performed_by?.name || null,
          ...orderData,
        };
      })
    );

    return enriched;
  }

  /**
   * Get all stores for a branch.
   */
  async getStores(facilityID) {
    return await Store.find({ branch_id: facilityID, status: 'active' })
      .sort({ store_name: 1 })
      .lean();
  }

  /**
   * Get store by ID
   */
  async getStoreById(id, facilityID) {
    return await Store.findOne({ _id: id, branch_id: facilityID }).lean();
  }

  /**
   * Create new store
   */
  async createStore({ facilityID, storeName, branchId, status = 'active' }) {
    // Check for duplicate store name in same branch
    const existing = await Store.findOne({ store_name: storeName, branch_id: branchId });
    if (existing) {
      throw new Error('A store with this name already exists for this branch');
    }

    const store = await Store.create({
      store_name: storeName,
      branch_id: branchId,
      status,
      mysqlId: Date.now(),
    });
    return store._id;
  }

  /**
   * Update store
   */
  async updateStore(id, { facilityID, storeName, branchId, status }) {
    // Check for duplicate store name (excluding current store)
    const existing = await Store.findOne({
      store_name: storeName,
      branch_id: branchId,
      _id: { $ne: id },
    });
    if (existing) {
      throw new Error('A store with this name already exists for this branch');
    }

    const result = await Store.updateOne(
      { _id: id },
      { store_name: storeName, branch_id: branchId, status }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Delete store (soft delete by setting status to inactive)
   */
  async deleteStore(id, facilityID) {
    const result = await Store.updateOne(
      { _id: id, branch_id: facilityID },
      { status: 'inactive' }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Get purchase history for a branch with optional date filtering
   */
  async getPurchaseHistory({ facilityID, month = null, year = null, fromDate = null, toDate = null, limit = 100 }) {
    const matchQuery = { facilityID };
    
    if (month && year) {
      matchQuery.purchase_date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    } else if (fromDate && toDate) {
      matchQuery.purchase_date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    }

    const purchases = await Purchase.find(matchQuery)
      .populate('stock_id', 'name')
      .sort({ purchase_date: -1 })
      .limit(limit)
      .lean();

    return purchases.map(p => ({
      ...p,
      stock_name: p.stock_id?.name || null,
    }));
  }

  /**
   * Get purchase totals for a branch with optional date filtering
   */
  async getPurchaseTotals({ facilityID, month = null, year = null, fromDate = null, toDate = null }) {
    const matchQuery = { facilityID };
    
    if (month && year) {
      matchQuery.purchase_date = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
    } else if (fromDate && toDate) {
      matchQuery.purchase_date = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate),
      };
    } else {
      // Default to today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      matchQuery.purchase_date = { $gte: today, $lt: tomorrow };
    }

    const result = await Purchase.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_purchase: { $sum: '$total_cost' },
          total_paid: { $sum: '$amount_paid' },
          total_balance: { $sum: '$balance' },
          transaction_count: { $sum: 1 },
        },
      },
    ]);

    const row = result[0] || {};
    return {
      total_purchase: parseFloat(row.total_purchase || 0),
      total_paid: parseFloat(row.total_paid || 0),
      total_balance: parseFloat(row.total_balance || 0),
      transaction_count: parseInt(row.transaction_count || 0),
    };
  }

  /**
   * Global catalog search — returns distinct product names across ALL branches.
   * Intentionally has no facilityID filter.
   * Used by the Goods Request form so staff can request any product in the system.
   */
  async globalCatalogSearch({ search = null, limit = 50 } = {}) {
    const matchQuery = { status: 'active' };
    if (search && search.trim()) {
      matchQuery.name = { $regex: search.trim(), $options: 'i' };
    }

    const stocks = await Stock.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { name: '$name', unit_type: '$unit_type' },
          representative_id: { $first: '$_id' },
          name: { $first: '$name' },
          unit_type: { $first: '$unit_type' },
        },
      },
      { $sort: { name: 1 } },
      { $limit: limit },
    ]);

    return stocks.map(s => ({
      id: s.representative_id,
      name: s.name,
      unit_type: s.unit_type,
    }));
  }
}

module.exports = new StockRepositoryMongo();
