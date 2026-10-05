# MURG Stock Tracking Feature — Implementation Reference

**Date implemented:** October 2026  
**Status:** Production-ready  
**Branch:** `murg-final`

---

## 1. Feature Purpose

The Stock Tracking feature allows administrators to view the **complete lifecycle history** of any stock item — from when it was first received through every sale, transfer, return, and adjustment — alongside a complete buyer audit showing every customer who purchased the item.

This answers two key business questions:

1. **Where did this stock go?** — the full transaction ledger with quantities, dates, customers, staff, and running balances.
2. **Who bought this item?** — a ranked list of customers by total quantity purchased.

---

## 2. UI Entry Point

**Stock → Inventory Table → Track button (green, per row)**

Each row in the inventory table now includes a green **Track** button (with BarChart2 icon) alongside the existing Price button. Clicking it opens the Stock Tracking Modal for that item.

The modal is embedded in `StockPage.jsx` and does not require a separate route.

---

## 3. API Endpoint

```
GET /api/stocks/:id/tracking
```

**Authentication:** Required (JWT via `authenticate` middleware + branch scope via `requireBranchScope`)

**Authorization:** All authenticated staff can access history. Cost/buying price fields are only included for `isGlobalAdmin` or `role === 'Admin'` callers.

**Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `branchId` | string | (required) | Facility ID for branch scoping |
| `startDate` | string (ISO) | null | Filter events from this date |
| `endDate` | string (ISO) | null | Filter events to this date |
| `eventType` | string | `'all'` | Filter by event type (Received, Sold, Returned, etc.) |
| `customer` | string | null | Filter by customer name (case-insensitive substring) |
| `staff` | string | null | Filter by staff name (case-insensitive substring) |
| `limit` | integer | 100 (max 500) | Page size |
| `offset` | integer | 0 | Pagination offset |

**Response shape:**

```json
{
  "success": true,
  "data": {
    "stock": {
      "id": "...",
      "name": "GORILLA 150y Nivora",
      "code": "STK-0249",
      "unit_type": "belt",
      "current_quantity": 3,
      "facilityID": "MURG/001",
      "store": { "name": "Main Warehouse" }
    },
    "summary": {
      "total_received": 118,
      "total_sold": 115,
      "total_returned": 0,
      "total_transferred_out": 0,
      "total_transferred_in": 0,
      "current_balance": 3,
      "calculated_balance": 3,
      "is_balance_exact": true,
      "transaction_count": 34,
      "filtered_count": 34,
      "unique_buyers_count": 23
    },
    "events": [ /* array of event objects */ ],
    "buyers": [ /* array of buyer summary objects */ ],
    "pagination": {
      "offset": 0,
      "limit": 100,
      "total": 34,
      "hasMore": false
    }
  }
}
```

**Event object fields:**

| Field | Description |
|---|---|
| `id` | Unique event identifier (source:recordId) |
| `date` | ISO timestamp of the event |
| `event_type` | `Received`, `Sold`, `Returned`, `Transferred Out`, `Transferred In`, `Adjustment` |
| `direction` | `IN` or `OUT` |
| `quantity` | Absolute quantity (positive number) |
| `unit` | Unit type (belt, yard, etc.) |
| `customer_name` | Name of buyer/customer (or `null`) |
| `supplier_name` | Name of supplier for received stock (or `null`) |
| `staff_name` | Name of staff who processed the transaction |
| `reference_id` | Order reference ID, purchase reference, etc. |
| `payment_method` | Payment type (Cash, Credit, Split, etc.) |
| `balance` | Running stock balance after this event |
| `branch` | Facility ID |
| `store` | Store name |

**Buyer object fields:**

| Field | Description |
|---|---|
| `customer_name` | Customer name (or "Customer information unavailable") |
| `total_quantity` | Total quantity purchased |
| `orders_count` | Number of individual orders |
| `total_spent` | Total revenue from this customer (Admin only if `includeCost` enabled) |
| `payment_methods` | Array of distinct payment methods used |
| `first_purchase_date` | ISO timestamp of first purchase |
| `last_purchase_date` | ISO timestamp of most recent purchase |

---

## 4. MongoDB Collections Used

All queries are **read-only**. No writes are performed by this feature.

| Collection | Usage |
|---|---|
| `stocks` | Resolve stock item by ObjectId, mysqlId, or name |
| `orders` | Historical and current sales/issues (one document per line item) |
| `purchases` | Stock receiving/intake events |
| `stockmovements` | Modern app stock movements (since ~Sept 23, 2026) |
| `returns` | Return events |
| `stores` | Store name lookup |

---

## 5. How Sales Connect to Stock

Two linkage paths are used (both attempted in parallel):

