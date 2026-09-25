const db = require('../config/database');
const stockRepo = require('../repositories/stockRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, created, error, notFound } = require('../utils/responseUtils');

class StockController {
  async list(req, res, next) {
    try {
      const facilityID = req.branchId; // Enforced by requireBranchScope
      const storeId = req.query.storeId ? parseInt(req.query.storeId) : null;
      const search = req.query.search || null;
      const status = req.query.status || 'active';

      const stocks = await stockRepo.findAll({ facilityID, storeId, search, status });
      return success(res, stocks);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const facilityID = req.branchId;
      const stock = await stockRepo.findById(req.params.id, facilityID);
      if (!stock) {
        return notFound(res, 'Stock item not found');
      }
      return success(res, stock);
    } catch (err) {
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

      // Fetch old values for audit trail
      const existing = await stockRepo.findById(stockId, facilityID);
      if (!existing) {
        return notFound(res, 'Stock item not found');
      }

      const updated = await stockRepo.updatePrice(
        stockId,
        {
          selling,
          buying,
          price_per_yard: price_per_yard !== undefined ? parseFloat(price_per_yard) : null,
          yards_per_belt: yards_per_belt !== undefined ? parseFloat(yards_per_belt) : null,
        },
        facilityID
      );
      if (!updated) {
        return notFound(res, 'Stock item not found or price unchanged');
      }

      // Record in audit_logs
      try {
        await db.query(
          `INSERT INTO audit_logs 
           (facilityID, user_id, user_name, action, entity_type, entity_id, old_values, new_values, ip_address)
           VALUES (?, ?, ?, 'PRICE_CHANGE', 'stocks', ?, ?, ?, ?)`,
          [
            facilityID,
            req.user.id,
            req.user.name,
            stockId,
            JSON.stringify({
              selling: existing.selling,
              buying: existing.buying,
              price_per_yard: existing.price_per_yard,
              yards_per_belt: existing.yards_per_belt,
            }),
            JSON.stringify({ selling, buying, price_per_yard, yards_per_belt, reason: reason || 'Price update' }),
            req.ip,
          ]
        );
      } catch (logErr) {
        console.error('[Audit Log Error]', logErr.message);
      }

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

      const existing = await stockRepo.findById(stockId, facilityID);
      if (!existing) {
        return notFound(res, 'Stock item not found');
      }

      const newPricePerYard = price_per_yard !== undefined ? parseFloat(price_per_yard) : existing.price_per_yard;
      const newYardsPerBelt = yards_per_belt !== undefined ? parseFloat(yards_per_belt) : existing.yards_per_belt;

      // Update in database (also updates selling price if this product is sold by yard)
      await stockRepo.updateYardConfig(
        stockId,
        {
          price_per_yard: newPricePerYard,
          yards_per_belt: newYardsPerBelt,
        },
        facilityID
      );

      // Record in audit_logs
      try {
        await db.query(
          `INSERT INTO audit_logs 
           (facilityID, user_id, user_name, action, entity_type, entity_id, old_values, new_values, ip_address)
           VALUES (?, ?, ?, 'YARD_CONFIG_CHANGE', 'stocks', ?, ?, ?, ?)`,
          [
            facilityID,
            req.user.id,
            req.user.name,
            stockId,
            JSON.stringify({
              price_per_yard: existing.price_per_yard,
              yards_per_belt: existing.yards_per_belt,
            }),
            JSON.stringify({
              price_per_yard: newPricePerYard,
              yards_per_belt: newYardsPerBelt,
              reason: reason || 'Admin yard config update',
            }),
            req.ip,
          ]
        );
      } catch (logErr) {
        console.error('[Audit Log Error]', logErr.message);
      }

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

      if (!stockId || !quantity || !costPrice || !purchaseFrom) {
        return error(res, 'Product, quantity, unit cost price, and supplier name are required', 400);
      }

      const conn = await db.getConnection();
      try {
        await conn.beginTransaction();

        const result = await stockRepo.receiveStock(conn, {
          facilityID,
          storeId: storeId ? parseInt(storeId) : null,
          stockId: parseInt(stockId),
          quantity: parseFloat(quantity),
          costPrice: parseFloat(costPrice),
          purchaseFrom: purchaseFrom.trim(),
          forDesc: forDesc ? forDesc.trim() : '',
          amountPaid: parseFloat(amountPaid) || 0,
          performedBy: req.user.id,
          unitType: unitType || 'belt',
        });

        await conn.commit();
        publishBranchEvent({
          branchIds: [facilityID],
          type: 'branch-operation',
          operation: 'STOCK_RECEIVED',
          referenceId: result.purchaseHistoryId,
        });
        return created(res, result, 'Stock receipt recorded successfully');
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    } catch (err) {
      next(err);
    }
  }

  async getMovements(req, res, next) {
    try {
      const facilityID = req.branchId;
      const stockId = req.query.stockId ? parseInt(req.query.stockId) : null;
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
      const facilityID = req.branchId;
      const stores = await stockRepo.getStores(facilityID);
      return success(res, stores);
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
