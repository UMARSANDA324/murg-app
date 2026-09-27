# PHP Migration Inventory

**Generated:** 2026-09-27
**Purpose:** Complete audit of remaining PHP modules before Node.js migration completion

## Executive Summary

Based on the current codebase audit, the following PHP modules remain active:

- **Total PHP business pages:** ~88 files across `front/`, `sub/`, `system/`
- **Already decommissioned:** `front/cart.php` (redirects to React POS)
- **Critical active modules:** Expenses, Returns, Profile/Password, some reporting
- **Shared dependencies:** `gyada.php` (DB connection), PHPMailer library

## Active PHP Modules by Directory

### front/ (Staff/Cashier) - 16 files

| File | Purpose | React Equivalent | Migration Status |
|------|---------|------------------|------------------|
| `cart.php` | POS cart - **DECOMMISSIONED** | React POS /pos | ✅ Complete (redirect) |
| `credit.php` | Credit sales cart | React POS credit flow | ⚠️ Active - verify usage |
| `deposit.php` | Customer deposit recording | React deposits API | ⚠️ Active - verify usage |
| `deposit-receipt.php` | Deposit receipt generation | React deposit receipts | ⚠️ Active - verify usage |
| `expense.php` | Expense tracking | None | ❌ NOT MIGRATED |
| `return.php` | Order returns | None | ❌ NOT MIGRATED |
| `profile.php` | Staff profile/password change | React profile page | ⚠️ Active - verify usage |
| `invoice.php` | Receipt/invoice generation | React receipts | ⚠️ Active - verify usage |
| `verify.php` | Verification pages | React verification | ⚠️ Active - verify usage |
| `out.php` | Logout | React logout | ⚠️ Active - verify usage |
| `get_price.php` | AJAX price lookup | React stock API | ⚠️ Active - verify usage |
| `get_qty.php` | AJAX quantity lookup | React stock API | ⚠️ Active - verify usage |
| `get_queue.php` | AJAX queue lookup | React API | ⚠️ Active - verify usage |
| `header.php` | Layout header | React layouts | ⚠️ Shared asset |
| `sidebar.php` | Layout sidebar | React layouts | ⚠️ Shared asset |
| `index.php` | Staff dashboard | React dashboard | ⚠️ Active - verify usage |

### sub/ (Branch Manager) - 45 files

| File | Purpose | React Equivalent | Migration Status |
|------|---------|------------------|------------------|
| `expense.php` | Expense tracking | None | ❌ NOT MIGRATED |
| `purchase.php` | Supplier purchases | React supplier stock intake | ⚠️ Active - verify completeness |
| `stocks.php` | Stock management | React Stock page | ⚠️ Active - verify usage |
| `sales.php` | Sales viewing | React sales history | ⚠️ Active - verify usage |
| `credit.php` | Credit sales viewing | React debts page | ⚠️ Active - verify usage |
| `deposit.php` | Deposits viewing | React deposits | ⚠️ Active - verify usage |
| `customer.php` | Customer list | React customers page | ⚠️ Active - verify usage |
| `edit-customer.php` | Customer edit | React customer edit | ⚠️ Active - verify usage |
| `view-customer.php` | Customer details | React customer details | ⚠️ Active - verify usage |
| `staff.php` | Staff list | React staff page | ⚠️ Active - verify usage |
| `edit-staff.php` | Staff edit | React staff edit | ⚠️ Active - verify usage |
| `edit-stock.php` | Stock edit | React stock edit | ⚠️ Active - verify usage |
| `return.php` | Returns | None | ❌ NOT MIGRATED |
| `cart.php` | Cart | React POS | ⚠️ Active - verify usage |
| `order.php` | Order management | React sales | ⚠️ Active - verify usage |
| `monthly.php` | Monthly report | React analytics | ⚠️ Active - verify usage |
| `weekly.php` | Weekly report | React analytics | ⚠️ Active - verify usage |
| `month_purchase.php` | Monthly purchase report | React analytics | ⚠️ Active - verify usage |
| `total_purchase.php` | Total purchase report | React analytics | ⚠️ Active - verify usage |
| `view-purchase.php` | Purchase details | React supplier details | ⚠️ Active - verify usage |
| `view-sales.php` | Sales details | React sales details | ⚠️ Active - verify usage |
| `online.php` | Online status | React dashboard | ⚠️ Active - verify usage |
| `finished.php` | Finished orders | React sales history | ⚠️ Active - verify usage |
| `out.php` | Logout | React logout | ⚠️ Active - verify usage |
| `profile.php` | Profile/password | React profile | ⚠️ Active - verify usage |
| `invoice.php` | Invoice generation | React receipts | ⚠️ Active - verify usage |
| `verify.php` | Verification | React verification | ⚠️ Active - verify usage |
| `get_price.php` | AJAX price lookup | React API | ⚠️ Active - verify usage |
| `header.php` | Layout header | React layouts | ⚠️ Shared asset |
| `sidebar.php` | Layout sidebar | React layouts | ⚠️ Shared asset |
| `index.php` | Manager dashboard | React dashboard | ⚠️ Active - verify usage |
| `sync_helper.php` | Sync helper | N/A | ⚠️ Utility |

