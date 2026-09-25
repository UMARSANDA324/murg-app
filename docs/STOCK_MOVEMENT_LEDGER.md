# Stock Movement Ledger

## Purpose

The ledger is the historical inventory event view on `StockPage`. It is not the current stock table and it is not the sales table. It shows movement rows joined with product, performer, and order metadata.

## API and Query

`GET /api/stocks/movements` is authenticated and branch-scoped. It supports `stockId`, `startDate`, `endDate`, `limit`, and `offset`; the backend caps each page at 500 rows. The SQL includes a business date string (`YYYY-MM-DD`) and business time derived from `stock_movements.created_at`.

The UI loads a page and offers `Load older movements`, so history is bounded per request rather than loading the full ledger at once. Older records remain reachable through subsequent pages.

## Daily Grouping

`StockPage` groups rows by the backend `business_date`. The date formatter uses Africa/Lagos. Valid date-only strings, MySQL datetime strings, ISO timestamps, and `Date` values are supported. Missing or malformed values are grouped under `Date unavailable`, remain visible, and produce only a development diagnostic. They are never assigned to today or silently discarded.

Group headers show distinct sale transactions, normal sales, and debt sales. Expanded groups show individual movement lines and expose `View Receipt` for sale movements whose reference is an order.

## Interpret Rows

- Sale movement: `movement_type = STOCK_OUT_SALE`, `reference_type = orders`; multiple rows may belong to one order.
- Supplier receipt: `STOCK_IN_SUPPLIER`, usually references `purchase_history`.
- Transfer: `STOCK_OUT_TRANSFER` or `STOCK_IN_TRANSFER`, references shipment data.
- Adjustment/damage/return: movement type identifies the inventory event and must not be counted as a sale.

## Historical Access

The source table is `stock_movements`; sale receipt reconstruction additionally reads `orders`. Branch authorization comes from JWT-derived scope. No daily summary table is created.
