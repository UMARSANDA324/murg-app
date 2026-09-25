# Frontend Map

## Routes

Defined in `frontend/src/App.jsx`:

| Path | Page | Access |
|---|---|---|
| `/login` | `LoginPage` | Public |
| `/forgot-password` | `ForgotPasswordPage` | Public |
| `/` | `DashboardPage` inside `DashboardLayout` | Authenticated |
| `/pos` | `POSTerminalPage` | Authenticated |
| `/stock` | `StockPage` | Authenticated |
| `/shipments` | `ShipmentsPage` | Authenticated |
| `/goods-requests` | `GoodsRequestsPage` | Authenticated |
| `/customers` | `CustomersPage` | Authenticated |
| `/management` | `ManagementPage` | Admin-only UI gate |
| `/staff` | `StaffPage` | Admin-only UI gate |
| `/branches` | `BranchesPage` | Admin-only UI gate |

Unknown routes redirect to `/`.

## State and HTTP

- `frontend/src/store/useAuthStore.js`: login, logout, user/token persistence, permission helper.
- `frontend/src/store/useBranchStore.js`: branch list, active branch, local-storage selection.
- `frontend/src/services/api.js`: Axios `/api` client, bearer-token request interceptor, 401 cleanup/redirect.
- `frontend/src/layouts/DashboardLayout.jsx`: authenticated shell, navigation, branch selection, notification panel, and realtime connection.
- `frontend/src/hooks/useBranchRealtime.js`: consumes branch events and refreshes relevant views.
- `frontend/src/components/PasswordInput.jsx`: shared password input.

## Feature Ownership

| Feature | UI | API family | Main data |
|---|---|---|---|
| Dashboard and DAS/WAS/MAS | `DashboardPage` | branches, analytics | orders, stocks, shipments, debts |
| POS and receipt after checkout | `POSTerminalPage` | stocks, customers, sales | stocks, orders, outstand |
| Stock/current inventory and movement history | `StockPage` | stocks, sales receipts | stocks, stock_movements, orders |
| Customers/deposits | `CustomersPage` | customers | customers, outstand, deposit_history |
| Transfers | `ShipmentsPage` | shipments, stocks | shipments, shipment_items, stock_movements |
| Goods requests/releases | `GoodsRequestsPage` | goods-requests, stocks | goods_requests, shipment_receipts, notifications |
| Staff and branches | `StaffPage`, `BranchesPage` | staff, branches | facility, branch |
| Global management | `ManagementPage` | management | audit_logs and management repository queries |

The frontend does not own official totals, prices, stock authorization, branch scope, or receipt reconstruction. Those come from the backend/database.