### system/ (Global Admin) - 53 files

| File | Purpose | React Equivalent | Migration Status |
|------|---------|------------------|------------------|
| `expense.php` | Expense tracking | None | ❌ NOT MIGRATED |
| `purchase.php` | Supplier purchase management | React supplier intake | ⚠️ Active - verify completeness |
| `stocks.php` | Stock management | React Stock page | ⚠️ Active - verify usage |
| `staff.php` | Staff management | React staff page | ⚠️ Active - verify usage |
| `branch.php` | Branch management | React branches page | ⚠️ Active - verify usage |
| `customer.php` | Customer management | React customers page | ⚠️ Active - verify usage |
| `edit-customer.php` | Customer edit | React customer edit | ⚠️ Active - verify usage |
| `edit-deposit.php` | Deposit edit | React deposit edit | ⚠️ Active - verify usage |
| `edit-order-item.php` | Order item edit | React sales edit | ⚠️ Active - verify usage |
| `edit-purchase.php` | Purchase edit | React purchase edit | ⚠️ Active - verify usage |
| `edit-staff.php` | Staff edit | React staff edit | ⚠️ Active - verify usage |
| `edit-stock.php` | Stock edit | React stock edit | ⚠️ Active - verify usage |
| `store.php` | Store management | React store management | ⚠️ Active - verify usage |
| `track-stock.php` | Stock tracking | React stock movements | ⚠️ Active - verify usage |
| `credit.php` | Credit sales | React debts | ⚠️ Active - verify usage |
| `deposit.php` | Deposits | React deposits | ⚠️ Active - verify usage |
| `deposit-receipt.php` | Deposit receipts | React deposit receipts | ⚠️ Active - verify usage |
| `purchase-deposit.php` | Purchase deposits | React supplier payments | ⚠️ Active - verify usage |
| `sales.php` | Sales | React sales | ⚠️ Active - verify usage |
| `return.php` | Returns | None | ❌ NOT MIGRATED |
| `cart.php` | Cart | React POS | ⚠️ Active - verify usage |
| `order.php` | Orders | React sales | ⚠️ Active - verify usage |
| `monthly.php` | Monthly report | React analytics | ⚠️ Active - verify usage |
| `weekly.php` | Weekly report | React analytics | ⚠️ Active - verify usage |
| `month_purchase.php` | Monthly purchase report | React analytics | ⚠️ Active - verify usage |
| `total_purchase.php` | Total purchase report | React analytics | ⚠️ Active - verify usage |
| `view-customer.php` | Customer details | React customer details | ⚠️ Active - verify usage |
| `view-purchase.php` | Purchase details | React purchase details | ⚠️ Active - verify usage |
| `view-purchase-details.php` | Purchase detail view | React purchase details | ⚠️ Active - verify usage |
| `view-sales.php` | Sales details | React sales details | ⚠️ Active - verify usage |
| `sales_report.php` | Sales report | React analytics | ⚠️ Active - verify usage |
| `report.php` | General reports | React analytics | ⚠️ Active - verify usage |
| `online.php` | Online status | React dashboard | ⚠️ Active - verify usage |
| `finished.php` | Finished orders | React sales history | ⚠️ Active - verify usage |
| `out.php` | Logout | React logout | ⚠️ Active - verify usage |
| `profile.php` | Profile/password | React profile | ⚠️ Active - verify usage |
| `invoice.php` | Invoice generation | React receipts | ⚠️ Active - verify usage |
| `verify.php` | Verification | React verification | ⚠️ Active - verify usage |
| `get_price.php` | AJAX price lookup | React API | ⚠️ Active - verify usage |
| `get_qty.php` | AJAX quantity lookup | React API | ⚠️ Active - verify usage |
| `get_stock_stores.php` | AJAX store lookup | React API | ⚠️ Active - verify usage |
| `get_stores.php` | AJAX stores lookup | React API | ⚠️ Active - verify usage |
| `manage_purchases_api.php` | Purchase API | React supplier API | ⚠️ Active - verify usage |
| `list_tables.php` | Table listing | N/A | ⚠️ Utility |
| `header.php` | Layout header | React layouts | ⚠️ Shared asset |
| `sidebar.php` | Layout sidebar | React layouts | ⚠️ Shared asset |
| `index.php` | Admin dashboard | React dashboard | ⚠️ Active - verify usage |
| `sync_helper.php` | Sync helper | N/A | ⚠️ Utility |

