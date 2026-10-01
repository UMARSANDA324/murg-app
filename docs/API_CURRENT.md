# Current API Reference

Base path is `/api`. Unless marked public, routes require `Authorization: Bearer <JWT>`. Responses use the standard envelope described in [ARCHITECTURE_CURRENT.md](ARCHITECTURE_CURRENT.md).

## Root Endpoint

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | API information and health status |

The root endpoint returns API metadata, version, environment, and database connection status without exposing secrets.

## Health Check

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Service health and timestamp |

## Public

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Service health and timestamp. |
| POST | `/api/auth/login` | Login and JWT issuance. |
| POST | `/api/auth/forgot-password` | Request reset OTP. |
| POST | `/api/auth/verify-reset-otp` | Verify OTP and receive reset token. |
| POST | `/api/auth/reset-password` | Set password using reset token. |

## Authenticated Identity

| Method | Route | Scope |
|---|---|---|
| GET | `/api/auth/me` | Current active user. |

## Branches

| Method | Route | Access/notes |
|---|---|---|
| GET | `/api/branches` | Authenticated; list is role/branch-aware in repository. |
| POST | `/api/branches` | Admin; create branch. |
| GET | `/api/branches/dashboard` | Admin; resolved branch scope. |
| GET | `/api/branches/:branchId/dashboard` | Admin; resolved branch scope. |
| GET | `/api/branches/:prefix/:suffix/dashboard` | Admin; compatibility form for slash branch codes. |
| GET | `/api/branches/:prefix/:suffix` | Branch lookup for IDs such as `MURG/007`. |
| PUT | `/api/branches/:prefix/:suffix` | Admin update for slash-form branch IDs. |
| PATCH | `/api/branches/:prefix/:suffix/status` | Admin status update for slash-form branch IDs. |
| GET | `/api/branches/:branchId` | Authenticated branch scope. |
| PUT | `/api/branches/:branchId` | Admin; update branch. |
| PATCH | `/api/branches/:branchId/status` | Admin; activate/deactivate. |

## Staff

All `/api/staff` reads and mutations are Admin-only: `GET /api/staff`, `GET /api/staff/:id`, `POST /api/staff`, `PATCH /api/staff/:id/role`, `PATCH /api/staff/:id/status`, `PATCH /api/staff/:id/email`, `PATCH /api/staff/:id/password`, and `DELETE /api/staff/:id`.

## Stocks and Movements

- `GET /api/stocks`: branch/store/search inventory with case-insensitive partial matching.
- `GET /api/stocks/catalog`: authenticated global catalog name search used for custom goods requests with case-insensitive partial matching.
- `GET /api/stocks/stores`: active stores for resolved branch.
- `GET /api/stocks/movements`: Admin-only branch-scoped ledger; supports `stockId`, `startDate`, `endDate`, `limit`, `offset`.
- `GET /api/stocks/:id`: one stock record.
- `POST /api/stocks/receive`: Admin-only supplier receipt and movement.
- `POST /api/stocks/stores`, `PUT /api/stocks/stores/:id`, `DELETE /api/stocks/stores/:id`: Admin-only store management.
- `GET /api/stocks/purchases/history`, `GET /api/stocks/purchases/totals`: Admin-only branch-scoped supplier purchase history and totals.
- `PATCH /api/stocks/:id/price`: Admin-only price update.
- `PATCH /api/stocks/:id/yard-config`: Admin-only per-yard configuration.
- `POST /api/stocks`: Admin-only stock creation; validates all numeric/unit fields and records initial quantity in the movement ledger.
- Buying price and `Bsubtotal` are returned only to Admin; non-Admin catalog responses omit them.

## Sales and Receipts

- `GET /api/sales`: Admin-only branch-scoped grouped sales with date/paging parameters.
- `GET /api/sales/by-date`: Admin-only compatibility date-range grouped sales endpoint.
- `POST /api/sales/checkout`: authenticated atomic checkout.
- `GET /api/sales/:orderId/items`: Admin-only order lines.
- `GET /api/sales/:orderId/receipt`: authorized persistent historical sale/debt receipt.

## Customers and Debts

- `GET /api/customers`: branch-scoped customer list; non-Admin responses omit debt/deposit totals.
- `POST /api/customers`, `GET /api/customers/:id`, and customer deposit/history routes: Admin-only.

## Shipments

- All shipment routes are Admin-only. Dispatch and receipt retain atomic stock operations and rollback on failure.

## Expenses and Returns

- Expenses: list/read/create/update/archive routes are Admin-only. `DELETE /api/expenses/:id` is a soft archive and writes an audit record transactionally; it does not permanently delete the historical financial record, which remains included in totals.
- Returns: `GET /api/returns/validate/:orderID` validates order eligibility for return; `POST /api/returns/process` processes return with stock restoration and debt reversal. Returns preserve original order rows and create a separate return ledger record.

