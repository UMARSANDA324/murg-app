# Stock Tracking, Inventory Lifecycle & Supplier Management

## 1. Audit of the Existing Stock System

### 1.1 Structural Deficiencies Identified in Legacy Code
The technical audit revealed critical root causes for the reported stock tracking inaccuracies:

1. **Premature Stock Decrementing in Cart (`cart.php`, `credit.php`)**:
   ```php
   // Legacy code executed when a staff clicks "Add to Cart":
   $new_quantity = $available_stock - $quantity;
   mysqli_query($con, "UPDATE stocks SET quantity='$new_quantity', out_stocks = out_stocks + '$quantity' WHERE id='$stockId'");
   ```
   * *The Problem*: Stock was subtracted immediately when placed into the cart rather than upon completed payment or checkout. If a cashier added an item and then closed the browser tab, lost internet connection, or cleared their cart incorrectly, that stock was permanently removed from available inventory.
2. **String Datatypes for Inventory Counts**:
   * In `stocks`, `quantity`, `opening_quantity`, `closing_quantity`, `new_order`, and `out_stocks` are stored as `varchar(200)`. Inconsistent string representation and implicit casting caused subtle calculation discrepancies.
3. **Broken Historical Joins in `track-stock.php`**:
   * Many legacy rows in `purchase_history` have `stock_id = 0` and `facilityID = 0`.
   * When `track-stock.php` executes `WHERE stock_id = '$sid'`, all historical purchases with `stock_id = 0` are excluded from the calculated initial stock, producing invalid or negative starting stock numbers.
4. **Lack of an Immutable Movement Ledger**:
   * There was no single ledger table tracking every addition, deduction, return, damage, and transfer. Quantities were simply overwritten (`UPDATE stocks SET quantity = quantity + x`). Without a movement ledger, auditing inventory discrepancies is mathematically impossible.

---

## 2. Complete End-to-End Stock Lifecycle

```
[ Supplier / Dealer ]
         |
         | 1. Stock Received with Supplier Details
         v
+-------------------+
|  Stock Receipt    | ---> Insert into `stock_receipts` / `purchase_history`
|  & Verification   | ---> Insert into `stock_movements` (TYPE: STOCK_IN_SUPPLIER)
+-------------------+ ---> Increment `stocks.quantity`
         |
         | 2. Available in Branch / Store (Belts / Yards)
         v
+-------------------------------------------------------------+
|                     AVAILABLE INVENTORY                     |
+-------------------------------------------------------------+
   |                  |                      |             |
   | 3a. Sale Made    | 3b. Damaged/Lost     | 3c. Adjust  | 3d. Inter-Branch
   v                  v                      v             v     Transfer
[ POS Checkout ]  [ Damage Log ]      [ Physical Count ] [ Shipping ]
   |                  |                      |             |
   | Deduct on        | Deduct with          | Reconcile   | Deduct from
   | Payment          | Reason               | Audit Log   | Source Branch
   v                  v                      v             v
+-------------------------------------------------------------+
|                IMMUTABLE STOCK MOVEMENT LEDGER              |
|                     (`stock_movements`)                     |
+-------------------------------------------------------------+
   ^
   | 4. Customer Return (Stock Re-credited on Verified Return)
   +----------------------------------------------------------+
```

---

## 3. Detailed Operational Workflows

### 3.1 Stock Receiving (Who Supplied the Products?)

When physical goods arrive at a branch:
1. Staff or Branch Manager records the intake:
   * **Branch**: Automatically scoped to the receiving branch (`facilityID`).
   * **Store**: Specific sub-store (e.g. "RUMFA" or "LAYIN KWARI").
   * **Supplier / Dealer**: Supplier Name, contact, and reference invoice number.
   * **Product**: Selected from existing catalog or registered as a new item.
   * **Unit Type**: Belt or Yard. If Belt, specifies `yards_per_belt` (e.g. 100 yards).
   * **Quantity**: Number of belts/yards received.
   * **Unit Cost (Buying Price)**: ₦ Cost price per unit.
   * **Total Cost & Payment Details**: Amount paid to supplier immediately vs balance owed.
2. **Atomic Database Execution**:
   * An entry is created in `purchase_history` (and normalized `stock_receipts`).
   * A movement entry is logged in `stock_movements` (`movement_type = 'STOCK_IN_SUPPLIER'`).
   * The `stocks.quantity` is incremented.
   * A printable **Stock Receipt** is generated for the supplier/dealer.

### 3.2 Sale & Stock Deduction (Fixing the Cart Bug)

1. **Adding to Cart**:
   * Items added to the cashier's active cart **do not** decrement `stocks.quantity`.
   * The cart only checks available stock: `SELECT quantity FROM stocks WHERE id = ?`.
2. **Checkout Execution (Inside an ACID Transaction)**:
   ```javascript
   // Atomic checkout transaction
   await connection.beginTransaction();
   try {
     for (const item of cartItems) {
       // Lock row for update to prevent race conditions
       const [stock] = await connection.query(
         'SELECT id, quantity FROM stocks WHERE id = ? AND facilityID = ? FOR UPDATE',
         [item.stockId, branchId]
       );
       
       if (stock[0].quantity < item.quantity) {
         throw new Error(`Insufficient stock for product ${item.name}`);
       }
       
       // Deduct inventory atomically
       await connection.query(
         'UPDATE stocks SET quantity = quantity - ?, out_stocks = out_stocks + ? WHERE id = ?',
         [item.quantity, item.quantity, item.stockId]
       );
       
       // Record in movement ledger
       await connection.query(
         `INSERT INTO stock_movements 
          (facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, performed_by) 
          VALUES (?, ?, ?, 'STOCK_OUT_SALE', ?, ?, ?, 'orders', ?, ?)`,
         [branchId, item.storeId, item.stockId, -item.quantity, stock[0].quantity, stock[0].quantity - item.quantity, orderId, userId]
       );
     }
     
     // Record order in orders table
     // Clear user cart
     await connection.commit();
   } catch (err) {
     await connection.rollback();
     throw err;
   }
   ```

### 3.3 Stock Adjustments & Damaged Goods
* Staff can record stock loss, damaged fabric bolts, or physical stocktake reconciliations.
* Requires mandatory reason notes.
* Quantities are updated and logged with type `STOCK_DAMAGE` or `STOCK_ADJUSTMENT`.
* Logged in `audit_logs` for Admin review.

### 3.4 Fabric Measurement Conversions (Belts $\leftrightarrow$ Yards)
Textiles are often purchased as wholesale **Belts** (e.g. 1 Belt = 100 Yards) and sold either as complete Belts or cut into individual **Yards**:
* When a belt is opened for retail cutting:
  * 1 Belt is deducted from the Belt stock record.
  * 100 Yards are credited to the associated Yard stock record (`parent_stock_id`).
  * Recorded in `stock_conversions` and audited in `stock_movements`.
