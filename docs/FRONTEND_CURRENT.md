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
| `/expenses` | `ExpensesPage` | Authenticated |
| `/returns` | `ReturnsPage` | Authenticated |
| `/management` | `ManagementPage` | Admin-only UI gate |
| `/staff` | `StaffPage` | Admin-only UI gate |
| `/branches` | `BranchesPage` | Admin-only UI gate |

Unknown routes render `NotFoundPage` (404).

## Routing Behavior

- **Direct URL support**: `/login` and other routes work correctly when accessed directly or refreshed
- **Authentication**: `/login` redirects to dashboard only if already authenticated; authenticated users cannot access `/login`
- **Role-based access**: Admin-only routes (`/management`, `/staff`, `/branches`) are protected at the route level
- Financial overview/print reports are available at Admin-only `/reports`; Staff/Cashier navigation excludes management/reporting pages and direct route access redirects to POS.
- **Unknown routes**: Render a 404 page instead of redirecting to dashboard

## State and HTTP

- `frontend/src/store/useAuthStore.js`: login, logout, user/token persistence, permission helper.
- `frontend/src/store/useBranchStore.js`: branch list, active branch, local-storage selection.
- `frontend/src/services/api.js`: Axios `/api` client, bearer-token request interceptor, 401 cleanup/redirect.
- `frontend/src/layouts/DashboardLayout.jsx`: authenticated shell, navigation, branch selection, notification panel, and realtime connection.
- `frontend/src/hooks/useBranchRealtime.js`: consumes branch events and refreshes relevant views.
- `frontend/src/components/PasswordInput.jsx`: shared password input.
- `frontend/src/utils/dateUtils.js`: Safe date formatting utilities to prevent "Invalid Date" display.

## Feature Ownership

| Feature | UI | API family | Main data |
|---|---|---|---|
| Dashboard and DAS/WAS/MAS | `DashboardPage` | branches, analytics | orders, stocks, shipments, debts |
| Admin financial and print reports | `FinancialReportsPage` | Admin-only analytics financial/debt/history endpoints | orders, purchases, expenses, debts, stocks, stock_movements |
| POS and receipt after checkout | `POSTerminalPage` | stocks, customers, sales | stocks, orders, outstand |
| Stock/current inventory and movement history | `StockPage` | stocks, sales receipts | stocks, stock_movements, orders |
| Customers/deposits | `CustomersPage` | customers | customers, outstand, deposit_history |
| Transfers | `ShipmentsPage` | shipments, stocks | shipments, shipment_items, stock_movements |
| Goods requests/releases | `GoodsRequestsPage` | goods-requests, stocks | goods_requests, shipment_receipts, notifications |
| Expenses | `ExpensesPage` | expenses | expenses |
| Returns | `ReturnsPage` | returns | returns, orders, stock_movements |
| Staff and branches | `StaffPage`, `BranchesPage` | staff, branches | facility, branch |
| Global management | `ManagementPage` | management | audit_logs and management repository queries |

## Notification System

The frontend notification bell has three distinct states:

- **Loading**: Displays "Loading notifications..." while fetching data
- **Error**: Displays error message with warning icon if API request fails
- **Empty**: Displays "No notifications yet." only when there are genuinely zero notifications
- **Success**: Displays notification list with unread indicators

The notification bell and dropdown:
- Polls unread count every 30 seconds
- Fetches fresh notifications when bell is opened
- Automatically marks visible notifications as read when panel opens
- Updates unread count immediately after successful mark-as-read
- Persists read state across page refreshes (stored in MongoDB)
- Does not delete read notifications - they remain in history

## Search/Autocomplete

The application implements production-level search across multiple entities:

- **Product search**: `POSTerminalPage`, `StockPage` - debounced search with MongoDB regex matching
- **Customer search**: `CustomersPage` - searches name and phone fields
- **Global catalog search**: `GoodsRequestsPage` - searches across all branches for goods requests
- **Search behavior**: Case-insensitive, partial matching, trimmed input, 400ms debounce
- **Branch scope**: All searches respect the authenticated user's branch and role permissions

## Development

The frontend can be started independently from the `frontend` directory:

```bash
cd frontend
npm run dev
```

This starts the Vite development server on `http://localhost:5173` (or next available port).

The frontend does not depend on the root orchestrator or backend for startup.

The frontend does not own official totals, prices, stock authorization, branch scope, or receipt reconstruction. Those come from the backend/database.
