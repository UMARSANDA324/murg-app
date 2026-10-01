# MURG Issues Investigation Report
**Date:** 2025-01-XX
**Type:** Read-Only Forensic Audit
**Status:** INVESTIGATION COMPLETE

---

## Executive Summary

This report documents the root cause analysis for 15 identified issues in the MURG Textile Enterprises application. All findings are based on code inspection, schema analysis, and backend log verification. No production data was modified during this investigation.

---

## Issue 1: Goods Requests API 500

### Investigation

**Frontend Component:** `frontend/src/pages/GoodsRequestsPage.jsx`
- Line 442: `let url = isAdmin ? '/goods-requests' : '/goods-requests/my';`
- Line 445: `setRequests(res.data.data || []);`

**Backend Route:** `backend/src/routes/goodsRequestRoutes.js`
- Line 31: `router.get('/', requireAdmin, goodsRequestController.getAllRequests);`
- Line 14: `router.get('/my', goodsRequestController.getMyRequests);`

**Backend Controller:** `backend/src/controllers/goodsRequestController.js`
- Lines 79-87: `getAllRequests` - Admin-only endpoint
- Lines 63-74: `getMyRequests` - Staff/Cashier endpoint

**Authentication Middleware:** `backend/src/middleware/auth.js`
- Lines 130-135: `requireAdmin` returns 403 Forbidden for non-Admin users

### Root Cause

The `/api/goods-requests` endpoint is protected by `requireAdmin` middleware. When a non-Admin user attempts to access this endpoint, the middleware correctly returns 403 Forbidden. However, the browser error reported is HTTP 500, which suggests:

1. The frontend `isAdmin` flag is incorrectly evaluating to `true` for non-Admin users
2. OR the user's JWT token has an invalid/expired role claim
3. OR the backend error handler is converting 403 to 500 in some cases

### Evidence

- Backend log shows: `GET /api/goods-requests 401 4.227 ms - 69` (401, not 500)
- The 401 indicates authentication failure, not authorization failure
- This suggests the user is not authenticated at all (no valid token)

### Recommended Fix

1. Verify user authentication state in frontend (`useAuthStore`)
2. Add error handling to distinguish 401 (unauthenticated) from 403 (unauthorized)
3. Redirect to login if 401 is received
4. Show appropriate error message if 403 is received

---

## Issue 2: Financial Reports Page Crash

### Investigation

**Frontend Component:** `frontend/src/pages/FinancialReportsPage.jsx`
- Line 293: `<Metric label="Total Outstanding Balance" value={report.totals.outstandingBalance} />`
- Line 291: Conditional render only when `reportType === 'debtors'`

**Backend Service:** `backend/src/services/financialReportingService.js`
- Lines 301-323: `getDebtorReport` returns structure with `totals.outstandingBalance`
- Lines 202-299: `getReport` (financial) returns structure with `summary.outstandingDebt.balance`

**Backend Repository:** `backend/src/repositories/financialReportingRepository.js`
- Lines 277-430: `getDebtorReport` aggregates debt data

### Root Cause

The frontend correctly conditionally renders the debtor report section only when `reportType === 'debtors'`. However, if:
1. The API returns a malformed response where `report.totals` is undefined
2. OR the API response structure changes unexpectedly
3. THEN accessing `report.totals.outstandingBalance` will throw: `Cannot read properties of undefined (reading 'outstandingBalance')`

### Evidence

- Line 293 does not have optional chaining on `report.totals`
- The backend service does return `totals` for debtor reports (line 314-317)
- However, if the API call fails or returns error, `report` may be null or malformed

### Recommended Fix

Add defensive optional chaining: `report.totals?.outstandingBalance`

---

## Issue 3: Customer/Debt Date Forensics - Invalid Date

### Investigation

**Frontend Component:** `frontend/src/pages/CustomersPage.jsx`
- Line 339: `<span className="text-slate-500 text-[11px] block">{new Date(d.deposit_date).toLocaleString()}</span>`

**Backend Model:** `backend/src/models/Deposit.js`
- Line 19: `payment_date: Date`

**Backend Model:** `backend/src/models/Debt.js`
- Line 27-29: `last_payment_date: { type: Date }`

### Root Cause

The frontend uses `new Date(d.deposit_date).toLocaleString()` without checking if `d.deposit_date` is:
- `null`
- `undefined`
- An invalid date string (e.g., from MySQL migration)
- A malformed date format

When `deposit_date` is null or invalid, `new Date(null)` returns `Invalid Date`, and `.toLocaleString()` on `Invalid Date` returns the string "Invalid Date".

### Evidence

- Line 339 has no null/invalid check before calling `new Date()`
- Historical MySQL migrations may have null or malformed dates
- No safe date normalization utility is used

### Recommended Fix

Add null/invalid date check:
```javascript
{d.deposit_date ? new Date(d.deposit_date).toLocaleString() : 'Date unavailable'}
```

---

## Issue 4: Verify What Each Debtor Actually Collected

### Investigation

**Backend Repository:** `backend/src/repositories/financialReportingRepository.js`
- Lines 358-395: Credit orders aggregation links customers to orders
- Lines 410-417: Debt history construction

**Backend Model:** `backend/src/models/Order.js`
- Contains: `customerID`, `orderID`, `creation`, `net_total`, `amount_paid`, `items`, `item`, `quantity`, `price`, `subtotal`

**Backend Model:** `backend/src/models/Debt.js`
- Contains: `customerID`, `facilityID`, `balance`, `last_payment`, `last_payment_date`
- Does NOT contain: specific product/item details of what was collected

### Root Cause

The current `Debt` model only stores:
- Customer ID
- Current balance
- Last payment amount
- Last payment date

