# Multi-Branch System & Data Isolation Architecture

## 1. Context & Business Requirements

MURG Textile Enterprises has traditionally operated as a single-location, dealer-based textile distribution house. To scale operations across multiple physical retail branches in Kano and neighboring markets, the platform must support a **Multi-Branch Architecture** with **strict data isolation**.

---

## 2. Branch Hierarchy

```
                                GLOBAL ADMIN
                               (Universal View)
                                      |
         +----------------------------+----------------------------+
         |                                                         |
     BRANCH A (MURG/001)                                      BRANCH B (MURG/002)
  ├── Branch Manager                                       ├── Branch Manager
  ├── Sales Staff / Cashier                                ├── Sales Staff / Cashier
  └── Stock Staff                                          └── Stock Staff
      |                                                         |
      ├── Stores (Rumfa, Layin Kwari)                           ├── Stores (Main, Annex)
      ├── Branch Stock & Movements                              ├── Branch Stock & Movements
      ├── Branch Sales & Receipts                               ├── Branch Sales & Receipts
      ├── Branch Debt Ledger                                    ├── Branch Debt Ledger
      └── Branch Supplier Receipts                              └── Branch Supplier Receipts
```

---

## 3. Legacy Branch Mechanism

In the legacy PHP application:
* The `branch` table stored basic metadata: `id`, `facilityID`, `name`, `address`.
* Sequential IDs like `MURG/001` were tracked via the `conca` table (`conca.lastID`).
* Users were linked via `facility.facilityID`.
* An incomplete branch switcher existed in `assets/mashaAllah/gyada.php` via `?switch_branch=MURG/001` setting `$_SESSION['facilityID']`.
* However, branch isolation was inconsistent:
  - Several tables (e.g. `deposit_history`, older `purchase_history`) lacked `facilityID`.
  - Several SQL queries lacked `WHERE facilityID = '$facilityID'`, leaking records across branches if multiple branches were created.

---

## 4. Strict Backend Data Isolation

### 4.1 Principle of Isolation
Under no circumstances may a user assigned to **Branch A** access or view records belonging to **Branch B**. This applies to:
* Sales and orders
* Customer receipts
* Stock inventory and store balances
* Debt ledgers and deposits
* Historical transactions
* Supplier receiving history
* Inter-branch shipments

The global **Admin** is the only role with universal cross-branch visibility.

### 4.2 Eliminating Parameter Tampering

Client-side filtering or trusting query parameters (e.g., `?branchId=MURG/002`) is strictly prohibited.

The backend Node.js repository queries enforce branch scoping directly in SQL:

```javascript
// Example: Safe Branch Scoping Repository Pattern
class SalesRepository {
  async getBranchSales(branchId, filters = {}) {
    // Parameterized query strictly constrained to the authenticated branchId
    const sql = `
      SELECT o.*, s.store_name 
      FROM orders o
      LEFT JOIN stocks st ON o.stockID = st.id
      LEFT JOIN stores s ON st.store_id = s.id
      WHERE o.facilityID = ?
      ORDER BY o.creation DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await db.query(sql, [branchId, filters.limit || 50, filters.offset || 0]);
    return rows;
  }
}
```

If a malicious user belonging to Branch A passes `GET /api/branches/MURG/002/sales`, the `requireBranchScope` middleware compares `req.user.facilityID` (`MURG/001`) with the route parameter (`MURG/002`), rejects the request with `403 Forbidden`, and logs a security event to `audit_logs`.

---

## 5. Branch Management (Global Admin Capabilities)

The Global Administrator has full administrative control over physical branches:

1. **Create Branch**:
   - Automatically generates the next branch code (e.g. `MURG/003`) by atomically incrementing `conca.lastID`.
   - Records branch display name, physical address, and contact phone number.
   - Status defaults to `active`.
2. **Edit Branch**:
   - Update branch title, address, phone number.
3. **Activate / Deactivate Branch**:
   - Setting a branch to `inactive` immediately prevents branch staff from logging in or executing POS transactions, while preserving all historical records.
4. **Staff Allocation & Role Management**:
   - Add new staff and associate them with the branch.
   - Reassign staff from one branch to another (audited in `audit_logs`).
   - Assign roles: Branch Manager (`Sub-admin`), Cashier (`Staff`), or Stock Staff.
   - Suspend or revoke staff access.
5. **Store / Sub-Location Management**:
   - Create sub-locations (e.g., "Main Store", "Display Rack", "Warehouse") attached to the branch.

---

## 6. Branch Dashboard

When an Admin selects a specific branch (or when a Branch Manager logs in), the **Branch Dashboard** displays an isolated operational command center:

```
+-------------------------------------------------------------------------------+
| Branch: Alh Yasir (MURG/001)                      Status: ACTIVE [Switch Branch]|
+-------------------------------------------------------------------------------+
|  Today's Sales     |  Active Stock Value  |  Outstanding Debts  | In-Transit  |
|  ₦ 4,850,000       |  ₦ 62,300,000        |  ₦ 15,084,130       | 2 Shipments |
+-------------------------------------------------------------------------------+
| Operations Navigation:                                                        |
| [ POS Terminal ]  [ Credit Sales ]  [ Receive Stock ]  [ Shipments ]          |
+-------------------------------------------------------------------------------+
| Quick Metrics:                                                                |
| - Recent Sales (Today: 42 transactions)                                       |
| - Low Stock Alerts (5 products below minimum threshold)                      |
| - Debt Collections (₦ 750,000 received today)                                 |
| - Stock Received (100 Belts from ABC Dealer today)                            |
| - Staff on Duty (3 active cashiers)                                           |
+-------------------------------------------------------------------------------+
```

All summary cards, charts, and activity feeds are computed dynamically using the branch scope.
