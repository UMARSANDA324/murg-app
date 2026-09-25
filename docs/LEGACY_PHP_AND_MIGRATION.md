# Legacy PHP and Migration Map

## Coexistence

Apache serves the PHP application from `C:\xampp\htdocs\murg`. PHP and Node both connect to the same MySQL database. Vite proxies legacy paths so the React gateway can launch PHP modules without changing the shared database.

The auth bridge (`auth_bridge.php` plus `/api/management/bridge-ticket`) transfers a verified Node identity into a PHP session using a short-lived, single-use database ticket. It does not replace PHP page checks or grant a role beyond the ticket identity.

## Current Map

| Area | Current owner | Status |
|---|---|---|
| Login and modern API identity | Node/React | Modern JWT flow; legacy PHP login/session remains for direct PHP entry. |
| Dashboard | React/Node | Modern page and branch dashboard APIs. |
| POS checkout | React/Node | `POST /api/sales/checkout`; legacy POS files remain for compatibility. |
| Stock inventory and movement ledger | React/Node | Modern Stock page/API; legacy stock/report pages remain available. |
| Customers and deposits | React/Node | Modern customer API/page; PHP equivalents remain in `front`, `sub`, `system`. |
| Branch management | React/Node | Admin React page/API; legacy branch entry is decommissioned from bridge allowlists. |
| Staff management | React/Node | Admin React page/API; legacy staff entry is decommissioned from bridge allowlists. |
| Goods requests/receipts | React/Node | Modern implementation. |
| Analytics and management | React/Node | Modern management and DAS/WAS/MAS pages/API. |
| Shipments | React/Node | Modern shipment workflow and receipt release APIs. |
| Supplier purchases/receiving detail | PHP plus modern stock receiving | PHP `purchase.php`, reports and purchase details remain active. |
| Expenses | PHP | `front/expense.php`, `sub/expense.php`, `system/expense.php`. |
| Reports/monthly/weekly/returns/profile/store utilities | PHP | Remain active through allowlisted legacy paths where applicable. |

This is a coexistence map, not a claim that every PHP file is dead or every business operation is fully removed from PHP. Inspect `managementController.js` allowlists before adding a bridge destination.

## Active Legacy Areas

The `front`, `sub`, and `system` directories contain PHP pages such as `expense.php`, `deposit.php`, `purchase.php`, `return.php`, `report.php`, `stocks.php`, `profile.php`, invoice/verification pages, and supporting headers/sidebar/PHPMailer code. They also contain diagnostics and old workflows. Do not mass-edit or remove them during modern feature work.

## Migration Rule

A new module should extend the existing React/Node implementation when one exists. If the requested operation is still PHP-owned, preserve its session, database, and Apache assumptions and use the auth bridge rather than inventing a parallel PHP authentication handoff.
