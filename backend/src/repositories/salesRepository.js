const db = require('../config/database');

/**
 * SalesRepository — Atomic POS checkout operations.
 * Stock is NEVER decremented until checkout commits successfully.
 */
class SalesRepository {
  /**
   * Get branch sales with optional date filters.
   * Scoped by facilityID at query level.
   */
  async findByBranch({ facilityID, startDate, endDate, limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT 
        orderID,
        facilityID,
        staff,
        buyer_name,
        customer_name,
        customerID,
        payment,
        discount,
        amount_paid,
        net_total,
        cash,
        pos,
        transfer,
        bank_name,
        status,
        creation,
        COUNT(*) as item_count,
        SUM(CAST(subtotal AS DECIMAL(15,2))) as gross_total
      FROM orders
      WHERE facilityID = ?
    `;
    const params = [facilityID];

    if (startDate) { sql += ' AND DATE(creation) >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND DATE(creation) <= ?'; params.push(endDate); }

    sql += ' GROUP BY orderID ORDER BY creation DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Get all line items for a specific order.
   */
  async findOrderItems(orderID, facilityID) {
    const [rows] = await db.query(
      `SELECT o.*, st.store_name, s.unit_type
       FROM orders o
       LEFT JOIN stocks sk ON o.stockID = sk.id
       LEFT JOIN stores st ON sk.store_id = st.id
       LEFT JOIN stocks s ON o.stockID = s.id
       WHERE o.orderID = ? AND o.facilityID = ?`,
      [orderID, facilityID]
    );
    return rows;
  }

  /**
   * Get receipt data (order + branch details) for printing.
   * Enhanced to support historical receipt reconstruction from stock movements.
   * Deterministically reconstructs complete receipt from persistent database records.
   */
  async getReceiptData(orderID, facilityID = null) {
    let sql = `
      SELECT o.*, st.store_name, c.phone as customer_phone
      FROM orders o
      LEFT JOIN stocks sk ON o.stockID = sk.id
      LEFT JOIN stores st ON sk.store_id = st.id
      LEFT JOIN customers c ON o.customerID = c.id
      WHERE o.orderID = ?
    `;
    const params = [orderID];
    if (facilityID) {
      sql += ' AND o.facilityID = ?';
      params.push(facilityID);
    }
    sql += ' ORDER BY o.id ASC';

    const [items] = await db.query(sql, params);
    if (!items.length) return null;

    const [branch] = await db.query(
      'SELECT name, address, phone, facilityID FROM branch WHERE facilityID = ?',
      [items[0].facilityID]
    );

    const isCredit = items[0].payment === 'Credit' || items[0].status === 0;
    const netTotal = parseFloat(items[0].net_total) || items.reduce((acc, i) => acc + parseFloat(i.subtotal), 0);
    const amountPaid = parseFloat(items[0].amount_paid) || 0;
    const debtBalance = isCredit ? Math.max(0, netTotal - amountPaid) : 0;

    return {
      branch: branch[0] || { facilityID: items[0].facilityID, name: items[0].facilityID, address: '', phone: '' },
      order: {
        orderID: items[0].orderID,
        facilityID: items[0].facilityID,
        payment: items[0].payment,
        is_credit: isCredit,
        status: items[0].status,
        buyer_name: items[0].buyer_name || items[0].customer_name || 'Retail Customer',
        customer_name: items[0].customer_name || null,
        customer_phone: items[0].customer_phone || null,
        staff: items[0].staff,
        creation: items[0].creation,
        net_total: netTotal,
        amount_paid: amountPaid,
        debt_amount: debtBalance,
        change_given: parseFloat(items[0].change_given) || 0,
        discount: parseFloat(items[0].discount) || 0,
        cash: parseFloat(items[0].cash) || 0,
        pos: parseFloat(items[0].pos) || 0,
        transfer: parseFloat(items[0].transfer) || 0,
        bank_name: items[0].bank_name,
        store_name: items[0].store_name || 'N/A',
      },
      items: items.map(i => ({
        item: i.item,
        price: parseFloat(i.price),
        quantity: parseFloat(i.quantity),
        item_discount: parseFloat(i.item_discount) || 0,
        subtotal: parseFloat(i.subtotal),
      })),
    };
  }

  /**
   * Get sales/debt sales for a specific date range with grouping capability.
   * Used for daily ledger and historical receipt access.
   */
  async getSalesByDateRange({ facilityID, startDate, endDate, limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT 
        orderID,
        facilityID,
        staff,
        buyer_name,
        customer_name,
        customerID,
        payment,
        discount,
        amount_paid,
        net_total,
        cash,
        pos,
        transfer,
        bank_name,
        status,
        creation,
        COUNT(*) as item_count,
        SUM(CAST(subtotal AS DECIMAL(15,2))) as gross_total
      FROM orders
      WHERE facilityID = ?
    `;
    const params = [facilityID];

    if (startDate) { sql += ' AND DATE(creation) >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND DATE(creation) <= ?'; params.push(endDate); }

    sql += ' GROUP BY orderID ORDER BY creation DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Execute atomic checkout.
   * Returns the generated orderID on success.
   *
   * @param {object} params - Checkout parameters
   * @param {string} params.facilityID
   * @param {number} params.staffID
   * @param {string} params.staffName
   * @param {Array}  params.items - [{stockId, storeId, quantity, price, itemDiscount}]
   * @param {string} params.buyerName
   * @param {number|null} params.customerID
   * @param {number} params.globalDiscount
   * @param {object} params.payment - {cash, pos, transfer, bankName}
   * @param {boolean} params.isCredit
   */
  async atomicCheckout({
    facilityID, staffID, staffName, items,
    buyerName, customerName, customerID,
    globalDiscount = 0,
    payment = { cash: 0, pos: 0, transfer: 0, bankName: null },
    isCredit = false,
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check branch sales_mode
      const [branchRows] = await conn.query('SELECT sales_mode FROM branch WHERE facilityID = ?', [facilityID]);
      const isPerYardBranch = branchRows[0]?.sales_mode === 'PER_YARD';

      // Phase 1: Lock stock rows, validate stock levels, and enforce authoritative prices
      const validatedItems = [];
      let grossTotal = 0;
      let totalItemDiscounts = 0;

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error(`Invalid quantity ${item.quantity} for product ID ${item.stockId}. Quantity must be greater than zero.`);
        }

        const [stockRows] = await conn.query(
          'SELECT id, name, quantity, facilityID, store_id, unit_type, selling, price_per_yard FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
          [item.stockId, facilityID]
        );

        if (!stockRows[0]) {
          throw new Error(`Product ID ${item.stockId} not found in this branch.`);
        }

        const stock = stockRows[0];
        const available = parseFloat(stock.quantity) || 0;
        if (qty > available) {
          throw new Error(`Insufficient stock for "${stock.name}". Available: ${available}, Requested: ${qty}.`);
        }

        // Authoritative server-side price determination: client price cannot override DB price
        let authoritativePrice;
        if (isPerYardBranch || stock.unit_type === 'yard') {
          authoritativePrice = stock.price_per_yard !== null && stock.price_per_yard !== undefined
            ? parseFloat(stock.price_per_yard)
            : parseFloat(stock.selling);
        } else {
          authoritativePrice = parseFloat(stock.selling);
        }

        if (isNaN(authoritativePrice) || authoritativePrice <= 0) {
          authoritativePrice = parseFloat(item.price) || 0;
        }

        const itemDiscount = parseFloat(item.itemDiscount) || 0;
        const itemSubtotal = authoritativePrice * qty;

        grossTotal += itemSubtotal;
        totalItemDiscounts += itemDiscount * qty;

        validatedItems.push({
          stockId: stock.id,
          name: stock.name,
          storeId: stock.store_id,
          unitType: stock.unit_type,
          price: authoritativePrice,
          quantity: qty,
          itemDiscount,
          subtotal: itemSubtotal,
          available,
        });
      }

      const orderID = `${Date.now()}${Math.floor(Math.random() * 90) + 10}`;
      const totalPaid = (parseFloat(payment.cash) || 0) + (parseFloat(payment.pos) || 0) + (parseFloat(payment.transfer) || 0);
      const netTotal = Math.max(0, grossTotal - globalDiscount - totalItemDiscounts);
      const paymentType = isCredit ? 'Credit' : 'Split Payment';

      // Phase 2: Deduct stock atomically and insert order line items
      for (const item of validatedItems) {
        const qtyBefore = item.available;
        const qtyAfter = item.available - item.quantity;

        // Deduct inventory atomically with safeguard against negative stock
        const [updateResult] = await conn.query(
          'UPDATE stocks SET quantity = CAST(quantity AS DECIMAL(15,2)) - ?, out_stocks = CAST(out_stocks AS DECIMAL(15,2)) + ? WHERE id = ? AND CAST(quantity AS DECIMAL(15,2)) >= ?',
          [item.quantity, item.quantity, item.stockId, item.quantity]
        );

        if (updateResult.affectedRows === 0) {
          throw new Error(`Insufficient stock for "${item.name}". Race condition prevented sale.`);
        }

        // Insert order line item
        await conn.query(
          `INSERT INTO orders 
           (facilityID, staffID, stockID, item, price, quantity, subtotal, item_discount,
            staff, payment, orderID, discount, status,
            customerID, customer_name, buyer_name, amount_paid, change_given, net_total,
            bank_name, cash, pos, transfer, creation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            facilityID, staffID, item.stockId, item.name, item.price, item.quantity, item.subtotal,
            item.itemDiscount,
            staffName, paymentType, orderID, globalDiscount,
            isCredit ? 0 : 1,
            customerID || null, customerName || null, buyerName || null,
            totalPaid,
            Math.max(0, totalPaid - netTotal),
            netTotal,
            payment.bankName || null, payment.cash, payment.pos, payment.transfer,
          ]
        );

        // Write to immutable stock movement ledger
        await conn.query(
          `INSERT INTO stock_movements 
           (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
           VALUES (?, ?, ?, 'STOCK_OUT_SALE', ?, ?, ?, 'orders', ?, ?, ?)`,
          [facilityID, item.storeId, item.stockId, -item.quantity, qtyBefore, qtyAfter, orderID, `Sale to ${buyerName || customerName || 'Retail'}`, staffID]
        );
      }

      // Handle credit outstanding balance update
      if (isCredit) {
        const creditBalance = netTotal - totalPaid;
        if (creditBalance > 0 && customerID) {
          const [existing] = await conn.query(
            'SELECT id, amount, balance FROM outstand WHERE customerID = ? AND facilityID = ?',
            [customerID, facilityID]
          );

          if (existing.length > 0) {
            await conn.query(
              'UPDATE outstand SET amount = amount + ?, balance = balance + ? WHERE customerID = ? AND facilityID = ?',
              [totalPaid, creditBalance, customerID, facilityID]
            );
          } else {
            await conn.query(
              'INSERT INTO outstand (facilityID, customerID, staffID, Customer, staff, amount, balance) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [facilityID, customerID, staffID, customerName || buyerName || 'Customer', staffName, totalPaid, creditBalance]
            );
          }
        }
      }

      // Insert into sales_queue (for legacy compatibility)
      await conn.query(
        'INSERT IGNORE INTO sales_queue (orderID, facilityID, status) VALUES (?, ?, ?)',
        [orderID, facilityID, 'pending']
      );

      await conn.commit();
      return { orderID, grossTotal, totalItemDiscounts, netTotal, isCredit };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new SalesRepository();
