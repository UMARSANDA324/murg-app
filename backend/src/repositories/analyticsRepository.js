const db = require('../config/database');

/**
 * AnalyticsRepository — Sales activity metrics (DAS/WAS/MAS)
 * High-performance SQL aggregation covering both normal and debt sales.
 * All queries support facilityID scoping for branch isolation,
 * or cross-branch aggregation for Global Admin.
 * Uses official business timezone: Africa/Lagos (+01:00).
 */
class AnalyticsRepository {
  /**
   * Get date boundaries for target day, calendar week (Mon-Sun), and month in Africa/Lagos
   * @param {string|null} targetDate - Optional YYYY-MM-DD
   */
  async getDateBoundaries(targetDate = null) {
    const [rows] = await db.query(`
      SELECT 
        DATE_FORMAT(COALESCE(?, CURDATE()), '%Y-%m-%d') as today,
        DATE_FORMAT(DATE_SUB(COALESCE(?, CURDATE()), INTERVAL WEEKDAY(COALESCE(?, CURDATE())) DAY), '%Y-%m-%d') as week_start,
        DATE_FORMAT(DATE_ADD(DATE_SUB(COALESCE(?, CURDATE()), INTERVAL WEEKDAY(COALESCE(?, CURDATE())) DAY), INTERVAL 6 DAY), '%Y-%m-%d') as week_end,
        DATE_FORMAT(COALESCE(?, CURDATE()), '%Y-%m-01') as month_start,
        DATE_FORMAT(LAST_DAY(COALESCE(?, CURDATE())), '%Y-%m-%d') as month_end
    `, [targetDate, targetDate, targetDate, targetDate, targetDate, targetDate, targetDate]);

    const r = rows[0];
    return {
      day: r.today,
      today: r.today,
      weekStart: r.week_start,
      weekEnd: r.week_end,
      monthStart: r.month_start,
      monthEnd: r.month_end,
      timezone: 'Africa/Lagos (+01:00)',
    };
  }

  /**
   * Unified authoritative aggregation for DAS, WAS, MAS and sales/debt breakdown.
   * Scoped by facilityID if provided, or entire application if null.
   */
  async getSalesActivity({ facilityID = null, date, weekStart, weekEnd, monthStart, monthEnd }) {
    let sql = `
      SELECT 
        COUNT(DISTINCT CASE WHEN DATE(creation) = ? THEN orderID END) as das,
        COUNT(DISTINCT CASE WHEN DATE(creation) = ? AND (status <> 0) AND (payment IS NULL OR payment <> 'Credit') THEN orderID END) as das_normal,
        COUNT(DISTINCT CASE WHEN DATE(creation) = ? AND (payment = 'Credit' OR status = 0) THEN orderID END) as das_debt,

        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? THEN orderID END) as was,
        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? AND (status <> 0) AND (payment IS NULL OR payment <> 'Credit') THEN orderID END) as was_normal,
        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? AND (payment = 'Credit' OR status = 0) THEN orderID END) as was_debt,

        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? THEN orderID END) as mas,
        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? AND (status <> 0) AND (payment IS NULL OR payment <> 'Credit') THEN orderID END) as mas_normal,
        COUNT(DISTINCT CASE WHEN DATE(creation) >= ? AND DATE(creation) <= ? AND (payment = 'Credit' OR status = 0) THEN orderID END) as mas_debt
      FROM orders
      WHERE DATE(creation) >= ? AND DATE(creation) <= ?
    `;
    const params = [
      date, date, date,
      weekStart, weekEnd, weekStart, weekEnd, weekStart, weekEnd,
      monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd,
      monthStart, monthEnd
    ];

    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }

    const [rows] = await db.query(sql, params);
    const r = rows[0] || {};

    return {
      das: parseInt(r.das || 0),
      was: parseInt(r.was || 0),
      mas: parseInt(r.mas || 0),
      breakdown: {
        daily: {
          normalSales: parseInt(r.das_normal || 0),
          debtSales: parseInt(r.das_debt || 0),
          total: parseInt(r.das || 0),
        },
        weekly: {
          normalSales: parseInt(r.was_normal || 0),
          debtSales: parseInt(r.was_debt || 0),
          total: parseInt(r.was || 0),
        },
        monthly: {
          normalSales: parseInt(r.mas_normal || 0),
          debtSales: parseInt(r.mas_debt || 0),
          total: parseInt(r.mas || 0),
        },
      },
    };
  }

  /**
   * Backward-compatible convenience methods
   */
  async getDailyActiveSales({ facilityID, date }) {
    let sql = 'SELECT COUNT(DISTINCT orderID) as das FROM orders WHERE DATE(creation) = ?';
    const params = [date];
    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }
    const [rows] = await db.query(sql, params);
    return parseInt(rows[0]?.das || 0);
  }

  async getWeeklyActiveSales({ facilityID, weekStart, weekEnd }) {
    let sql = 'SELECT COUNT(DISTINCT orderID) as was FROM orders WHERE DATE(creation) >= ? AND DATE(creation) <= ?';
    const params = [weekStart, weekEnd];
    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }
    const [rows] = await db.query(sql, params);
    return parseInt(rows[0]?.was || 0);
  }

  async getMonthlyActiveSales({ facilityID, monthStart, monthEnd }) {
    let sql = 'SELECT COUNT(DISTINCT orderID) as mas FROM orders WHERE DATE(creation) >= ? AND DATE(creation) <= ?';
    const params = [monthStart, monthEnd];
    if (facilityID) {
      sql += ' AND facilityID = ?';
      params.push(facilityID);
    }
    const [rows] = await db.query(sql, params);
    return parseInt(rows[0]?.mas || 0);
  }

  async getEntireAppSalesActivity({ date, weekStart, weekEnd, monthStart, monthEnd }) {
    return this.getSalesActivity({ facilityID: null, date, weekStart, weekEnd, monthStart, monthEnd });
  }
}

module.exports = new AnalyticsRepository();
