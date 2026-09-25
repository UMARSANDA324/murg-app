# Receipts

## Sale and Debt Receipts

The sale receipt endpoint is `GET /api/sales/:orderId/receipt`. It reads the persistent `orders` line rows, joins branch/store/customer metadata, and returns a receipt DTO containing transaction identity, branch, staff, customer, timestamp, payment data, totals, debt amount, and line items. The endpoint constrains non-admin users by authenticated `facilityID` before returning data.

Historical receipts are reconstructed from stored order snapshots. The receipt does not use current product prices or current product names to recalculate the old transaction. Reprinting uses the same `orderID`; it does not create a new sale.

The POS page uses the same receipt endpoint after checkout. The Stock page exposes `View Receipt` for authorized historical sale movements and renders the existing print modal/template.

## Goods-Request Receipts

Goods requests have a separate approval/collection receipt workflow:

1. Admin approval creates an approval `receipt_code` without deducting stock.
2. Source-branch staff verifies the code and release authorization.
3. Atomic release deducts source stock once and creates a final `collection_code`.
4. `shipment_receipts` and `goods_requests` preserve the receipt/release state.

These are logistics receipts, not sale receipts.

## Authorization and Immutability

A branch user cannot retrieve another branch's sale receipt by changing the URL ID. The backend checks branch ownership. Historical order line values are the receipt source; changing today’s catalog price must not change an old receipt.

## Printing

The current web UI uses the browser print flow and the existing receipt presentation. The repository also contains legacy PHP invoice pages. Do not create a third receipt renderer without first deciding which existing renderer owns the target workflow.
