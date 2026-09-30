# Current Database Reference

The MURG Textile Enterprises application uses MongoDB Atlas as the runtime database. All active Express controllers use MongoDB repositories and Mongoose models.

## MongoDB Atlas Connection

- Connection configured in `backend/src/config/mongodb.js`
- Uses `MONGODB_URI` environment variable
- Supports replica set topology
- Database name: `murg`
- No automatic MySQL connection in runtime

## MongoDB Collections

| Collection | Role |
|---|---|
| `users` | User accounts, authentication, roles, permissions, facility association |
| `facility` | Branch/facility records, sales mode configuration, status |
| `stores` | Sub-locations belonging to a branch |
| `stocks` | Current product inventory by branch/store, prices, quantity, unit type, yard configuration |
| `orders` | Sale line rows grouped by `orderID`; includes historical line price/quantity/name and order payment/totals |
| `customers` | Customer identity and branch association |
| `debts` | Customer outstanding/debt balance values |
| `deposits` | Debt repayment records with branch association |
| `purchase_history` | Supplier receiving history |
| `stock_movements` | Immutable inventory events with movement type, quantity before/after, reference, performer, and timestamp |
| `shipments` | Inter-branch transfer records |
| `audit_logs` | Administrative/security actions and old/new JSON values |
| `password_resets` | Hashed OTP/reset workflow state, expiration, attempts, verification/use flags |
| `goods_requests` | Request identity, product/source, branch, quantity, status, approval/release and receipt fields |
| `notifications` | User/role/branch-targeted in-app notifications and read state |
| `shipment_receipts` | Approved logistics receipt and one-time consumption/release state |
| `expenses` | Branch expense tracking |
| `returns` | Return processing records with stock restoration and debt reversal |

## Key Relationships

- `users.facilityID`, `facility.facilityID`, `stocks.facilityID`, `orders.facilityID`, and movement `facilityID` use the branch code
- `stocks.store_id` references the logical `stores` record
- `orders.stockID` identifies the stock/product line, while `orderID` groups lines into one transaction
- `stock_movements.reference_type/reference_id` point to business records without universal foreign keys
- Customer/debt relations are application-enforced through repository logic

## Transaction Strategy

The application uses atomic single-document operations with manual rollback for complex multi-document operations:

- **Customer creation**: Uses MongoDB transactions for atomic ID reservation and customer creation
- **Stock receipt**: Uses MongoDB transactions for atomic stock update, purchase record, and movement ledger
- **Price updates**: Uses MongoDB transactions for atomic price changes with audit logging
- **Shipment transfers**: Uses atomic single-document operations with manual rollback (no MongoDB transactions due to Atlas topology constraints)
- **Returns processing**: Uses MongoDB transactions for atomic stock restoration and debt reversal

## Important Indexes

MongoDB indexes include branch and movement indexes, shipment status/source-destination indexes, audit action/user/entity indexes, goods request status/receipt/approval/release indexes, notification target/read indexes, and compound indexes for orders and stock movements.

## Testing

Integration tests use `MONGODB_TEST_URI` with database exactly `murg_test`. Never use the runtime `MONGODB_URI` for destructive test setup or cleanup.

## Legacy SQL

SQL-backed repository files and MySQL scripts remain as inactive migration/history tooling; they are not imported by the application runtime. The application does not use MySQL as a runtime database.