## Goods Requests and Receipts

- `POST /api/goods-requests`: submit catalog/custom request.
- `GET /api/goods-requests/my`: own/branch requests.
- `GET /api/goods-requests/pending-release`: approved requests at authenticated source branch.
- `GET /api/goods-requests/receipt/:code`: validate approval receipt.
- `POST /api/goods-requests/receipt/:code/release`: release and create collection receipt.
- `GET /api/goods-requests/:id`: authorized request details.
- Admin: `GET /api/goods-requests`, `GET /api/goods-requests/:id/eligible-branches`, `POST /api/goods-requests/:id/reject`, `POST /api/goods-requests/:id/approve`, and compatibility `POST /api/goods-requests/:id/approve-and-ship`.
- `GET /api/shipment-receipts/:code/verify`: verify logistics receipt.
- `POST /api/shipment-receipts/:code/release`: compatibility release endpoint.

## Management, Notifications, Analytics, Realtime

- Admin management: `GET /api/management/overview`, `GET /api/management/audit-logs` with `limit`, `offset`, `action`, `facilityID` filters.
- Notifications: `GET /api/notifications` returns notifications scoped to user ID, role, or branch using OR logic; `GET /api/notifications/unread-count` returns unread count using the same OR logic; `PATCH /api/notifications/:id/read` marks single notification as read; `POST /api/notifications/mark-all-read` marks all as read; `POST /api/notifications/mark-read` batch-marks visible notifications as read. All notification operations enforce ownership and use the same recipient/authorization rules.
- Analytics: Admin-only. `GET /api/analytics/sales-activity` supports optional `branchId` and `date`.
- Financial reports: `GET /api/analytics/financial` with `branchId=all|<facilityID>`, `period=week|month|year|custom`, and the applicable `weekStart`, `month`, `year`, `startDate`, and `endDate` parameters. The weekly/monthly/yearly aliases use the same service.
- Debtor print data: `GET /api/analytics/debtors` supports branch/all-business scope and optional `customerId`.
- Sales/history and stock ledger print data: `GET /api/analytics/history` supports branch/all-business scope and week/month/year/custom periods. Results are capped and explicitly indicate truncation.

### Financial Reporting Definitions and Limits

- Reports aggregate existing MongoDB order, purchase, expense, debt, stock, and branch records on the backend.
- The Admin dashboard's daily/weekly financial totals, report API responses, and financial print view all consume this same financial-reporting service. The dashboard does not reuse its separate operational cash/credit widgets as financial source-of-truth totals.
- Persisted `orders.net_total` is reported once per branch/order as recorded net sales. Orders without it or with conflicting per-line totals are listed in data-quality counts; their line subtotals contribute to gross sales only.
- Purchase value (`purchase_history.total_cost`) and amount spent (`amount_paid`) are distinct.
- `expenses.type=in` and `type=out` are reported separately; the application does not establish that both represent expenses.
- Outstanding customer debt and inventory value are current snapshots, not period activity.
- Inventory is labelled **Recorded Inventory Buying-Price Value**: active stock quantity × current recorded buying price. It is not total business capital.
- Profit/loss and COGS are explicitly unavailable until the canonical MURG formula and reliable historic sale-time cost basis are established. Current stock buying prices are not used as historical COGS.
- Branch and all-business totals use actual branch records/relationships. Unmapped historical order, purchase, expense, debt, and ledger records are reported separately where supported and are not assigned to a branch.
- Missing/conflicting per-line order `net_total` values are excluded from recorded net sales and counted in data-quality fields. Unknown-branch records are excluded from branch/all-business totals and surfaced separately; debtor and ledger reports expose truncation limits.

Branch archive is Admin-only deactivation: branch documents and historical records are preserved, status changes are audited, and staff branch-scoped operations are denied while the branch is inactive.
- Realtime: `GET /api/realtime/branch`, authenticated and branch-scoped stream.

## Shipment Transaction Strategy

Shipment transfers use atomic operations with safe rollback:

- **No MongoDB transactions**: The current Atlas deployment topology does not support multi-document transactions required for the complex shipment transfer operations.
- **Atomic single-document operations**: Stock deductions and additions use atomic `$inc` operations with optimistic concurrency checks.
- **Manual rollback**: If any step fails, the system reverses stock changes and removes created records to prevent partial stock movement.
- **Consistency guarantee**: The system cannot end up with source stock deducted but destination stock not received (or vice versa).
- **Audit trail**: All stock movements are recorded in the `stock_movements` ledger for traceability.

For request bodies and business rules, read the owning feature document and controller/repository together. Do not infer authorization from the frontend route.
