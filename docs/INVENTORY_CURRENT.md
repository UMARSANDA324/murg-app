# Inventory

## Current State Versus History

`stocks` is the current branch/store inventory record. It contains product identity, branch, store, unit type, current quantity, buying/selling prices, and per-yard configuration. `stock_movements` is the append-oriented historical ledger with before/after quantities, movement type, reference, performer, and timestamp.

Do not reconstruct current quantity by summing history unless a specific audit query requires it. Do not treat a purchase, transfer, request, or adjustment as a sale.

## Movement Types

The database enum supports:

- `STOCK_IN_SUPPLIER`
- `STOCK_OUT_SALE`
- `STOCK_IN_RETURN`
- `STOCK_OUT_TRANSFER`
- `STOCK_IN_TRANSFER`
- `STOCK_ADJUSTMENT`
- `STOCK_DAMAGE`

Movement rows carry `facilityID`, optional store, stock ID, signed quantity change, quantity before/after, `reference_type`, `reference_id`, notes, performer, and `created_at`.

## Receiving and Checkout

Supplier receiving updates stock and records `purchase_history` plus a supplier-in movement. Checkout locks stock, rejects insufficient quantity, updates quantity, and records a sale movement. Shipment dispatch/receipt uses shipment repositories and transfer movement types. Goods release deducts source inventory through the goods-request repository at release time.

## Branch Sales Modes

`branch.sales_mode` is `DEALER` by default or `PER_YARD`.

- Dealer mode uses normal stock unit pricing, generally belt-based.
- Per-yard mode can convert received belts to yards using the configured conversion and uses `stocks.price_per_yard` when configured. Fractional yard quantities are accepted by the backend checkout path.
- Price and yard configuration changes are Admin-only and audited.

The backend, not the UI, decides authoritative price and quantity validity.
