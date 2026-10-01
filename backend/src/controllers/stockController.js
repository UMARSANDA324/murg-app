const stockRepo = require('../repositories/stockRepositoryMongo');
const { mongoose } = require('../config/mongodb');
const { recordAuditLog } = require('../services/auditLogService');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, created, error, notFound } = require('../utils/responseUtils');

class StockController {
  async list(req, res, next) {
    try {
      const facilityID = req.branchId; // Enforced by requireBranchScope
      const storeId = req.query.storeId || null;
      const search = req.query.search || null;
      const status = req.query.status || 'active';
      const includeCost = Boolean(req.user?.isGlobalAdmin || req.user?.role === 'Admin');

      const stocks = await stockRepo.findAll({ facilityID, storeId, search, status, includeCost });
      return success(res, stocks);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const facilityID = req.branchId;
      const includeCost = Boolean(req.user?.isGlobalAdmin || req.user?.role === 'Admin');
      const stock = await stockRepo.findById(req.params.id, facilityID, includeCost);
      if (!stock) {
        return notFound(res, 'Stock item not found');
      }
      return success(res, stock);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create brand new catalog product in current branch (Admin Only).
   */
  async create(req, res, next) {
    try {
      const facilityID = req.branchId;
      const {
        name,
        storeId,
        quantity = 0,
        buying = 0,
        selling = 0,
        unit_type = 'belt',
        price_per_yard,
        yards_per_belt = 100,
      } = req.body;

      if (!name || !name.trim()) {
        return error(res, 'Product name is required', 400);
      }
      const quantityValue = Number(quantity);
      const buyingValue = Number(buying);
      const sellingValue = Number(selling);
      const yardPriceValue = price_per_yard === undefined || price_per_yard === null || price_per_yard === ''
        ? null
        : Number(price_per_yard);
      const yardsPerBeltValue = yards_per_belt === undefined || yards_per_belt === null || yards_per_belt === ''
        ? 100
        : Number(yards_per_belt);
      if (!Number.isFinite(quantityValue) || quantityValue < 0) {
        return error(res, 'Quantity must be a valid non-negative number', 400);
      }
      if (!Number.isFinite(sellingValue) || sellingValue < 0) {
        return error(res, 'Selling price must be a valid non-negative number', 400);
      }
      if (!Number.isFinite(buyingValue) || buyingValue < 0) {
        return error(res, 'Buying price must be a valid non-negative number', 400);
      }
      if (
        (yardPriceValue !== null && (!Number.isFinite(yardPriceValue) || yardPriceValue < 0)) ||
        !Number.isFinite(yardsPerBeltValue) || yardsPerBeltValue <= 0 ||
        !['belt', 'yard'].includes(unit_type)
      ) {
        return error(res, 'Unit and yard configuration values are invalid', 400);
      }

      const stock = await stockRepo.createStock({
        facilityID,
        name: name.trim(),
        storeId: storeId || null,
        quantity: quantityValue,
        buying: buyingValue,
        selling: sellingValue,
        unit_type,
        price_per_yard: yardPriceValue,
        yards_per_belt: yardsPerBeltValue,
        performedBy: req.user.id,
      });

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: 'STOCK_CREATED',
        referenceId: String(stock._id),
      });

      return created(res, stock, 'Product created successfully');
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }

  /**
   * CRITICAL: Price modification endpoint.
   * Enforces that ONLY Global Admin can alter selling or buying prices.
   * Records old and new values in audit_logs.
   */
  async updatePrice(req, res, next) {
    try {
      const stockId = req.params.id;
      const facilityID = req.branchId;
      const { selling, buying, price_per_yard, yards_per_belt, reason } = req.body;

      if (selling === undefined || buying === undefined) {
        return error(res, 'Selling price and buying price are required', 400);
      }

      const sellingPrice = Number(selling);
      const buyingPrice = Number(buying);
      const yardPrice = price_per_yard === undefined || price_per_yard === null ? null : Number(price_per_yard);
      const yardsPerBelt = yards_per_belt === undefined || yards_per_belt === null ? null : Number(yards_per_belt);
      if (
        !Number.isFinite(sellingPrice) || sellingPrice < 0 ||
        !Number.isFinite(buyingPrice) || buyingPrice < 0 ||
        (yardPrice !== null && (!Number.isFinite(yardPrice) || yardPrice < 0)) ||
        (yardsPerBelt !== null && (!Number.isFinite(yardsPerBelt) || yardsPerBelt <= 0))
      ) {
        return error(res, 'Selling and buying prices must be valid non-negative numbers', 400);
      }

      const session = await mongoose.startSession();
      let existing;
      try {
        await session.withTransaction(async () => {
          existing = await stockRepo.findByIdForUpdate(session, stockId, facilityID);
          if (!existing) return;

          await stockRepo.updatePrice(
            stockId,
            {
              selling: sellingPrice,
              buying: buyingPrice,
              price_per_yard: yardPrice,
              yards_per_belt: yardsPerBelt,
            },
            facilityID,
            session
          );

          await recordAuditLog({
            facilityID,
            user_id: req.user.id,
            user_name: req.user.name,
            action: 'PRICE_CHANGE',
            entity_type: 'stocks',
            entity_id: stockId,
            old_values: {
              selling: existing.selling,
              buying: existing.buying,
              price_per_yard: existing.price_per_yard,
              yards_per_belt: existing.yards_per_belt,
            },
            new_values: {
              selling: sellingPrice,
              buying: buyingPrice,
              price_per_yard: yardPrice,
              yards_per_belt: yardsPerBelt,
              reason: reason || 'Price update',
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
          }, session);
        });
      } finally {
        await session.endSession();
      }
      if (!existing) return notFound(res, 'Stock item not found');

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: 'STOCK_PRICING_UPDATED',
        referenceId: stockId,
      });

      return success(res, null, 'Product price updated successfully by Administrator');
    } catch (err) {
      next(err);
    }
  }

