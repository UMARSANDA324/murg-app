# Incremental Migration Plan (14 Phases)

## 1. Guiding Migration Principles

1. **Zero Unplanned Downtime**: The existing PHP web application remains operational throughout all phases.
2. **Backward Compatibility**: Any new database column or table must be additive and not break existing PHP queries.
3. **Data Safety First**: Pre-migration backups and verifiable verification checks before and after any database schema evolution.
4. **Strangler Fig Pattern**: Incrementally expose new features via Node.js API endpoints and React UI modules while legacy PHP scripts continue to handle legacy flows until ready for cutover.

---

## 2. Phase-by-Phase Roadmap

### Phase 1: Technical Codebase & Schema Audit (Completed)
* Complete audit of existing PHP scripts (`system/`, `sub/`, `front/`, `assets/mashaAllah/gyada.php`).
* Complete audit of MySQL database schema, 17 tables, numeric string storage, and relation structures.
* Inspection of legacy roles (`Admin`, `Sub-admin`, `Staff`) and existing dealer credit workflows.
* Inspection of Vite + React frontend template and Express backend scaffolding.

### Phase 2: System Architecture Documentation (Completed)
* Creation of `/docs` directory and 11 foundational architecture documents:
  - `ARCHITECTURE.md`, `DATABASE.md`, `AUTH_AND_ROLES.md`, `BRANCH_SYSTEM.md`, `STOCK_SYSTEM.md`
  - `SALES_AND_RECEIPTS.md`, `SHIPPING.md`, `MIGRATION_PLAN.md`, `API.md`, `DEVELOPMENT_GUIDE.md`, `CHANGELOG.md`.

### Phase 3: Production Backup & Rollback Protocols
* Automated script to take consistent MySQL database dumps before any schema execution:
  `mysqldump -u root -p murg > database/backup_murg_pre_multibranch_YYYYMMDD_HHMMSS.sql`.
* Code repository snapshot tagged in Git: `git tag -a v1.0-legacy-baseline -m "Legacy baseline before multi-branch migration"`.
* Verifiable rollback SQL scripts prepared for every migration step.

### Phase 4: Database Schema Evolution (Additive)
* Run safe, non-destructive SQL migrations:
  - Add `status` and `phone` to `branch`.
  - Add `facilityID` to `deposit_history`.
  - Add `password_hash` (for bcrypt) and `permissions` (JSON) to `facility`.
  - Create new additive tables: `stock_movements`, `shipments`, `shipment_items`, `audit_logs`.
* Verify existing PHP applications run without any query errors.

### Phase 5: Implement Branch Foundation & Isolation Engine
* Backend Node.js repository queries and branch scoping middleware (`requireBranchScope`).
* Admin Branch CRUD API:
  - `GET /api/branches`, `POST /api/branches`, `PUT /api/branches/:id`, `PATCH /api/branches/:id/status`.
* React UI:
  - Branch management dashboard for Global Admin.
  - Branch Switcher header component for authorized Admins.
* Verification: Branch A user cannot query Branch B data via direct API calls.

### Phase 6: Staff, Role & Centralized Permission System
* Backend RBAC engine with granular permission checks:
  - `requirePermission('manage_staff')`, `requirePermission('change_product_price')`.
* Node.js Dual-Auth verification:
  - Verifies legacy MD5 passwords and upgrades to bcrypt in background.
* Staff management API:
  - Assign staff to branch, assign roles, modify permissions, suspend/activate staff.
* React UI:
  - Staff management console, role assignment dialog, permission checkboxes.

### Phase 7: Branch-Scoped Sales & POS Engine
* Build modern POS cashier interface in React:
  - Product search, barcode scanning, fast keyboard shortcuts.
  - Multi-store selection (Rumfa, Layin Kwari).
  - Discount inputs (item discount and global order discount).
  - Split payments calculator (Cash, Card POS, Bank Transfer).
* Dealer credit sale checkout with customer outstanding balance ledger updates.
* Transactional atomic order commit in Node.js API (orders + inventory decrement + ledger entry).

### Phase 8: Stock Tracking Engine & Movement Ledger
* Implement immutable `stock_movements` ledger writing on every inventory event.
* Refactor inventory query logic: eliminate string-casting calculation errors.
* Build modern Stock Tracking Dashboard:
  - Date-range filtering, stock additions, sales deductions, physical stock balances.
  - Damaged stock logging and physical inventory reconciliation.

### Phase 9: Supplier Stock Receipt & History
* Formalize supplier/dealer stock intake workflow:
  - Record supplier name, contact, product, unit buying cost, quantity, invoice reference.
  - Atomic stock balance increment and `STOCK_IN_SUPPLIER` movement entry.
