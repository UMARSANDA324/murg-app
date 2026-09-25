const db = require('../config/database');

/**
 * CustomerRepository — Customer debt ledger and deposit history.
 * Enforces branch scoping on debt records and deposits.
 */
class CustomerRepository {
  async findAll({ facilityID, search = null } = {}) {
    let sql = `
      SELECT c.*, 
             COALESCE(o.balance, 0) as outstanding_balance,
             COALESCE(o.amount, 0) as total_deposited
      FROM customers c
      LEFT JOIN outstand o ON c.id = o.customerID AND o.facilityID = ?
      WHERE (c.facilityID = ? OR ? IS NULL)
    `;
    const params = [facilityID, facilityID, facilityID];

    if (search) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY c.name ASC';
    const [rows] = await db.query(sql, params);
    return rows.map(r => ({
      ...r,
      outstanding_balance: parseFloat(r.outstanding_balance) || 0,
      total_deposited: parseFloat(r.total_deposited) || 0,
    }));
  }

  async findById(id, facilityID = null) {
    let sql = `
      SELECT c.*, 
             COALESCE(o.balance, 0) as outstanding_balance,
             COALESCE(o.amount, 0) as total_deposited
      FROM customers c
      LEFT JOIN outstand o ON c.id = o.customerID AND o.facilityID = ?
      WHERE c.id = ?
    `;
    const [rows] = await db.query(sql, [facilityID, id]);
    if (!rows[0]) return null;

    return {
      ...rows[0],
      outstanding_balance: parseFloat(rows[0].outstanding_balance) || 0,
      total_deposited: parseFloat(rows[0].total_deposited) || 0,
    };
  }

  async create({ facilityID, name, phone, email, gender, address }) {
    const [result] = await db.query(
      'INSERT INTO customers (facilityID, name, phone, email, gender, address) VALUES (?, ?, ?, ?, ?, ?)',
      [facilityID, name, phone || '', email || '', gender || 'Male', address || '']
    );
    return result.insertId;
  }

  /**
   * Record debt repayment deposit atomically.
   */
  async recordDeposit({
    facilityID,
    customerId,
    amount,
    paymentMethod,
    description = '',
    processedByName,
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Lock customer outstand row
      const [outstandRows] = await conn.query(
        'SELECT * FROM outstand WHERE customerID = ? AND facilityID = ? FOR UPDATE',
        [customerId, facilityID]
      );

      const currentBalance = outstandRows[0] ? parseFloat(outstandRows[0].balance) : 0;
      const currentDeposits = outstandRows[0] ? parseFloat(outstandRows[0].amount) : 0;

      const newBalance = currentBalance - amount;
      const newDeposits = currentDeposits + amount;
      const transactionId = `DP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

      if (outstandRows.length > 0) {
        await conn.query(
          'UPDATE outstand SET amount = ?, balance = ? WHERE customerID = ? AND facilityID = ?',
          [newDeposits, newBalance, customerId, facilityID]
        );
      } else {
        const [cust] = await conn.query('SELECT name FROM customers WHERE id = ?', [customerId]);
        const custName = cust[0]?.name || 'Unknown';
        await conn.query(
          'INSERT INTO outstand (facilityID, customerID, staffID, Customer, staff, amount, balance) VALUES (?, ?, 0, ?, ?, ?, ?)',
          [facilityID, customerId, custName, processedByName, newDeposits, newBalance]
        );
      }

      // Record in deposit_history with facilityID branch scope
      const [depResult] = await conn.query(
        `INSERT INTO deposit_history 
         (facilityID, customerID, transaction_id, amount, payment_method, description, previous_balance, new_balance, processed_by, deposit_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [facilityID, customerId, transactionId, amount, paymentMethod, description, currentBalance, newBalance, processedByName]
      );

      await conn.commit();
      return {
        depositId: depResult.insertId,
        transactionId,
        previousBalance: currentBalance,
        newBalance,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * Get deposit history for a customer or branch.
   */
  async getDepositHistory({ facilityID, customerId = null, limit = 50 }) {
    let sql = `
      SELECT dh.*, c.name as customer_name
      FROM deposit_history dh
      LEFT JOIN customers c ON dh.customerID = c.id
      WHERE (dh.facilityID = ? OR dh.facilityID IS NULL)
    `;
    const params = [facilityID];

    if (customerId) {
      sql += ' AND dh.customerID = ?';
      params.push(customerId);
    }

    sql += ' ORDER BY dh.deposit_date DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return rows;
  }
}

module.exports = new CustomerRepository();