  /**
   * CRITICAL: Per-yard pricing and belt conversion configuration.
   * Enforces that ONLY Global Admin can alter yard price or yards-per-belt.
   */
  async updateYardConfig(req, res, next) {
    try {
      const stockId = req.params.id;
      const facilityID = req.branchId;
      const { price_per_yard, yards_per_belt, reason } = req.body;

      if (price_per_yard === undefined && yards_per_belt === undefined) {
        return error(res, 'price_per_yard or yards_per_belt is required', 400);
      }

      const requestedPricePerYard = price_per_yard === undefined ? undefined : Number(price_per_yard);
      const requestedYardsPerBelt = yards_per_belt === undefined ? undefined : Number(yards_per_belt);
      if (
        (requestedPricePerYard !== undefined && (!Number.isFinite(requestedPricePerYard) || requestedPricePerYard < 0)) ||
        (requestedYardsPerBelt !== undefined && (!Number.isFinite(requestedYardsPerBelt) || requestedYardsPerBelt <= 0))
      ) {
        return error(res, 'Yard price must be non-negative and yards per belt must be greater than zero', 400);
      }

      const session = await mongoose.startSession();
      let currentStock;
      let newPricePerYard;
      let newYardsPerBelt;
      try {
        await session.withTransaction(async () => {
          currentStock = await stockRepo.findByIdForUpdate(session, stockId, facilityID);
          if (!currentStock) return;
          newPricePerYard = requestedPricePerYard === undefined
            ? currentStock.price_per_yard
            : requestedPricePerYard;
          newYardsPerBelt = requestedYardsPerBelt === undefined
            ? currentStock.yards_per_belt
            : requestedYardsPerBelt;

          await stockRepo.updateYardConfig(
            stockId,
            { price_per_yard: newPricePerYard, yards_per_belt: newYardsPerBelt },
            facilityID,
            session
          );

          await recordAuditLog({
            facilityID,
            user_id: req.user.id,
            user_name: req.user.name,
            action: 'YARD_CONFIG_CHANGE',
            entity_type: 'stocks',
            entity_id: stockId,
            old_values: {
              price_per_yard: currentStock.price_per_yard,
              yards_per_belt: currentStock.yards_per_belt,
            },
            new_values: {
              price_per_yard: newPricePerYard,
              yards_per_belt: newYardsPerBelt,
              reason: reason || 'Admin yard config update',
            },
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
          }, session);
        });
      } finally {
        await session.endSession();
      }
      if (!currentStock) return notFound(res, 'Stock item not found');

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: 'STOCK_PRICING_UPDATED',
        referenceId: stockId,
      });