* Supplier payment tracking (amount paid vs balance owed to supplier).
* Generate printable Supplier Stock Intake Receipt.

### Phase 10: Receipts & Mobile Thermal Printing Integration
* Dynamic thermal receipt engine:
  - Integrates issuing branch's logo, name, address, contact numbers, and return policy.
* 3-Tier Printing Architecture:
  1. Universal 80mm CSS print dialog for mobile Safari/AirPrint and standard printers.
  2. Web Bluetooth API integration for Android Google Chrome direct ESC/POS printing.
  3. External printer intent helper support.

### Phase 11: Inter-Branch Stock Shipping System
* Build shipping state machine (`Draft` $\to$ `In Transit` $\to$ `Received` / `Cancelled`).
* Source branch dispatch: validates available stock, decrements source, marks `In Transit`.
* Destination branch receiving: verifies arrival, counts goods, accepts inventory into destination.
* Waybill / Dispatch manifest printable document.

### Phase 12: Admin-Only Price Protection Boundary
* Strict server-side middleware `requireAdminPriceControl`:
  - Blocks any price change request not signed by a verified global `Admin`.
  - Audits every price modification in `audit_logs` (recording old price, new price, user ID, timestamp).
* Frontend UI: Hide or disable price inputs for all non-admin users.

### Phase 13: End-to-End Testing & Security Audit
* Automated integration test suite:
  - Branch isolation tests (Branch A vs Branch B).
  - Price modification rejection tests (Staff/Manager attempting to PATCH price).
  - Stock transaction race condition tests.
  - Cart abandonment tests (confirming stock is not leaked).
* Security audit: parameter tampering, SQL injection prevention, JWT signature verification.

### Phase 14: Production Deployment & Cutover
* Configuration of Nginx/Apache reverse proxy routing.
* Database final migration execution and sanity check.
* Verification of legacy PHP operations running alongside React/Node modules.
* Handover documentation and training guide for branch managers and cashiers.

---

## 3. v1.4.0 — Unified Application & Auth Bridge (Completed)

> This phase was delivered as a cross-cutting concern spanning Phases 6, 13, and 14. It does not replace any existing phase — it completes the unified gateway layer that all future phases depend on.

### What Was Delivered

| Component | Description | Files |
|---|---|---|
| **Auth Bridge** | Secure single-use session handoff (Node JWT → PHP `$_SESSION`) | `auth_bridge.php`, `003_auth_bridge_and_management.sql` |
| **Management Center** | React admin hub with KPIs, module launcher, and audit trail | `frontend/src/pages/ManagementPage.jsx` |
| **Management API** | Bridge ticket issuance, overview KPIs, audit log endpoints | `backend/src/routes/managementRoutes.js`, `managementController.js`, `managementRepository.js` |
| **Dev Orchestrator** | MySQL health check, Mode A/B Apache, pre-flight schema check | `scripts/dev-orchestrator.js` |
| **Vite Proxy Gateway** | Unified entry point — all dev traffic through port 5173 | `frontend/vite.config.js` |
| **End-to-End Tests** | 21 management + bridge tests, 31 core API tests | `backend/tests/management.test.js` |

### Database Migration (003)

Applied additively — zero production data impact:

