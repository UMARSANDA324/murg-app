const db = require('../config/database');

/**
 * StockRepository — Parameterized queries for inventory management.
 * Enforces branch scoping at the query level.
 */
class StockRepository {
  /**
   * List all stocks for a branch, optionally filtered by store.
   */
  async findAll({ facilityID, storeId = null, search = null, status = 'active' } = {}) {
    let sql = `
      SELECT s.*, st.store_name, st.status as store_status
      FROM stocks s
      LEFT JOIN stores st ON s.store_id = st.id
      WHERE s.facilityID = ?
    `;
    const params = [facilityID];

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    if (storeId) {
      sql += ' AND s.store_id = ?';
      params.push(storeId);
    }
    if (search) {
      sql += ' AND s.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY s.name ASC';
    const [rows] = await db.query(sql, params);
    return rows.map(r => ({
      ...r,
      quantity: parseFloat(r.quantity) || 0,
      buying: parseFloat(r.buying) || 0,
      selling: parseFloat(r.selling) || 0,
      price_per_yard: r.price_per_yard !== null && r.price_per_yard !== undefined ? parseFloat(r.price_per_yard) : null,
      yards_per_belt: r.yards_per_belt !== null && r.yards_per_belt !== undefined ? parseFloat(r.yards_per_belt) : null,
    }));
  }

  /**
   * Get a single stock item, scoped to branch.
   */
  async findById(id, facilityID) {
    const [rows] = await db.query(
      `SELECT s.*, st.store_name FROM stocks s
       LEFT JOIN stores st ON s.store_id = st.id
       WHERE s.id = ? AND s.facilityID = ?`,
      [id, facilityID]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      quantity: parseFloat(r.quantity) || 0,
      buying: parseFloat(r.buying) || 0,
      selling: parseFloat(r.selling) || 0,
      price_per_yard: r.price_per_yard !== null && r.price_per_yard !== undefined ? parseFloat(r.price_per_yard) : null,
      yards_per_belt: r.yards_per_belt !== null && r.yards_per_belt !== undefined ? parseFloat(r.yards_per_belt) : null,
    };
  }

  /**
   * Get a stock item locked for update (inside a transaction).
   */
  async findByIdForUpdate(conn, id, facilityID) {
    const [rows] = await conn.query(
      'SELECT id, name, facilityID, store_id, quantity, selling, buying, unit_type, price_per_yard, yards_per_belt FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
      [id, facilityID]
    );
    return rows[0] || null;
  }

  /**
   * Decrement stock quantity (inside a transaction).
   * Also increments out_stocks accumulator.
   */
  async decrementQuantity(conn, id, quantity) {
    await conn.query(
      'UPDATE stocks SET quantity = quantity - ?, out_stocks = out_stocks + ? WHERE id = ?',
      [quantity, quantity, id]
    );
  }

  /**
   * Increment stock quantity (for receiving, returns, or incoming transfers).
   */
  async incrementQuantity(conn, id, quantity) {
    await conn.query(
      'UPDATE stocks SET quantity = quantity + ?, new_order = new_order + ? WHERE id = ?',
      [quantity, quantity, id]
    );
  }

  /**
   * Update selling, buying, price_per_yard, and yards_per_belt (Admin only — enforced at middleware layer).
   */
  async updatePrice(id, { selling, buying, price_per_yard = null, yards_per_belt = null }, facilityID) {
    let sql = 'UPDATE stocks SET selling = ?, buying = ?, Ssubtotal = CAST(? AS DECIMAL(15,2)) * CAST(quantity AS DECIMAL(15,2)), Bsubtotal = CAST(? AS DECIMAL(15,2)) * CAST(quantity AS DECIMAL(15,2))';
    const params = [selling, buying, selling, buying];
    if (price_per_yard !== undefined && price_per_yard !== null) {
      sql += ', price_per_yard = ?';
      params.push(price_per_yard);
    }
    if (yards_per_belt !== undefined && yards_per_belt !== null) {
      sql += ', yards_per_belt = ?';
      params.push(yards_per_belt);
    }
    sql += ' WHERE id = ? AND facilityID = ?';
    params.push(id, facilityID);

    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  }

  /**
   * Dedicated yard configuration update (Admin only).
   */
  async updateYardConfig(id, { price_per_yard, yards_per_belt }, facilityID) {
    const [result] = await db.query(
      'UPDATE stocks SET price_per_yard = ?, yards_per_belt = ? WHERE id = ? AND facilityID = ?',
      [price_per_yard, yards_per_belt, id, facilityID]
    );
    return result.affectedRows > 0;
  }

  /**
   * Record new stock receipt (supplier intake).
   * Automatically converts belts to yards when receiving in a PER_YARD branch.
   */
  async receiveStock(conn, {
    facilityID, storeId, stockId, quantity, costPrice, purchaseFrom, forDesc, amountPaid, performedBy, unitType
  }) {
    // Get current quantity, unit type, and branch sales mode
    const [stockRows] = await conn.query(
      `SELECT s.id, s.name, s.quantity, s.unit_type, s.yards_per_belt, b.sales_mode 
       FROM stocks s 
       JOIN branch b ON s.facilityID = b.facilityID 
       WHERE s.id = ? AND s.facilityID = ? FOR UPDATE`,
      [stockId, facilityID]
    );
    if (!stockRows[0]) throw new Error('Stock item not found');

    const stock = stockRows[0];
    const isPerYard = stock.sales_mode === 'PER_YARD';
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
    await conn.query(
      'UPDATE stocks SET quantity = ?, new_order = new_order + ?, unit_type = ?, Bsubtotal = buying * ? WHERE id = ?',
      [newQty, receivedQuantity, nextUnitType, newQty, stockId]
    );

    // Record in purchase_history
    const [phResult] = await conn.query(
      `INSERT INTO purchase_history 
       (facilityID, stock_id, initial_quantity, stock_name, quantity, cost_price, total_cost, amount_paid, balance, for_desc, purchase_date, purchase_from)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [facilityID, stockId, currentQty, stock.name, receivedQuantity, costPrice, totalCost, amountPaid, balance, (forDesc || '') + conversionNote, purchaseFrom]
    );

    // Record in stock_movements ledger
    await conn.query(
      `INSERT INTO stock_movements 
       (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
       VALUES (?, ?, ?, 'STOCK_IN_SUPPLIER', ?, ?, ?, 'purchase_history', ?, ?, ?)`,
      [facilityID, storeId || null, stockId, receivedQuantity, currentQty, newQty, phResult.insertId, `From: ${purchaseFrom}${conversionNote}`, performedBy]
    );

    return {
      purchaseHistoryId: phResult.insertId,
      newQuantity: newQty,
      quantityAdded: receivedQuantity,
      unitType: nextUnitType,
    };
  }

  /**
   * Get stock movement history for a branch.
   * Enriched with order metadata (credit vs normal sale, buyer, net total) for sales movements.
   */
  async getMovements({ facilityID, stockId = null, startDate = null, endDate = null, limit = 500, offset = 0 } = {}) {
    let sql = `
              SELECT sm.*,
                 DATE_FORMAT(sm.created_at, '%Y-%m-%d') as business_date,
              DATE_FORMAT(sm.created_at, '%H:%i') as business_time,
                 s.name as product_name,
             f.name as performed_by_name,
             ord.payment as order_payment,
             ord.status as order_status,
             ord.customer_name as order_customer_name,
             ord.buyer_name as order_buyer_name,
             ord.net_total as order_net_total,
             ord.amount_paid as order_amount_paid,
             CASE WHEN ord.payment = 'Credit' OR ord.status = 0 THEN 1 ELSE 0 END as is_credit
      FROM stock_movements sm
      LEFT JOIN stocks s ON sm.stock_id = s.id
      LEFT JOIN facility f ON sm.performed_by = f.id
      LEFT JOIN (
        SELECT orderID, payment, status, customer_name, buyer_name, net_total, amount_paid
        FROM orders
        GROUP BY orderID
      ) ord ON sm.reference_type = 'orders' AND sm.reference_id = ord.orderID
      WHERE sm.facilityID = ?
    `;
    const params = [facilityID];

    if (stockId) { sql += ' AND sm.stock_id = ?'; params.push(stockId); }
    if (startDate) { sql += ' AND DATE(sm.created_at) >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND DATE(sm.created_at) <= ?'; params.push(endDate); }

    sql += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
    params.push(Math.min(Math.max(parseInt(limit) || 500, 1), 500), Math.max(parseInt(offset) || 0, 0));
    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Get all stores for a branch.
   */
  async getStores(facilityID) {
    const [rows] = await db.query(
      "SELECT * FROM stores WHERE branch_id = ? AND status = 'active' ORDER BY store_name ASC",
      [facilityID]
    );
    return rows;
  }

  /**
   * Global catalog search — returns distinct product names across ALL branches.
   * Intentionally has no facilityID filter.
   * Used by the Goods Request form so staff can request any product in the system.
   */
  async globalCatalogSearch({ search = null, limit = 50 } = {}) {
    let sql = `
      SELECT DISTINCT name, unit_type, MIN(id) as representative_id
      FROM stocks
      WHERE status = 'active'
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ' AND name LIKE ?';
      params.push(`%${search.trim()}%`);
    }

    sql += ' GROUP BY name, unit_type ORDER BY name ASC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return rows.map(r => ({
      id: r.representative_id,
      name: r.name,
      unit_type: r.unit_type,
    }));
  }
}

module.exports = new StockRepository();
