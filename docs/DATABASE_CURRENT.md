# Current Database Reference

Database name defaults to `murg`. The authoritative schema is the live database plus the ordered SQL migrations under `database/migrations`; base dumps are in `database/`.

## Core Existing Tables

| Table | Role |
|---|---|
| `facility` | Users/staff: id, facilityID, name, role, status, legacy password, bcrypt password_hash, permissions. |
| `branch` | Branch code/profile, status, phone, sales_mode. |
| `stores` | Sub-locations belonging to a branch. |
| `stocks` | Current product inventory by branch/store, prices, quantity, unit type, yard configuration. |
| `orders` | Sale line rows grouped by `orderID`; includes historical line price/quantity/name and order payment/totals. |
| `order_items` | Normalized order-item table present in the schema history; inspect callers before using it as the receipt source. |
| `customers` | Customer identity and branch association. |
| `outstand` | Customer outstanding/debt balance values. |
| `deposit_history` | Debt repayment records; migration 001 adds branch association. |
| `purchase_history` | Supplier receiving history. |
| `cart`, `debt_cart` | Temporary legacy/POS cart tables. |
| `conca` | Legacy branch code counter. |
| `expense` | Legacy expense records. |

## Additive Tables

- `stock_movements`: immutable inventory events with movement type, quantity before/after, reference, performer, and timestamp.
- `shipments`, `shipment_items`: inter-branch transfer and quantities.
- `audit_logs`: administrative/security actions and old/new JSON values.
- `auth_bridge_tickets`: short-lived, single-use legacy session handoff tickets.
- `password_resets`: hashed OTP/reset workflow state, expiration, attempts, verification/use flags.
- `goods_requests`: request identity, product/source, branch, quantity, status, approval/release and receipt fields.
- `notifications`: user/role/branch-targeted in-app notifications and read state.
- `shipment_receipts`: approved logistics receipt and one-time consumption/release state.

## Key Relationships

- `facility.facilityID`, `branch.facilityID`, `stocks.facilityID`, `orders.facilityID`, and movement `facilityID` use the branch code.
- `stocks.store_id` references the logical `stores` record.
- `orders.stockID` identifies the stock/product line, while `orderID` groups lines into one transaction.
- `stock_movements.reference_type/reference_id` point to business records without universal foreign keys.
- `shipment_items.shipment_id` has a foreign key to `shipments.id` with cascade delete.
- Customer/debt relations are application-enforced; legacy tables do not uniformly have foreign keys.

## Important Indexes

Existing/migration indexes include branch and movement indexes, shipment status/source-destination indexes, audit action/user/entity indexes, goods request status/receipt/approval/release indexes, notification target/read indexes, `orders(orderID)`, `orders(facilityID, creation)`, `orders(creation)`, and `stock_movements(facilityID, created_at)`.

## Migration Order

1. `001_multibranch_and_stock_ledger.sql`: branch/user/deposit additions, movements, shipments, audits.
2. `002_branch_sales_mode_and_yard_pricing.sql`: sales mode and per-yard price.
3. `003_auth_bridge_and_management.sql`: bridge tickets.
4. `004_password_reset_and_goods_requests.sql`: reset, requests, notifications, shipment receipts.
5. `005_goods_request_custom_products.sql`: nullable stock ID and catalog/custom source.
6. `006_goods_request_approval_workflow.sql`: approval/release fields and indexes.
7. `007_historical_receipts_and_analytics_indexes.sql`: receipt/analytics/ledger indexes.

All are intended to be additive/backward-compatible. Do not edit production data to make a UI work; use a reviewed migration only when schema support is genuinely required.