### Root-level PHP files

| File | Purpose | React Equivalent | Migration Status |
|------|---------|------------------|------------------|
| `index.php` | Login page | React login /login | ⚠️ Active - verify usage |
| `dologin.php` | Login handler | React login API | ⚠️ Active - verify usage |
| `logout.php` | Logout handler | React logout | ⚠️ Active - verify usage |
| `invoice.php` | Invoice generation | React receipts | ⚠️ Active - verify usage |
| `auth_bridge.php` | Auth bridge (Node→PHP) | N/A | ✅ Required for coexistence |
| `migrate_credit.php` | Credit migration script | N/A | ⚠️ Utility |

### Shared Assets

| File/Directory | Purpose | Migration Status |
|----------------|---------|------------------|
| `assets/mashaAllah/gyada.php` | Database connection | ❌ REQUIRED by PHP |
| `assets/mashaAllah/kwakwa.php` | Helper functions | ❌ REQUIRED by PHP |
| `assets/css/` | Stylesheets | ⚠️ Shared by PHP |
| `assets/js/` | JavaScript | ⚠️ Shared by PHP |
| `assets/img/` | Images | ⚠️ Shared by PHP |
| `assets/plugins/` | DataTables, etc. | ⚠️ Shared by PHP |
| `bootstrap/` | Bootstrap framework | ⚠️ Shared by PHP |
| `front/PHPMailer/` | Email library | ❌ REQUIRED by PHP |
| `sub/PHPMailer/` | Email library | ❌ REQUIRED by PHP |

## Critical Migration Priority

### HIGH PRIORITY - No React Equivalent

1. **Expense Tracking** (`expense.php` in all directories)
   - Purpose: Track branch expenses by type and amount
   - Database: `expense` table
   - Business Logic: CRUD operations on expense records
   - Authorization: Branch-scoped
   - **MIGRATION REQUIRED**

2. **Order Returns** (`return.php` in all directories)
   - Purpose: Return items from completed orders, restore stock
   - Database: `orders`, `cart`, `stocks`, `outstand`
   - Business Logic: Reverse sales, restore inventory, adjust debt
   - Authorization: Branch-scoped
   - **MIGRATION REQUIRED**

### MEDIUM PRIORITY - React Exists But Verify Completeness

