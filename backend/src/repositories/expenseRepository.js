const db = require('../config/database');

/**
 * ExpenseRepository - Branch expense tracking
 * Handles CRUD operations for branch expenses with type (in/out) and date filtering
 */
class ExpenseRepository {
  /**
   * Get all expenses for a branch with optional filters
   */
  async getExpenses({ facilityID, type = null, fromDate = null, toDate = null }) {
    let sql = `
      SELECT id, facilityID, item, price, type, creation
      FROM expense
      WHERE facilityID = ?
    `;
    const params = [facilityID];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (fromDate && toDate) {
      sql += ' AND DATE(creation) BETWEEN ? AND ?';
      params.push(fromDate, toDate);
    } else {
      // Default to today if no date range specified
      sql += ' AND DATE(creation) = CURDATE()';
    }

    sql += ' ORDER BY creation DESC';

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Get expense by ID
   */
  async getExpenseById(id, facilityID) {
    const [rows] = await db.query(
      'SELECT * FROM expense WHERE id = ? AND facilityID = ?',
      [id, facilityID]
    );
    return rows[0] || null;
  }

  /**
   * Create new expense
   */
  async createExpense({ facilityID, item, price, type }) {
    const [result] = await db.query(
      'INSERT INTO expense (facilityID, item, price, type) VALUES (?, ?, ?, ?)',
      [facilityID, item, price, type]
    );
    return result.insertId;
  }

  /**
   * Update expense
   */
  async updateExpense(id, { facilityID, item, price, type }) {
    const [result] = await db.query(
      'UPDATE expense SET item = ?, price = ?, type = ? WHERE id = ? AND facilityID = ?',
      [item, price, type, id, facilityID]
    );
    return result.affectedRows > 0;
  }

  /**
   * Delete expense
   */
  async deleteExpense(id, facilityID) {
    const [result] = await db.query(
      'DELETE FROM expense WHERE id = ? AND facilityID = ?',
      [id, facilityID]
    );
    return result.affectedRows > 0;
  }

  /**
   * Get expense totals for a branch with optional date range
   */
  async getExpenseTotals({ facilityID, fromDate = null, toDate = null }) {
    let sql = `
      SELECT 
        SUM(CASE WHEN type = 'in' THEN price ELSE 0 END) as total_in,
        SUM(CASE WHEN type = 'out' THEN price ELSE 0 END) as total_out
      FROM expense
      WHERE facilityID = ?
    `;
    const params = [facilityID];

    if (fromDate && toDate) {
      sql += ' AND DATE(creation) BETWEEN ? AND ?';
      params.push(fromDate, toDate);
    } else {
      sql += ' AND DATE(creation) = CURDATE()';
    }

    const [rows] = await db.query(sql, params);
    const row = rows[0] || {};
    return {
      total_in: parseFloat(row.total_in || 0),
      total_out: parseFloat(row.total_out || 0),
      net: parseFloat((row.total_in || 0) - (row.total_out || 0)),
    };
  }

  /**
   * Get today's expense totals for dashboard cards
   */
  async getTodayTotals(facilityID) {
    const [rows] = await db.query(
      `
      SELECT 
        SUM(CASE WHEN type = 'in' THEN price ELSE 0 END) as today_in,
        SUM(CASE WHEN type = 'out' THEN price ELSE 0 END) as today_out
      FROM expense
      WHERE facilityID = ? AND DATE(creation) = CURDATE()
      `,
      [facilityID]
    );
    const row = rows[0] || {};
    return {
      today_in: parseFloat(row.today_in || 0),
      today_out: parseFloat(row.today_out || 0),
    };
  }

  /**
   * Get all-time expense totals
   */
  async getAllTimeTotals(facilityID) {
    const [rows] = await db.query(
      `
      SELECT 
        SUM(CASE WHEN type = 'in' THEN price ELSE 0 END) as total_in,
        SUM(CASE WHEN type = 'out' THEN price ELSE 0 END) as total_out
      FROM expense
      WHERE facilityID = ?
      `,
      [facilityID]
    );
    const row = rows[0] || {};
    return {
      total_in: parseFloat(row.total_in || 0),
      total_out: parseFloat(row.total_out || 0),
    };
  }
}

module.exports = new ExpenseRepository();