1. **ObjectId reference:** `orders.stockID` = `stocks._id` (modern app, reliable)
2. **Name match:** `orders.item` or `orders.productName` matches `stock.name` (case-insensitive, trimmed — handles legacy records with trailing spaces)

This dual-path design ensures both legacy Truehost-migrated records (August–September 2026) and modern app records are covered.

---

## 6. How Customers Connect to Sales

Customer information is resolved in priority order:

1. `orders.customer_name` (denormalized string — most reliable for historical records)
2. `orders.buyer_name` (alternate buyer field)
3. `"Customer information unavailable"` — used honestly when no customer data exists; never fabricated

---

## 7. How Purchases/Receiving Connect to Stock

Two linkage paths (both attempted):

1. **ObjectId reference:** `purchases.stock_id` = `stocks._id`
2. **Name match:** `purchases.stock_name` matches `stock.name` (trimmed, case-insensitive)

---

## 8. How Balance is Calculated

The running balance is calculated chronologically (ascending by date):

1. If a `StockMovement` record exists for an event AND it has a `quantity_after` snapshot, that value is used directly as the authoritative balance.
2. Otherwise, the balance is accumulated by adding/subtracting `quantity_change` from the previous event's balance.

**`is_balance_exact`:** Set to `true` when `calculated_balance === current_balance` (current stock qty from DB). If `false`, the UI shows an amber warning noting that pre-system historical opening stock may not be fully recorded — this is expected for items that were in stock before the system was deployed.

---

## 9. Branch Isolation

The endpoint is fully branch-scoped:

- `requireBranchScope` middleware runs before the tracking route
- `facilityID` is taken from `req.branchId` (authenticated branch from JWT)
- The stock item is first verified to belong to `facilityID` before any history is fetched
- If the stock item does not exist in the caller's facility, the endpoint returns `404`
- A MURG/003 or MURG/007 caller cannot access MURG/001 stock history

---

## 10. Historical Data Support

The feature fully supports:

- **August 2026** records recovered from Truehost SQL export
- **September 2026** records recovered from Truehost SQL export  
- **Modern records** (created in the live app after migration)

All three are merged into a single chronological timeline per stock item.

---

## 11. Event Source Priority / Deduplication

Modern `StockMovement` records take priority. When a `StockMovement` exists for an order or purchase reference, the corresponding raw `order`/`purchase` document is marked as already-represented and not double-counted.

---

## 12. Tests Performed

| Test | Result |
|---|---|
| Backend unit test suite (18 tests) | ✅ 18/18 PASS |
| Stock repository contract (`getStockTracking` exposed) | ✅ PASS |
| Frontend Vite production build | ✅ No errors |
| Read-only safety (no collection mutations after tracking call) | ✅ VERIFIED |
| Branch isolation (MURG/003 cannot access MURG/001 stock) | ✅ BLOCKED (null returned) |
| `Las Vegas LOT B` lifecycle (1 purchase, 14 orders, 11 buyers) | ✅ Correct |
| `GORILLA 150y Nivora` lifecycle (Aug+Sep, 118 received, 115 sold, 24 buyers) | ✅ is_balance_exact: true |
| `7star U&ME` lifecycle (modern movements + historical, 76 events) | ✅ is_balance_exact: true |

---

## 13. Known Limitations

- **Opening balance:** For stock items that existed before the first system record (no initial `STOCK_INITIAL` movement and no purchase in MongoDB), the calculated opening balance defaults to 0. The running balance may be negative in early events. This is historically accurate — the `is_balance_exact` flag signals when the final balance reconciles.
- **Staff names for historical records:** Orders imported from Truehost via MySQL do not always have a `staffID` linked; staff name may show as `—` for pre-migration transactions.
- **Cost data:** Unit cost and total cost for purchases are only visible to Admin/GlobalAdmin callers (`includeCost: true`). Staff see quantities and customer info but not purchase costs.
- **Pagination:** Filters are applied in-memory after merging all three event sources (orders, purchases, stockmovements). For very high-volume stocks with thousands of events, server-side pre-filtering may be warranted in a future iteration.

---

## 14. Files Modified

| File | Change |
|---|---|
| `backend/src/repositories/stockRepositoryMongo.js` | Added `getStockTracking()` method; added `Return` to model imports |
| `backend/src/controllers/stockController.js` | Added `getStockTracking()` controller |
| `backend/src/routes/stockRoutes.js` | Registered `GET /:id/tracking` (before `/:id` catch-all) |
| `frontend/src/pages/StockPage.jsx` | Added Track button per row; added full Stock Tracking Modal |
| `backend/tests/unit/safeMongoTestConfig.test.js` | Added `getStockTracking` to stock repository contract |
