const { Stock, Store, Branch, Purchase, StockMovement, User, Order } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');

/**
 * StockRepositoryMongo — MongoDB-based inventory management.
 * Preserves all business logic from MySQL version including transactions.
 */
class StockRepositoryMongo {
  /**
   * List all stocks for a branch, optionally filtered by store.
   * Strips buying price unless caller is authorized Admin (includeCost: true).
   */
  async findAll({ facilityID, storeId = null, search = null, status = 'active', includeCost = false } = {}) {
    const query = { facilityID };
    if (status) query.status = status;
    if (storeId) query.store_id = storeId;
    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [{ name: { $regex: escapedSearch, $options: 'i' } }];
    }

    const stocks = await Stock.find(query)
      .populate('store_id', 'store_name status')
      .sort({ name: 1 })
      .lean();

    return stocks.map(s => {
      const item = {
        ...s,
        id: s._id.toString(),
        store_id: s.store_id?._id?.toString() || s.store_id?.toString() || null,
        quantity: parseFloat(s.quantity) || 0,
        selling: parseFloat(s.selling) || 0,
        price_per_yard: s.price_per_yard !== null && s.price_per_yard !== undefined ? parseFloat(s.price_per_yard) : null,
        yards_per_belt: s.yards_per_belt !== null && s.yards_per_belt !== undefined ? parseFloat(s.yards_per_belt) : null,
        store_name: s.store_id?.store_name || null,
        store_status: s.store_id?.status || null,
      };
      if (includeCost) {
        item.buying = parseFloat(s.buying) || 0;
        item.Bsubtotal = s.Bsubtotal !== undefined ? parseFloat(s.Bsubtotal) : (item.buying * item.quantity);
      } else {
        delete item.buying;
        delete item.Bsubtotal;
      }
      return item;
    });
  }

  /**
   * Get a single stock item, scoped to branch.
   * Strips buying price unless caller is authorized Admin (includeCost: true).
   */
  async findById(id, facilityID, includeCost = false) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const stock = await Stock.findOne({ _id: id, facilityID })
      .populate('store_id', 'store_name status')
      .lean();
    
    if (!stock) return null;
    
    const item = {
      ...stock,
      id: stock._id.toString(),
      store_id: stock.store_id?._id?.toString() || stock.store_id?.toString() || null,
      quantity: parseFloat(stock.quantity) || 0,
      selling: parseFloat(stock.selling) || 0,
      price_per_yard: stock.price_per_yard !== null && stock.price_per_yard !== undefined ? parseFloat(stock.price_per_yard) : null,
      yards_per_belt: stock.yards_per_belt !== null && stock.yards_per_belt !== undefined ? parseFloat(stock.yards_per_belt) : null,
      store_name: stock.store_id?.store_name || null,
    };
    if (includeCost) {
      item.buying = parseFloat(stock.buying) || 0;
      item.Bsubtotal = stock.Bsubtotal !== undefined ? parseFloat(stock.Bsubtotal) : (item.buying * item.quantity);
    } else {
      delete item.buying;
      delete item.Bsubtotal;
    }
    return item;
  }

  /**
   * Get a stock item locked for update (inside a transaction).
   */
  async findByIdForUpdate(session, id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const stock = await Stock.findOne({ _id: id, facilityID }).session(session).lean();
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
  async updatePrice(id, { selling, buying, price_per_yard = null, yards_per_belt = null }, facilityID, session = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    let stockQuery = Stock.findOne({ _id: id, facilityID });
    if (session) stockQuery = stockQuery.session(session);
    const stock = await stockQuery.lean();
    if (!stock) return false;

    const updateData = {
      selling,
      buying,
      Ssubtotal: selling * stock.quantity,
      Bsubtotal: buying * stock.quantity,
    };
    if (price_per_yard !== undefined && price_per_yard !== null) {
      updateData.price_per_yard = price_per_yard;
    }
    if (yards_per_belt !== undefined && yards_per_belt !== null) {
      updateData.yards_per_belt = yards_per_belt;
    }

    const result = await Stock.updateOne({ _id: id, facilityID }, updateData, session ? { session } : {});
    return result.matchedCount > 0;
  }

  /**
   * Dedicated yard configuration update (Admin only).
   */
  async updateYardConfig(id, { price_per_yard, yards_per_belt }, facilityID, session = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Stock.updateOne(
      { _id: id, facilityID },
      { price_per_yard, yards_per_belt },
      session ? { session } : {}
    );
    return result.matchedCount > 0;
  }

  /**
   * Record new stock receipt (supplier intake).
   * Automatically converts belts to yards when receiving in a PER_YARD branch.
   */
  async receiveStock(session, {
    facilityID, storeId, stockId, quantity, costPrice, purchaseFrom, forDesc, amountPaid, performedBy, unitType
  }) {
    // Get current quantity, unit type, and branch sales mode
    if (!mongoose.Types.ObjectId.isValid(stockId)) throw new Error('Stock item not found');
    const stock = await Stock.findOne({ _id: stockId, facilityID }).session(session).lean();
    
    if (!stock) throw new Error('Stock item not found');
    if (storeId) {
      if (!mongoose.Types.ObjectId.isValid(storeId) || !await Store.exists({ _id: storeId, branch_id: facilityID }).session(session)) {
        throw new Error('Store not found for this branch');
      }
    }

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
    const stockUpdate = await Stock.updateOne(
      { _id: stockId, facilityID },
      {
        $set: {
          quantity: newQty,
          unit_type: nextUnitType,
          Bsubtotal: stock.buying * newQty,
        },
        $inc: { new_order: receivedQuantity },
      },
      { session }
    );
    if (!stockUpdate.matchedCount) throw new Error('Stock item not found');

    // Record in purchase_history
    const [purchaseMysqlId] = await reserveLegacyIds(Purchase, 'purchaseId', 1, session);
    const [movementMysqlId] = await reserveLegacyIds(StockMovement, 'stockMovementId', 1, session);
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
        mysqlId: purchaseMysqlId,
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
        mysqlId: movementMysqlId,
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
    if (stockId) {
      if (!mongoose.Types.ObjectId.isValid(stockId)) return [];
      matchQuery.stock_id = stockId;
    }
    if (startDate) matchQuery.createdAt = { ...matchQuery.createdAt, $gte: new Date(startDate) };
    if (endDate) matchQuery.createdAt = { ...matchQuery.createdAt, $lte: new Date(endDate) };

    const movements = await StockMovement.find(matchQuery)
      .populate('stock_id', 'name')
      .populate('performed_by', 'name')
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(parseInt(limit) || 500, 1), 500))
      .skip(Math.max(parseInt(offset) || 0, 0))
      .lean();

    // Enrich with order data for sales movements
    const enriched = await Promise.all(
      movements.map(async (sm) => {
        let orderData = {};
        if (sm.reference_type === 'orders') {
          const order = await Order.findOne({ orderID: sm.reference_id, facilityID }).lean();
          if (order) {
            orderData = {
              order_payment: order.payment,
              order_status: order.status,
              order_customer_name: order.customer_name,
              order_buyer_name: order.buyer_name,
              order_net_total: order.net_total,
              order_amount_paid: order.amount_paid,
              is_credit: String(order.payment).toLowerCase() === 'credit' || Number(order.status) === 0 ? 1 : 0,
            };
          }
        }

        return {
          ...sm,
          business_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(sm.createdAt),
          business_time: new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }).format(sm.createdAt),
          product_name: sm.stock_id?.name || null,
          performed_by_name: sm.performed_by?.name || null,
          ...orderData,
        };
      })
    );

    return enriched.map((movement) => ({
      ...movement,
      id: movement._id.toString(),
      created_at: movement.createdAt,
      stock_id: movement.stock_id?._id?.toString() || movement.stock_id?.toString() || null,
      performed_by: movement.performed_by?._id?.toString() || movement.performed_by?.toString() || null,
    }));
  }

  /**
   * Get all stores for a branch.
   */
  async getStores(facilityID) {
    const stores = await Store.find({ branch_id: facilityID, status: 'active' })
      .sort({ store_name: 1 })
      .lean();
    return stores.map((store) => ({ ...store, id: store._id.toString() }));
  }

  /**
   * Get store by ID
   */
  async getStoreById(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const store = await Store.findOne({ _id: id, branch_id: facilityID }).lean();
    return store ? { ...store, id: store._id.toString() } : null;
  }

  /**
   * Create new store
   */
  async createStore({ facilityID, storeName, branchId, status = 'active' }) {
    const session = await mongoose.startSession();
    let storeId;
    try {
      await session.withTransaction(async () => {
        if (!await Branch.exists({ facilityID: branchId }).session(session)) throw new Error('Branch not found');
        const existing = await Store.findOne({ store_name: storeName, branch_id: branchId }).session(session);
        if (existing) throw new Error('A store with this name already exists for this branch');
        const [mysqlId] = await reserveLegacyIds(Store, 'storeId', 1, session);
        const [store] = await Store.create([{
          store_name: storeName,
          branch_id: branchId,
          status,
          mysqlId,
        }], { session });
        storeId = store._id;
      });
      return storeId;
    } finally { await session.endSession(); }
  }

  /**
   * Update store
   */
  async updateStore(id, { facilityID, storeName, branchId, status }) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const storeQuery = { _id: id };
    if (facilityID) storeQuery.branch_id = facilityID;
    const store = await Store.findOne(storeQuery);
    if (!store) return false;
    if (!await Branch.exists({ facilityID: branchId })) throw new Error('Branch not found');
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
      storeQuery,
      { store_name: storeName, branch_id: branchId, status: status || store.status, updatedAt: new Date() }
    );
    return result.matchedCount > 0;
  }

  /**
   * Delete store (soft delete by setting status to inactive)
   */
  async deleteStore(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Store.updateOne(
      { _id: id, branch_id: facilityID },
      { status: 'inactive' }
    );
    return result.matchedCount > 0;
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
      id: p._id.toString(),
      stock_id: p.stock_id?._id?.toString() || p.stock_id?.toString() || null,
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
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchQuery.name = { $regex: escapedSearch, $options: 'i' };
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
      id: s.representative_id.toString(),
      name: s.name,
      unit_type: s.unit_type,
    }));
  }

  /**
   * Create a brand new catalog product in the specified branch (Admin Only).
   * Atomically creates Stock, registers legacy mysqlId, and records initial StockMovement.
   */
  async createStock({
    facilityID,
    name,
    storeId = null,
    quantity = 0,
    buying = 0,
    selling = 0,
    unit_type = 'belt',
    price_per_yard = null,
    yards_per_belt = 100,
    status = 'active',
    performedBy = null,
  }) {
    const session = await mongoose.startSession();
    let createdStock;
    try {
      await session.withTransaction(async () => {
        // Validate branch existence
        const branch = await Branch.findOne({ facilityID }).session(session).lean();
        if (!branch) {
          throw new Error('Branch not found');
        }

        // Check for duplicate product name in this branch
        const cleanName = name.trim();
        const existing = await Stock.findOne({
          facilityID,
          name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        }).session(session);
        if (existing) {
          throw new Error(`A product named "${cleanName}" already exists in this branch.`);
        }

        if (storeId) {
          if (!mongoose.Types.ObjectId.isValid(storeId) || !await Store.exists({ _id: storeId, branch_id: facilityID }).session(session)) {
            throw new Error('Store not found for this branch');
          }
        }

        const qty = parseFloat(quantity) || 0;
        const buyPrice = parseFloat(buying) || 0;
        const sellPrice = parseFloat(selling) || 0;
        const yardPrice = price_per_yard !== null && price_per_yard !== undefined && price_per_yard !== '' ? parseFloat(price_per_yard) : null;
        const ypb = yards_per_belt ? parseFloat(yards_per_belt) : 100;

        const [mysqlId] = await reserveLegacyIds(Stock, 'stockId', 1, session);
        const [stock] = await Stock.create([
          {
            facilityID,
            name: cleanName,
            store_id: storeId || null,
            quantity: qty,
            opening_quantity: qty,
            buying: buyPrice,
            selling: sellPrice,
            unit_type: unit_type || (branch.sales_mode === 'PER_YARD' ? 'yard' : 'belt'),
            price_per_yard: yardPrice,
            yards_per_belt: ypb,
            status: status || 'active',
            Bsubtotal: buyPrice * qty,
            Ssubtotal: sellPrice * qty,
            mysqlId,
          }
        ], { session });

        createdStock = stock;

        // Record initial stock movement if quantity > 0
        if (qty > 0) {
          const [movementMysqlId] = await reserveLegacyIds(StockMovement, 'stockMovementId', 1, session);
          await StockMovement.create([
            {
              facilityID,
              store_id: storeId || null,
              stock_id: stock._id,
              movement_type: 'STOCK_INITIAL',
              quantity_change: qty,
              quantity_before: 0,
              quantity_after: qty,
              reference_type: 'initial_stock',
              reference_id: String(stock._id),
              notes: `Initial stock created by Admin: ${qty} ${stock.unit_type}`,
              performed_by: performedBy,
              mysqlId: movementMysqlId,
            }
          ], { session });
        }
      });
      return createdStock;
    } finally {
      await session.endSession();
    }
  }
}

module.exports = new StockRepositoryMongo();
