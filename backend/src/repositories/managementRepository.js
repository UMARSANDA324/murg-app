const crypto = require('crypto');
const db = require('../config/database');

class ManagementRepository {
  /**
   * Generates a cryptographically secure, 60-second single-use bridge ticket
   */
  async createBridgeTicket({ userId, facilityID, role, email, name, targetPath }) {
    const ticket = crypto.randomBytes(32).toString('hex');

    await db.query(
      `INSERT INTO auth_bridge_tickets 
       (ticket, user_id, facilityID, role, email, name, target_path, consumed, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL 60 SECOND))`,
      [ticket, userId, facilityID, role, email, name, targetPath]
    );

    return ticket;
  }

  /**
   * Global multi-branch administrative overview
   */
  async getOverview() {
    // 1. Branch stats
    const [branches] = await db.query(
      'SELECT id, facilityID, name, sales_mode, status FROM branch ORDER BY id ASC'
    );
    const totalBranches = branches.length;
    const activeBranches = branches.filter(b => b.status === 'active').length;

    // 2. Staff stats
    const [staff] = await db.query(
      'SELECT id, role, status FROM facility WHERE status = 1'
    );
    const totalStaff = staff.length;
    const adminCount = staff.filter(s => s.role === 'Admin').length;
    const cashierCount = staff.filter(s => s.role === 'Staff').length;

    // 3. Stock inventory valuation across all branches
    const [stockStats] = await db.query(`
      SELECT 
        COUNT(id) as total_products,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2))), 0) as total_units,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2)) * CAST(buying AS DECIMAL(15,2))), 0) as total_cost_value,
        COALESCE(SUM(CAST(quantity AS DECIMAL(15,2)) * CAST(selling AS DECIMAL(15,2))), 0) as total_retail_value
      FROM stocks 
      WHERE status = 'active'
    `);

    // 4. Shipment logistics stats
    const [shipmentStats] = await db.query(`
      SELECT 
        COUNT(id) as total_shipments,
        COALESCE(SUM(CASE WHEN status = 'In Transit' THEN 1 ELSE 0 END), 0) as in_transit_count,
        COALESCE(SUM(CASE WHEN status = 'Received' AND DATE(received_at) = CURDATE() THEN 1 ELSE 0 END), 0) as received_today_count,
        COALESCE(SUM(CASE WHEN status = 'Received' THEN 1 ELSE 0 END), 0) as received_total_count
      FROM shipments
    `);

    // 5. Receivables / Outstanding debts
    const [debtStats] = await db.query(`
      SELECT 
        COUNT(id) as debtor_count,
        COALESCE(SUM(CAST(balance AS DECIMAL(15,2))), 0) as total_debt_balance
      FROM outstand 
      WHERE CAST(balance AS DECIMAL(15,2)) > 0
    `);

    // 6. Today's sales across all branches
    const [salesStats] = await db.query(`
      SELECT 
        COALESCE(SUM(t.order_net), 0) as today_sales_total,
        COUNT(t.orderID) as today_orders_count
      FROM (
        SELECT 
          orderID,
          COALESCE(
            NULLIF(MAX(CAST(net_total AS DECIMAL(15,2))), 0),
            SUM(CAST(subtotal AS DECIMAL(15,2)))
          ) as order_net
        FROM orders
        WHERE DATE(creation) = CURDATE()
        GROUP BY orderID
      ) as t
    `);

    // 7. Customer stats across all branches
    const [customerStats] = await db.query(`
      SELECT 
        COUNT(id) as total_customers,
        COUNT(DISTINCT CASE WHEN phone IS NOT NULL AND phone != '' AND phone != '0' THEN phone ELSE CAST(id AS CHAR) END) as unique_customers
      FROM customers
    `);

    // 8. Recent audit log count
    const [auditCount] = await db.query('SELECT COUNT(id) as total_logs FROM audit_logs');

    return {
      todaySales: {
        total: parseFloat(salesStats[0]?.today_sales_total || 0),
        count: parseInt(salesStats[0]?.today_orders_count || 0),
      },
      inventory: {
        total_products: parseInt(stockStats[0]?.total_products || 0),
        total_units: parseFloat(stockStats[0]?.total_units || 0),
        total_cost_value: parseFloat(stockStats[0]?.total_cost_value || 0),
        total_retail_value: parseFloat(stockStats[0]?.total_retail_value || 0),
      },
      customers: {
        total: parseInt(customerStats[0]?.unique_customers || customerStats[0]?.total_customers || 0),
        raw_total: parseInt(customerStats[0]?.total_customers || 0),
      },
      shipments: {
        total: parseInt(shipmentStats[0]?.total_shipments || 0),
        in_transit: parseInt(shipmentStats[0]?.in_transit_count || 0),
        received_today: parseInt(shipmentStats[0]?.received_today_count || 0),
        received: parseInt(shipmentStats[0]?.received_total_count || 0),
      },
      debts: {
        debtor_count: parseInt(debtStats[0]?.debtor_count || 0),
        total_balance: parseFloat(debtStats[0]?.total_debt_balance || 0),
      },
      branches: {
        total: totalBranches,
        active: activeBranches,
        list: branches,
      },
      staff: {
        total: totalStaff,
        admins: adminCount,
        cashiers: cashierCount,
      },
      audit: {
        total_logs: parseInt(auditCount[0]?.total_logs || 0),
      },
    };
  }

  /**
   * System audit log retrieval with pagination
   */
  async getAuditLogs({ limit = 50, offset = 0, action = null, facilityID = null } = {}) {
    let sql = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    const [countResult] = await db.query('SELECT COUNT(id) as total FROM audit_logs');

    return {
      logs: rows,
      total: countResult[0]?.total || 0,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  }
}

module.exports = new ManagementRepository();
