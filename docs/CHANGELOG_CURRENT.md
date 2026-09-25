# Current Project History

The repository history currently contains a baseline checkpoint and a subsequent decommissioning/migration checkpoint. Feature-level history is also represented by the numbered migrations and existing documentation.

## Verified Milestones

- Legacy PHP application established the original POS, inventory, debt, purchase, expense, reporting, and invoice workflows over MySQL.
- React/Vite and Node/Express modern runtime introduced alongside PHP using a shared database.
- Multi-branch fields, stock movement ledger, shipments, audit logs, and branch indexes added by migration 001.
- Branch sales modes and per-yard pricing added by migration 002.
- Node-to-PHP Auth Bridge and management data added by migration 003.
- Password reset, goods requests, notifications, and shipment receipts added by migration 004.
- Custom goods-request products added by migration 005.
- Goods-request approval/release receipts and one-time collection workflow added by migration 006.
- Historical receipt lookup and analytics/ledger indexes added by migration 007.
- React pages and modern APIs now cover dashboard, POS, stock, customers, staff, branches, shipments, goods requests, management, notifications, and analytics; PHP remains active for the legacy map documented in `LEGACY_PHP_AND_MIGRATION.md`.

Do not infer exact release dates or complete PHP removal from this summary. Use `git log`, migration files, and current route/allowlist code for precise history.
