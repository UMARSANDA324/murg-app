const db = require('../config/database');

/**
 * ReturnsRepository - Order returns and stock restoration
 * Handles complex business logic for returning completed orders to cart,
 * restoring stock quantities, and reversing debt for credit sales.
 */
class ReturnsRepository {
  /**
   * Get order by orderID for return verification
   */
  async getOrderByOrderID(orderID, facilityID) {
    const [rows] = await db.query(
      'SELECT * FROM orders WHERE orderID = ? AND facilityID = ?',
      [orderID, facilityID]
    );
    return rows;
  }

  /**
   * Process order return - atomic transaction
   * 1. Fetch all order items
   * 2. Restore stock quantities
   * 3. Move items to cart
   * 4. Reverse debt if credit sale
   * 5. Delete order records
   */
  async processOrderReturn(orderID, facilityID, staffID) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. Fetch all items in the order
      const [orderItems] = await connection.query(
        'SELECT * FROM orders WHERE orderID = ? AND facilityID = ? FOR UPDATE',
        [orderID, facilityID]
      );
      
      if (orderItems.length === 0) {
        await connection.rollback();
        return { success: false, message: 'Order not found' };
      }
      
      let totalToReverse = 0;
      let customerID = 0;
      let isCredit = false;
      
      // 2. Process each item
      for (const item of orderItems) {
        const stockID = item.stockID;
        const itemName = item.item;
        const price = item.price;
        const qty = item.quantity;
        const subtotal = item.subtotal;
        const rowNetTotal = parseFloat(item.net_total || 0);
        totalToReverse += rowNetTotal;
        
        // Check if credit sale
        if (item.payment === 'Credit' || item.status == 0) {
          isCredit = true;
          customerID = item.customerID;
        }
        
        // Fetch store_id to preserve Store tracking
        const [stockRows] = await connection.query(
          'SELECT store_id FROM stocks WHERE id = ?',
          [stockID]
        );
        const store_id = stockRows[0]?.store_id || null;
        const store_id_val = store_id ? `'${store_id}'` : 'NULL';
        
        // 3. Restore stock quantity
        await connection.query(
          'UPDATE stocks SET quantity = quantity + ? WHERE id = ?',
          [qty, stockID]
        );
        
        // 4. Insert into cart for this staff member
        await connection.query(
          `INSERT INTO cart (facilityID, staffID, stockID, store_id, item, price, quantity, subtotal, status)
           VALUES (?, ?, ?, ${store_id_val}, ?, ?, ?, ?, '0')`,
          [facilityID, staffID, stockID, itemName, price, qty, subtotal]
        );
      }
      
      // 5. Reverse debt if credit sale
      if (isCredit && customerID > 0) {
        await connection.query(
          'UPDATE outstand SET balance = balance - ? WHERE customerID = ?',
          [totalToReverse, customerID]
        );
      }
      
      // 6. Delete the order records
      await connection.query(
        'DELETE FROM orders WHERE orderID = ? AND facilityID = ?',
        [orderID, facilityID]
      );
      
      await connection.commit();
      
      return {
        success: true,
        message: `Order #${orderID} returned to cart successfully`,
        itemsReturned: orderItems.length,
        stockRestored: true,
        debtReversed: isCredit,
        totalReversed: totalToReverse,
      };
      
    } catch (err) {
      await connection.rollback();
      console.error('[ReturnsRepository] Return transaction failed:', err);
      return {
        success: false,
        message: 'Failed to process return. Please try again.',
        error: err.message,
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Validate order before return
   * Check if order exists, belongs to branch, and is not already returned
   */
  async validateOrderForReturn(orderID, facilityID) {
    const [rows] = await db.query(
      'SELECT * FROM orders WHERE orderID = ? AND facilityID = ? LIMIT 1',
      [orderID, facilityID]
    );
    
    if (rows.length === 0) {
      return { valid: false, message: 'Order not found' };
    }
    
    return { valid: true, order: rows[0] };
  }
}

module.exports = new ReturnsRepository();
