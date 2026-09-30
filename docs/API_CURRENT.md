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
| GET | `/api/branches/dashboard` | Authenticated branch scope. |
| GET | `/api/branches/:branchId/dashboard` | Authenticated branch scope. |
| GET | `/api/branches/:prefix/:suffix/dashboard` | Compatibility form for slash branch codes. |
| GET | `/api/branches/:prefix/:suffix` | Branch lookup for IDs such as `MURG/007`. |
| PUT | `/api/branches/:prefix/:suffix` | Admin update for slash-form branch IDs. |
| PATCH | `/api/branches/:prefix/:suffix/status` | Admin status update for slash-form branch IDs. |
| GET | `/api/branches/:branchId` | Authenticated branch scope. |
| PUT | `/api/branches/:branchId` | Admin; update branch. |
| PATCH | `/api/branches/:branchId/status` | Admin; activate/deactivate. |

## Staff

`GET /api/staff`, `GET /api/staff/:id` are authenticated and repository-scoped. Admin-only mutations are `POST /api/staff`, `PATCH /api/staff/:id/role`, `PATCH /api/staff/:id/status`, `PATCH /api/staff/:id/email`, `PATCH /api/staff/:id/password`, and `DELETE /api/staff/:id`.

## Stocks and Movements

- `GET /api/stocks`: branch/store/search inventory with case-insensitive partial matching.
- `GET /api/stocks/catalog`: authenticated global catalog name search used for custom goods requests with case-insensitive partial matching.
- `GET /api/stocks/stores`: active stores for resolved branch.
- `GET /api/stocks/movements`: branch-scoped ledger; supports `stockId`, `startDate`, `endDate`, `limit`, `offset`.
- `GET /api/stocks/:id`: one stock record.
- `POST /api/stocks/receive`: receive supplier stock and create movement.
- `POST /api/stocks/stores`, `PUT /api/stocks/stores/:id`, `DELETE /api/stocks/stores/:id`: Admin-only store management.
- `GET /api/stocks/purchases/history`, `GET /api/stocks/purchases/totals`: branch-scoped supplier purchase history and totals.
- `PATCH /api/stocks/:id/price`: Admin-only price update.
- `PATCH /api/stocks/:id/yard-config`: Admin-only per-yard configuration.

## Sales and Receipts

- `GET /api/sales`: branch-scoped grouped sales with date/paging parameters.
- `GET /api/sales/by-date`: compatibility date-range grouped sales endpoint.
- `POST /api/sales/checkout`: authenticated atomic checkout.
- `GET /api/sales/:orderId/items`: authorized order lines.
- `GET /api/sales/:orderId/receipt`: authorized persistent historical sale/debt receipt.

## Customers and Debts

- `GET /api/customers`: branch-scoped customers/debt data with case-insensitive name/phone search.
- `POST /api/customers`: create customer.
- `GET /api/customers/:id`: retrieve authorized customer.
- `POST /api/customers/:id/deposits`: record authorized debt deposit.
- `GET /api/customers/:id/deposits`: retrieve deposit history.

## Shipments

- `GET /api/shipments`: authorized branch shipments.
- `POST /api/shipments`: create/dispatch transfer with atomic stock deduction and rollback on failure.
- `GET /api/shipments/:id`: authorized details with populated branch names and user info.
- `POST /api/shipments/:id/receive`: receive destination shipment with atomic stock addition and rollback on failure.

## Expenses and Returns

- Expenses: `GET /api/expenses`, `/totals`, `/dashboard`, `GET /:id`, `POST /`, `PUT /:id`, and `DELETE /:id`; all reads and mutations are scoped to the resolved branch.
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
- Analytics: `GET /api/analytics/sales-activity` with optional `branchId` and `date`.
- Realtime: `GET /api/realtime/branch`, authenticated and branch-scoped stream.

## Shipment Transaction Strategy

Shipment transfers use atomic operations with safe rollback:

- **No MongoDB transactions**: The current Atlas deployment topology does not support multi-document transactions required for the complex shipment transfer operations.
- **Atomic single-document operations**: Stock deductions and additions use atomic `$inc` operations with optimistic concurrency checks.
- **Manual rollback**: If any step fails, the system reverses stock changes and removes created records to prevent partial stock movement.
- **Consistency guarantee**: The system cannot end up with source stock deducted but destination stock not received (or vice versa).
- **Audit trail**: All stock movements are recorded in the `stock_movements` ledger for traceability.

For request bodies and business rules, read the owning feature document and controller/repository together. Do not infer authorization from the frontend route.