3. **Supplier Purchases** (`purchase.php`)
   - Purpose: Record supplier stock intake
   - Database: `purchase_history`
   - React Equivalent: Stock receiving page
   - **VERIFY COMPLETENESS**

4. **Profile/Password Change** (`profile.php`)
   - Purpose: Staff password change
   - Database: `facility` table
   - React Equivalent: React profile page
   - **VERIFY COMPLETENESS**

5. **Reporting Pages** (monthly, weekly, sales_report, etc.)
   - Purpose: Various business reports
   - React Equivalent: DAS/WAS/MAS analytics
   - **VERIFY COMPLETENESS**

### LOW PRIORITY - Shared Assets/Utilities

6. **Layout files** (header.php, sidebar.php)
   - Purpose: PHP page layout
   - React Equivalent: React layouts
   - Can be removed after PHP pages are removed

7. **Helper APIs** (get_price.php, get_qty.php, etc.)
   - Purpose: AJAX endpoints
   - React Equivalent: React API calls
   - Can be removed after verification

## Database Tables Used by PHP

| Table | PHP Usage | React Usage | Migration Impact |
|-------|-----------|-------------|------------------|
| `expense` | Active | None | ❌ NEW TABLE REQUIRED |
| `purchase_history` | Active | Partial | ⚠️ VERIFY |
| `cart` | Active | React POS uses different cart | ⚠️ VERIFY |
| `debt_cart` | Active | React POS uses different cart | ⚠️ VERIFY |
| `conca` | Active | None | ⚠️ VERIFY PURPOSE |
| `facility` | Active | Active | ✅ Shared |
| `branch` | Active | Active | ✅ Shared |
| `stocks` | Active | Active | ✅ Shared |
| `orders` | Active | Active | ✅ Shared |
| `customers` | Active | Active | ✅ Shared |
| `outstand` | Active | Active | ✅ Shared |
| `deposit_history` | Active | Active | ✅ Shared |
| `stores` | Active | Active | ✅ Shared |

## Migration Strategy

### Phase 1: Critical Business Logic (No React Equivalent)

1. **Expense Tracking**
   - Create `backend/src/repositories/expenseRepository.js`
   - Create `backend/src/controllers/expenseController.js`
   - Create `backend/src/routes/expenseRoutes.js`
   - Create React expense management page
   - Test against existing expense data
   - Remove PHP expense.php files

2. **Order Returns**
   - Create return logic in sales repository
   - Create return API endpoint
   - Create React return interface
   - Test return flow with real orders
   - Remove PHP return.php files

### Phase 2: Verify and Complete React Equivalents

3. **Supplier Purchases**
   - Verify React stock receiving handles all purchase_history fields
   - Add missing fields if needed
   - Test against existing purchase_history data
   - Remove PHP purchase.php if complete

4. **Profile/Password**
   - Verify React profile page handles password change
   - Test bcrypt upgrade flow
   - Remove PHP profile.php if complete

5. **Reporting**
   - Verify DAS/WAS/MAS covers all PHP report needs
   - Add missing reports if needed
   - Remove PHP report pages if complete

### Phase 3: Cleanup

6. **Remove shared assets** after all PHP pages are removed
7. **Remove PHPMailer** if email is handled by Node.js emailService
8. **Remove gyada.php** only after all PHP is removed
9. **Update auth_bridge** if any allowlisted destinations are removed

## Safety Notes

- **DO NOT** delete `gyada.php` while any PHP page remains active
- **DO NOT** delete PHPMailer while PHP pages send emails
- **DO NOT** modify `expense` table data without migration
- **DO NOT** delete `purchase_history` records without migration
- **DO NOT** remove `auth_bridge.php` until ALL PHP is removed
- **VERIFY** that the React application handles ALL business cases before removing PHP

## Next Steps

1. Confirm which PHP pages are still actively used by users
2. Prioritize high-priority modules (expenses, returns)
3. Create migration branches for each module
4. Test migrations with production-like data
5. Update this inventory as migration progresses