      return success(res, { price_per_yard: newPricePerYard, yards_per_belt: newYardsPerBelt }, 'Yard configuration updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Supplier stock intake endpoint ("Who supplied the stock?").
   * Records supplier details, unit cost, quantity, and updates inventory atomically.
   */
  async receiveStock(req, res, next) {
    try {
      const facilityID = req.branchId;
      const {
        stockId,
        storeId,
        quantity,
        costPrice,
        purchaseFrom,
        forDesc,
        amountPaid = 0,
        unitType = 'belt',
      } = req.body;

      if (!stockId || quantity === undefined || costPrice === undefined || !purchaseFrom) {
        return error(res, 'Product, quantity, unit cost price, and supplier name are required', 400);
      }

      const parsedQuantity = Number(quantity);
      const parsedCostPrice = Number(costPrice);
      const parsedAmountPaid = Number(amountPaid);
      if (
        !Number.isFinite(parsedQuantity) || parsedQuantity <= 0 ||
        !Number.isFinite(parsedCostPrice) || parsedCostPrice < 0 ||
        !Number.isFinite(parsedAmountPaid) || parsedAmountPaid < 0
      ) {
        return error(res, 'Quantity, cost price, and amount paid must be valid non-negative numbers', 400);
      }

      const session = await mongoose.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          result = await stockRepo.receiveStock(session, {
            facilityID,
            storeId: storeId || null,
            stockId,
            quantity: parsedQuantity,
            costPrice: parsedCostPrice,
            purchaseFrom: purchaseFrom.trim(),
            forDesc: forDesc ? forDesc.trim() : '',
            amountPaid: parsedAmountPaid,
            performedBy: req.user.id,
            unitType: unitType || 'belt',
          });
        });
        publishBranchEvent({
          branchIds: [facilityID],
          type: 'branch-operation',
          operation: 'STOCK_RECEIVED',
          referenceId: result.purchaseHistoryId,
        });
        return created(res, result, 'Stock receipt recorded successfully');
      } finally {
        await session.endSession();
      }
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req, res, next) {
    try {
      const facilityID = req.branchId;
      const stockId = req.query.stockId || null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const limit = req.query.limit ? parseInt(req.query.limit) : 500;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;

      const movements = await stockRepo.getMovements({ facilityID, stockId, startDate, endDate, limit, offset });
      return success(res, movements);
    } catch (err) {
      next(err);
    }
  }

  async getStores(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const stores = await stockRepo.getStores(facilityID);
      return success(res, stores);
    } catch (err) {
      next(err);
    }
  }

  async createStore(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { storeName, branchId, status } = req.body;

      if (!storeName || !branchId) {
        return error(res, 'Store name and branch are required');
      }

      // Admins can create stores for any branch
      // Staff can only create stores for their own branch
      if (!user.isGlobalAdmin && branchId !== user.facilityID) {
        return forbidden(res, 'You can only create stores for your own branch');
      }

      const storeId = await stockRepo.createStore({
        facilityID: branchId,
        storeName,
        branchId,
        status: status || 'active',
      });

      const store = await stockRepo.getStoreById(storeId, branchId);
      return success(res, store, 'Store created successfully');
    } catch (err) {
      if (err.message.includes('already exists')) {
        return error(res, err.message);
      }
      next(err);
    }
  }

  async updateStore(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { id } = req.params;
      const { storeName, branchId, status } = req.body;

      if (!storeName || !branchId) {
        return error(res, 'Store name and branch are required');
      }

      // Admins can update stores for any branch
      // Staff can only update stores in their own branch
      if (!user.isGlobalAdmin && branchId !== user.facilityID) {
        return forbidden(res, 'You can only update stores in your own branch');
      }

      const updated = await stockRepo.updateStore(id, {
        facilityID: user.isGlobalAdmin ? null : user.facilityID,
        storeName,
        branchId,
        status,
      });

      if (!updated) {
        return notFound(res, 'Store not found');
      }

      const store = await stockRepo.getStoreById(id, branchId);
      return success(res, store, 'Store updated successfully');
    } catch (err) {
      if (err.message.includes('already exists')) {
        return error(res, err.message);
      }
      next(err);
    }
  }

  async deleteStore(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { id } = req.params;
      const { branchId } = req.query;

      if (!branchId) {
        return error(res, 'Branch ID is required');
      }

      // Admins can delete stores for any branch
      // Staff can only delete stores in their own branch
      if (!user.isGlobalAdmin && branchId !== user.facilityID) {
        return forbidden(res, 'You can only delete stores in your own branch');
      }

      const deleted = await stockRepo.deleteStore(id, user.isGlobalAdmin ? branchId : user.facilityID);

      if (!deleted) {
        return notFound(res, 'Store not found');
      }

      return success(res, null, 'Store deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseHistory(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const { month, year, fromDate, toDate, limit } = req.query;

      const history = await stockRepo.getPurchaseHistory({
        facilityID,
        month: month ? parseInt(month) : null,
        year: year ? parseInt(year) : null,
        fromDate,
        toDate,
        limit: limit ? parseInt(limit) : 100,
      });

      return success(res, history);
    } catch (err) {
      next(err);
    }
  }

  async getPurchaseTotals(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const { month, year, fromDate, toDate } = req.query;

      const totals = await stockRepo.getPurchaseTotals({
        facilityID,
        month: month ? parseInt(month) : null,
        year: year ? parseInt(year) : null,
        fromDate,
        toDate,
      });

      return success(res, totals);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Global catalog search — not scoped to any branch.
   * Returns distinct active product names from all facilities.
   * Used by the Goods Request form so staff can see the entire product catalog.
   * Authentication required; branch scope intentionally NOT applied.
   */
  async catalogSearch(req, res, next) {
    try {
      const search = req.query.search || null;
      const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 200) : 100;
      const products = await stockRepo.globalCatalogSearch({ search, limit });
      return success(res, products);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StockController();
