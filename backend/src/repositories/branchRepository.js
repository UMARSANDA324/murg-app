const db = require('../config/database');

/**
 * BranchRepository — All branch CRUD and staff assignment operations.
 * All queries use parameterized statements to prevent SQL injection.
 */
class BranchRepository {
  /**
   * List all branches (Admin: all; Branch user: their own).
   */
  async findAll(facilityID = null) {
    if (facilityID) {
      const [rows] = await db.query(
        'SELECT b.*, (SELECT COUNT(*) FROM facility f WHERE f.facilityID = b.facilityID) as staff_count FROM branch b WHERE b.facilityID = ?',
        [facilityID]
      );
      return rows;
    }
    const [rows] = await db.query(
      'SELECT b.*, (SELECT COUNT(*) FROM facility f WHERE f.facilityID = b.facilityID) as staff_count FROM branch b ORDER BY b.id ASC'
    );
    return rows;
  }

  /**
   * Get a single branch by facilityID.
   */
  async findByFacilityID(facilityID) {
    const [rows] = await db.query(
      'SELECT * FROM branch WHERE facilityID = ? LIMIT 1',
      [facilityID]
    );
    return rows[0] || null;
  }

  /**
   * Get next available facilityID and create new branch atomically.
   */
  async create({ name, address, phone, sales_mode = 'DEALER' }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the conca row and get next ID
      const [concaRows] = await conn.query('SELECT lastID FROM conca WHERE id = 1 FOR UPDATE');
      const lastID = parseInt(concaRows[0].lastID) || 0;
      const newID = lastID + 1;
      const facilityID = `MURG/${String(newID).padStart(3, '0')}`;

      // Update the counter
      await conn.query('UPDATE conca SET lastID = ? WHERE id = 1', [newID]);

      // Insert the new branch
      const validMode = sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER';
      const [result] = await conn.query(
        'INSERT INTO branch (facilityID, name, address, phone, sales_mode, status) VALUES (?, ?, ?, ?, ?, ?)',
        [facilityID, name, address || null, phone || null, validMode, 'active']
      );

      await conn.commit();
      return { insertId: result.insertId, facilityID, sales_mode: validMode };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Update branch details.
   */
  async update(facilityID, { name, address, phone, sales_mode }) {
    let sql = 'UPDATE branch SET name = ?, address = ?, phone = ?';
    const params = [name, address || null, phone || null];
    if (sales_mode) {
      sql += ', sales_mode = ?';
      params.push(sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER');
    }
    sql += ' WHERE facilityID = ?';
    params.push(facilityID);
    const [result] = await db.query(sql, params);
    return result.affectedRows > 0;
  }

  /**
   * Activate or deactivate a branch.
   */
  async setStatus(facilityID, status) {
    const [result] = await db.query(
      "UPDATE branch SET status = ? WHERE facilityID = ?",
      [status, facilityID]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get dashboard summary metrics for a specific branch.
   */
  async getDashboardMetrics(facilityID) {
    const [branchRows] = await db.query(
      'SELECT facilityID, name, address, phone, sales_mode, status FROM branch WHERE facilityID = ? LIMIT 1',
      [facilityID]
    );
    const branchInfo = branchRows[0] || { sales_mode: 'DEALER' };
    const salesMode = branchInfo.sales_mode || 'DEALER';

    const [[todaySales]] = await db.query(
      `SELECT 
        COUNT(DISTINCT orderID) as order_count,
        COALESCE(SUM(CAST(subtotal AS DECIMAL(15,2))), 0) as gross_sales,
        COALESCE(SUM(CAST(discount AS DECIMAL(15,2))), 0) as total_discount,
        COALESCE(SUM(CASE WHEN payment = 'Credit' OR status = 0 THEN CAST(net_total AS DECIMAL(15,2)) ELSE 0 END), 0) as credit_sales,
        COALESCE(SUM(CASE WHEN payment != 'Credit' AND status = 1 THEN CAST(amount_paid AS DECIMAL(15,2)) ELSE 0 END), 0) as cash_sales
       FROM orders 
       WHERE facilityID = ? AND DATE(creation) = CURDATE()`,
      [facilityID]
    );

    const [[stockMetrics]] = await db.query(
      `SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2))), 0) as total_quantity,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2)) * CAST(selling AS DECIMAL(15,2))), 0) as total_value
       FROM stocks 
       WHERE facilityID = ? AND status = 'active'`,
      [facilityID]
    );

    const [[debts]] = await db.query(
      `SELECT 
        COALESCE(SUM(CAST(balance AS DECIMAL(15,2))), 0) as total_outstanding,
        COUNT(DISTINCT customerID) as debtor_count
       FROM outstand WHERE facilityID = ? AND CAST(balance AS DECIMAL(15,2)) > 0`,
      [facilityID]
    );

    const [[staffCount]] = await db.query(
      'SELECT COUNT(*) as total FROM facility WHERE facilityID = ? AND status = 1',
      [facilityID]
    );

    const [[shipmentMetrics]] = await db.query(
      `SELECT 
        COUNT(DISTINCT s.id) as in_transit,
        COALESCE(SUM(CASE WHEN s.destination_branch = ? THEN si.quantity_sent ELSE 0 END), 0) as incoming_units,
        COALESCE(SUM(CASE WHEN s.source_branch = ? THEN si.quantity_sent ELSE 0 END), 0) as outgoing_units,
        COUNT(DISTINCT CASE WHEN s.destination_branch = ? THEN s.id ELSE NULL END) as incoming_shipments,
        COUNT(DISTINCT CASE WHEN s.source_branch = ? THEN s.id ELSE NULL END) as outgoing_shipments
       FROM shipments s
       LEFT JOIN shipment_items si ON s.id = si.shipment_id
       WHERE (s.source_branch = ? OR s.destination_branch = ?) AND s.status = 'In Transit'`,
      [facilityID, facilityID, facilityID, facilityID, facilityID, facilityID]
    );

    const [[receivedSupplier]] = await db.query(
      `SELECT 
        COUNT(*) as intakes_today,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2))), 0) as units_today
       FROM purchase_history 
       WHERE facilityID = ? AND DATE(purchase_date) = CURDATE()`,
      [facilityID]
    );

    const [[receivedTransfers]] = await db.query(
      `SELECT 
        COUNT(DISTINCT s.id) as transfers_today,
        COALESCE(SUM(CAST(si.quantity_received AS DECIMAL(15,2))), 0) as units_today
       FROM shipments s
       LEFT JOIN shipment_items si ON s.id = si.shipment_id
       WHERE s.destination_branch = ? AND s.status = 'Received' AND DATE(s.received_at) = CURDATE()`,
      [facilityID]
    );

    const gross = parseFloat(todaySales.gross_sales);
    const disc = parseFloat(todaySales.total_discount);
    const net = gross - disc;

    return {
      sales_mode: salesMode,
      unit_label: salesMode === 'PER_YARD' ? 'Yards' : 'Belts',
      today_sales: {
        order_count: todaySales.order_count,
        gross_sales: gross,
        total_discount: disc,
        net_sales: net,
        cash_sales: parseFloat(todaySales.cash_sales),
        credit_sales: parseFloat(todaySales.credit_sales),
      },
      stock: {
        total_products: stockMetrics.total_products,
        total_quantity: parseFloat(stockMetrics.total_quantity),
        total_value: parseFloat(stockMetrics.total_value),
        unit_type: salesMode === 'PER_YARD' ? 'yards' : 'belts',
      },
      debts: {
        total_outstanding: parseFloat(debts.total_outstanding),
        debtor_count: debts.debtor_count,
      },
      staff: {
        active_count: staffCount.total,
      },
      shipments: {
        in_transit: shipmentMetrics.in_transit,
        incoming_shipments: shipmentMetrics.incoming_shipments,
        outgoing_shipments: shipmentMetrics.outgoing_shipments,
        incoming_units: parseFloat(shipmentMetrics.incoming_units),
        outgoing_units: parseFloat(shipmentMetrics.outgoing_units),
      },
      received_today: {
        total_receipts: receivedSupplier.intakes_today + receivedTransfers.transfers_today,
        total_units: parseFloat(receivedSupplier.units_today) + parseFloat(receivedTransfers.units_today),
        supplier_intakes: receivedSupplier.intakes_today,
        supplier_units: parseFloat(receivedSupplier.units_today),
        transfer_receipts: receivedTransfers.transfers_today,
        transfer_units: parseFloat(receivedTransfers.units_today),
      },
    };
  }
}

module.exports = new BranchRepository();