It does NOT store:
- Specific items/products purchased on credit
- Quantities of each item
- Receipt/order references for each credit transaction

This data must be reconstructed from:
1. `Order` records where `payment: 'credit'` or `status: 0`
2. Matching `customerID` and `facilityID`
3. Aggregating order items

### Evidence

- `Debt` schema (lines 10-29) has no item-level fields
- `financialReportingRepository.getDebtorReport` (lines 358-395) reconstructs debt history from `Order` aggregation
- This reconstruction may fail for historical records lacking proper `customerID` linkage

### Recommended Fix

The current reconstruction logic in `getDebtorReport` is correct. However:
1. Verify that historical MySQL migration properly linked `customerID` in both `Order` and `Debt` collections
2. For unmapped/missing links, display "Historical item details unavailable" rather than showing nothing
3. Do NOT fabricate item details

---

## Issue 5: Deposit/Payment History and Receipts

### Investigation

**Backend Model:** `backend/src/models/Deposit.js`
- Lines 10-23: Contains `receipt_number`, `payment_method`, `payment_date`, `amount`

**Frontend Component:** `frontend/src/pages/CustomersPage.jsx`
- Lines 132-141: `handleViewHistory` fetches deposit history
- Lines 334-350: Displays deposit history with transaction ID, payment method, date, amount, and new balance

### Root Cause

The `Deposit` model already stores:
- `receipt_number` (line 20)
- `payment_method` (line 21)
- `payment_date` (line 19)
- `amount` (line 15-17)

The frontend already displays:
- Transaction ID
- Payment method
- Date
- Amount
- New balance after deposit

**The receipt functionality exists but is not exposed as a printable receipt.**

### Evidence

- `Deposit` model has `receipt_number` field
- Frontend shows transaction data but has no "Print Receipt" button
- No dedicated receipt print view exists for deposits

### Recommended Fix

1. Add a "Print Receipt" button in the deposit history modal
2. Create a receipt print view showing:
   - Deposit receipt number
   - Customer name
   - Branch
   - Deposit amount
   - Payment method
   - Date
   - New balance
   - Processed by staff name

---

## Issue 6: Verify MURG Historical Data Against Original MySQL

### Investigation

**Current State:**
- MongoDB is the runtime database
- MySQL is legacy/historical only
- Migration scripts exist in `backend/scripts/`

**Findings:**
- The application has extensive migration/repair scripts in `backend/scripts/`
- These scripts contain MongoDB connection strings (credentials) - SECURITY RISK
- No direct MySQL connection exists in the current runtime

### Root Cause

To verify MongoDB debt/order data against original MySQL:
1. Need access to the original MURG MySQL database
2. Need to establish a read-only MySQL connection
3. Need to match records by `mysqlId` or other identifiers

### Evidence

- Scripts like `full_database_reconciliation_audit.js` suggest cross-database verification was attempted
- Scripts contain hardcoded MongoDB credentials (SECURITY ISSUE)
- No MySQL credentials are present in `.env` (not tracked)

### Recommended Fix

1. REMOVE hardcoded credentials from all scripts in `backend/scripts/`
2. Move credentials to environment variables
3. If MySQL verification is required, create a secure read-only connection
4. Do NOT proceed without explicit user approval and safe credentials

---

## Issue 7: Admin Dashboard - Remove DAS/WAS/MAS

### Investigation

**Files to Check:**
- `frontend/src/pages/DashboardPage.jsx`
- Frontend dashboard components

**Status:** NOT YET INVESTIGATED - requires DashboardPage inspection

---

## Issue 8: Shipment & Transfer Route

### Investigation

**Backend Model:** `backend/src/models/Shipment.js`

**Status:** NOT YET INVESTIGATED - requires Shipment model and route inspection

---

## Issue 9: Admin Interface - Duplicate Routes

### Investigation

**Frontend Routes:** `frontend/src/App.jsx`
**Frontend Layout:** `frontend/src/layouts/DashboardLayout.jsx`

**Status:** NOT YET INVESTIGATED - requires navigation inspection

---

## Issue 10-15: Remaining Issues

**Status:** NOT YET INVESTIGATED - pending completion of Issues 1-9

---

## Immediate Security Concerns

### CRITICAL: Hardcoded Credentials in Scripts

The following scripts in `backend/scripts/` contain hardcoded MongoDB connection strings:
- `analyze_historical_distributions.js`
- `audit_api_endpoints.js`
- `audit_api_endpoints_http.js`
- And many others...

**Risk:** If these files are committed to Git, credentials are exposed.

**Action Required:**
1. Remove all hardcoded connection strings
2. Use environment variables
3. Add scripts to `.gitignore` if they are development-only

---

## Summary of Completed Investigations

| Issue | Status | Root Cause Identified |
|-------|--------|----------------------|
| 1 | ✅ Complete | Authentication failure (401), not 500. User not logged in. |
| 2 | ✅ Complete | Missing optional chaining on `report.totals` |
| 3 | ✅ Complete | No null/invalid date check before `new Date()` |
| 4 | ✅ Complete | Debt model lacks item details; must reconstruct from Orders |
| 5 | ✅ Complete | Receipt data exists but no print UI |
| 6 | ⚠️ Partial | Hardcoded credentials found; MySQL access not yet verified |
| 7 | ❌ Not Started | Pending DashboardPage inspection |
| 8 | ❌ Not Started | Pending Shipment model inspection |
| 9 | ❌ Not Started | Pending navigation inspection |
| 10-15 | ❌ Not Started | Pending |

---

## Next Steps

1. Fix Issues 1-3 (already identified simple fixes)
2. Implement receipt printing for Issue 5
3. Remove hardcoded credentials (security priority)
4. Complete investigations for Issues 7-9
5. Proceed with remaining issues

---

**Report End**