```sql
-- Migration 003: Auth Bridge Tickets
-- File: database/migrations/003_auth_bridge_and_management.sql
CREATE TABLE IF NOT EXISTS auth_bridge_tickets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket      VARCHAR(64) NOT NULL UNIQUE,
  user_id     INT NOT NULL,
  facilityID  VARCHAR(50),
  role        VARCHAR(20) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(255),
  target_path VARCHAR(500) NOT NULL,
  consumed    TINYINT(1) NOT NULL DEFAULT 0,
  consumed_at DATETIME DEFAULT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Run with:
```powershell
node backend/scripts/run-migration-003.js
# OR
mysql -u root murg < database/migrations/003_auth_bridge_and_management.sql
```

---

## 4. Production Deployment Notes

### 4.1 Web Server Configuration

In production, Vite is not running. The proxy gateway must be replicated at the Nginx or Apache level.

**Required proxy routes:**

| Path | Backend | Notes |
|---|---|---|
| `/api/*` | `http://127.0.0.1:5000` | Node.js / Express REST API |
| `/auth_bridge` | `http://127.0.0.1:80/murg/auth_bridge.php` | Ticket consumption — cookie path rewrite required |
| `/system/*` | `http://127.0.0.1:80/murg/system/` | Legacy PHP Admin panel |
| `/sub/*` | `http://127.0.0.1:80/murg/sub/` | Legacy PHP Manager panel |
| `/front/*` | `http://127.0.0.1:80/murg/front/` | Legacy PHP Cashier panel |
| `/assets/*` | `http://127.0.0.1:80/murg/assets/` | Shared CSS/JS assets |
| `/*` (fallback) | `frontend/dist/index.html` | React SPA — SPA fallback routing |

> **Cookie path rewriting is mandatory** for all PHP-proxied routes. PHPSESSID cookies issued by Apache have `path=/murg/`, which must be rewritten to `path=/` to be valid on the production domain.

### 4.2 Environment Variables (Production)

```env
# backend/.env
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=murg
DB_USER=<production_db_user>
DB_PASS=<production_db_password>
JWT_SECRET=<minimum_64_char_random_string>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://murg.example.com
```

> **Never** use `root` with a blank password in production. Create a dedicated database user with minimal required privileges.

### 4.3 Pre-Deployment Checklist

- [ ] Run `npm run build` — verify zero errors, inspect bundle size
- [ ] Apply all pending migrations (001, 002, 003) against production database
- [ ] Verify `auth_bridge_tickets` table exists in production database
- [ ] Rotate `JWT_SECRET` to a production-grade random string (min 64 chars)
- [ ] Configure Nginx/Apache with correct cookie path rewriting
- [ ] Confirm PHP `session.cookie_path = /` in `php.ini` (or set in `auth_bridge.php`)
- [ ] Run `node backend/tests/management.test.js` against staging environment
- [ ] Take a full MySQL dump before deployment: `mysqldump -u root murg > backup_pre_v1.4.0.sql`

---

## 5. Rollback Strategy

### 5.1 Rollback from v1.4.0

If v1.4.0 must be rolled back, the following components can be independently reverted:

| Component | Rollback Action | Impact |
|---|---|---|
| **Auth Bridge tickets table** | `DROP TABLE auth_bridge_tickets;` | Management Center legacy launcher stops working; all other features unaffected |
| **Vite proxy gateway** | Revert `frontend/vite.config.js` to previous version | Legacy PHP modules no longer accessible from port 5173; PHP still works on port 80 directly |
| **Management API routes** | Remove `managementRoutes` import from `backend/src/app.js` | `/api/management/*` endpoints return 404 |
| **Management Center page** | Remove `/management` route from `frontend/src/App.jsx` | Admin navigation item disappears |
| **Dev orchestrator** | Revert root `package.json` `dev` script to previous `concurrently ...` command | Returns to previous startup behavior |

**The rollback is entirely non-destructive to existing data.** No existing tables, columns, or PHP files are modified by v1.4.0.

### 5.2 Rollback from Schema Migrations

| Migration | Rollback SQL |
|---|---|
| 003 | `DROP TABLE IF EXISTS auth_bridge_tickets;` |
| 002 | See `database/migrations/002_branch_sales_modes_and_stock.sql` — review additive columns before dropping |
| 001 | `DROP TABLE IF EXISTS stock_movements, shipments, shipment_items, audit_logs;` then `ALTER TABLE facility DROP COLUMN password_hash, DROP COLUMN permissions;` |

> ⚠️ **Never roll back migrations 001 or 002 in production without a pre-rollback full database dump.** These tables may contain live operational data.

---

## 6. Known Limitations

| Limitation | Category | Notes |
|---|---|---|
| Node.js and PHP maintain separate authentication state | Architecture | The Auth Bridge is one-way (Node → PHP). PHP session changes (e.g., password change in legacy UI) are not reflected back into the Node JWT until the user re-logs in to the React app. |
| Bridge ticket TTL is 60 seconds | Security | Prevents long-lived ticket theft but requires user to re-generate if ticket expires before use. |
| Legacy PHP pages use MD5 passwords | Security | Until all users have logged in via Node.js (triggering bcrypt upgrade), MD5 hashes remain in `facility.password`. MD5 is deprecated — migrate all users to bcrypt as a Phase 6 priority. |
| Legacy pages have no role-boundary enforcement within their directories | Security | A `Sub-admin` with a valid session can navigate to `/system/stocks.php` if they know the URL. This is a pre-existing legacy limitation — not introduced by v1.4.0. Addressed in Phase 6. |
| Auth Bridge requires Apache to be running | Operational | If Apache is down, clicking a legacy module launch button will produce a network error. The React application and Node API continue to function normally. |
| `auth_bridge_tickets` table grows over time | Database | Consumed and expired tickets are never automatically purged. Add a scheduled cleanup job or cron: `DELETE FROM auth_bridge_tickets WHERE consumed = 1 OR expires_at < NOW()` |
| Vite proxy is not 100% equivalent to direct Apache | Development | Some Apache-specific behaviors (mod_rewrite edge cases, PHP error pages, file upload size limits) may differ when accessed via the Vite proxy. Always test edge cases via direct XAMPP access (`http://localhost/murg/`) before declaring a PHP feature complete. |

