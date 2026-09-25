# Sales and Debts

## Sale Representation

The legacy `orders` table stores one row per item line. Rows belonging to one transaction share `orderID`; order-level fields such as payment, totals, customer, staff, and creation time are repeated or read from the grouped order. Any order count or DAS/WAS/MAS calculation must use distinct `orderID`, not raw line count.

Important historical fields include `facilityID`, `staffID`, `stockID`, `item`, `price`, `quantity`, `subtotal`, discounts, `payment`, `orderID`, `status`, customer/buyer fields, payment-channel fields, `net_total`, and `creation`.

## POS Checkout

`POST /api/sales/checkout` calls `SalesRepository.atomicCheckout`. It starts a database transaction, locks branch stock rows with `FOR UPDATE`, validates available quantity, chooses the authoritative database price, calculates gross/discount/net totals, updates stock, writes orders and stock movements, updates credit state when applicable, and commits. Failure rolls back the transaction.

The browser-supplied price is not authoritative. Sale and credit order IDs are returned after commit and used to retrieve receipt data.

## Credit/Debt Sales

Credit is represented by `payment = 'Credit'` and/or `status = 0`. The current implementation treats both as credit indicators. Credit sales are included in the sales activity metrics. Customer balances are represented in `outstand`; deposits are recorded through the customer API and `deposit_history`.

A sale is not a stock transfer, supplier purchase, goods request, or unrelated stock movement. Returns and other legacy workflows must be inspected before changing qualification rules.

## Source of Truth

- Sale totals: backend checkout calculation and persisted `orders` rows.
- Current quantity: `stocks.quantity`.
- Historical quantity changes: `stock_movements`.
- Customer outstanding balance: `outstand` plus the existing deposit workflow.
- Historical product price/name: order line snapshot fields, not current `stocks` values.
