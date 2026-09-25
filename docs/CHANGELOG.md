# Project Changelog & Architecture Audit Log

All notable changes, architectural decisions, database migrations, and feature completions are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [v1.4.0] - 2026-09-23

### Unified Application Entry Point, Centralized Admin Management & Secure Session Bridge

#### 1. Unified Application Gateway (Strangler Fig Pattern)
- Unified entry point established at `http://localhost:5173` via Vite reverse proxy:
  - `/api/*` proxies to Node.js backend (`http://localhost:5000`).
  - `/system/*`, `/sub/*`, `/assets/*`, `/bootstrap/*`, `/plugins/*`, and `/auth_bridge.php` proxy to Apache (`http://localhost/murg`).
  - Native `PHPSESSID` cookies transparently rewritten to `path: /` so legacy session persists across the entire unified origin.

#### 2. Centralized Admin Management Center
- Dedicated **`Management`** navigation button added to desktop sidebar and mobile navigation for authenticated Administrators.
- New **Admin Management Center** (`/management`) protected by `adminOnly` route guard and backend `requireAdmin`:
  - Cross-branch administrative KPIs: Total Branches, Total Staff, Active SKUs, In-Transit Transfers, Total Debts.
  - Centralized module hub deep-linking into Branches, Staff, Stock Pricing, Shipments, Customers, and POS.
  - Legacy Operations Gateway: One-click launchpad for Expenses, Bank Deposits, Supplier Purchases, Warehouses, Returns, and Financial Reports.
  - Live Security & Audit Trail: Filterable real-time event viewer querying `audit_logs`.
- Backend endpoints under `/api/management/*` protected by `requireAdmin`, returning 403 Forbidden to non-admin staff.

#### 3. Secure Auth Bridge (`auth_bridge.php`)
- Cryptographically secure single-use ticket handoff (`crypto.randomBytes(32)` -> 64-char hex token).
- Maximum 60-second time-to-live.
- Atomic single-use consumption in MySQL transaction (`consumed = 1`); replay attempts immediately rejected with 403 Forbidden.
- User-bound: identity hydrated strictly from authoritative `facility` table in MySQL.
- Server-side strict destination allowlist preventing open redirects; external URLs (`https://`, `//`) rejected with 400 Bad Request.
- Staff role restricted strictly to `/sub/*` destinations; attempted access to `/system/*` rejected with 403 Forbidden.

#### 4. Development Orchestrator (`scripts/dev-orchestrator.js`)
- Root `npm run dev` orchestrates the complete environment:
  - **NEVER auto-starts MySQL**: Performs a non-invasive health check on port 3306. If unavailable, aborts with an actionable error.
  - **Apache detection**: Detects active Apache (Mode B: XAMPP) on port 80; if stopped, automatically launches `C:\xampp\apache\bin\httpd.exe` (Mode A: Automated).
  - Pre-flight schema validation (`check-db-columns.js`).
  - Concurrently runs Node.js backend (port 5000) and React frontend (port 5173).

#### 5. Database Safety & Testing
- Additive migration `003_auth_bridge_and_management.sql` creating table `auth_bridge_tickets`. Zero existing tables or rows modified.
- Full automated test suite in `backend/tests/management.test.js` (21 tests, all passed).
- Core integration regression suite in `backend/tests/api.test.js` (31 tests, all passed). Total: 52 automated tests passing.

---

## [v1.2.1] - 2026-09-23

### Forensic Auth Audit, Production Credential Restoration & Multi-Layer Password Fallback

#### 1. Root Cause Identification: `password_mismatch`
* Forensic investigation revealed that `backend/tests/api.test.js` had executed:
  `UPDATE facility SET password = MD5('admin123'), password_hash = NULL WHERE id = 4`
  directly against the live `murg` database during earlier test runs, overwriting Alh Yasir's genuine production password hash with the MD5 and bcrypt hashes of `'admin123'`.
* When the administrator subsequently attempted to log in using their authentic credentials, the entered password failed to match the corrupted hash, triggering `[AUTH_LOGIN_FAILED] password_mismatch — user_id: 4 method: bcrypt`.
* Furthermore, `verifyPassword` in `passwordUtils.js` only checked `password_hash` if non-null, completely bypassing `user.password` (MD5) without fallback.

#### 2. Production Credential Restoration & Zero Data Loss
* Created verified pre-fix backup: `database/backup_facility_before_auth_fix_20260923.sql` via `mysqldump`.
* Reverted user 4 (`yasir@gmail.com`) to its authoritative hash from `database/backup_murg_pre_multibranch_20260922.sql`:
  `password = 'fd149fa1f2a2fee8d88bc1be14467a81'`, `password_hash = NULL`.
* Reverted user 6 (`staff1@gmail.com`) to its authoritative hash from `database/backup_murg_pre_multibranch_20260922.sql`:
  `password = '827ccb0eea8a706c4c34a16891f84e7b'`, `password_hash = NULL`.
* Zero production records were deleted, reset, or seeded. User IDs, emails, roles, and business data remain 100% intact.

#### 3. Dual-Layer Fallback Password Verification
* Updated `backend/src/utils/passwordUtils.js`:
  - Layer 1: Evaluates modern `password_hash` using `bcrypt.compare`. If valid, returns `{ valid: true, needsUpgrade: false }`.
  - Layer 2: If bcrypt fails OR `password_hash` is NULL, falls back to evaluate `user.password` using MD5 (`md5(password) === user.password`).
  - Layer 3: If MD5 succeeds, returns `{ valid: true, needsUpgrade: true }`, triggering an automatic background upgrade to bcrypt in `password_hash`.
  - This architecture ensures that if a user changes their password via the legacy PHP interface (`system/edit-staff.php`, `front/profile.php`), they can still log in seamlessly on Node without account lockouts.

#### 4. Automated Test Isolation
* Refactored `backend/tests/api.test.js`:
  - Created dedicated temporary test users (`test_admin_%@murg.test`, `test_staff_%@murg.test`).
  - Tested legacy MD5 authentication, bcrypt upgrade, subsequent bcrypt authentication, invalid password rejection (401), and non-existent user rejection (401).
  - Ensured automated tests NEVER mutate or corrupt live production user rows (`id: 4`, `id: 6`).
  - Added teardown query in `finally` block to remove all temporary test users.

#### 5. Bidirectional Coexistence for Staff Creation
* Updated `staffController.js` and `staffRepository.js` so that creating a staff member via Node stores both `password_hash` (bcrypt) and `password` (MD5), allowing newly created staff to log into both React/Node and legacy PHP portals.

---

## [v1.2.0] - 2026-09-23

### Architecture Audit, Auth Diagnostics & Unified Developer Experience

#### 1. Architecture & Live Database Audit
* Verified live MySQL database structure against XAMPP: confirmed `facility` table contains `password_hash`, `permissions`, `role`, `status`.
* Confirmed migration `001_multibranch_and_stock_ledger.sql` tables (`stock_movements`, `shipments`, `audit_logs`) are intact.
* Preserved 100% of existing legacy PHP code across `/system`, `/sub`, `/front`, and public pages.

#### 2. Authentication Diagnostics & 401 Resolution
* Traced full authentication pipeline: React login form $\to$ Vite `/api` proxy $\to$ Express `authController.login` $\to$ `authRepo.findByEmailForAuth` $\to$ `verifyPassword` (dual MD5/bcrypt) $\to$ JWT generation.
* Introduced structured diagnostic logging in `backend/src/controllers/authController.js`:
  - `AUTH_LOGIN_FAILED: user_not_found`
  - `AUTH_LOGIN_FAILED: account_suspended`
  - `AUTH_LOGIN_FAILED: password_mismatch`
  - `AUTH_LOGIN_FAILED: DB error`
  - Client response remains safe (`Invalid email or password` with 401/400) without exposing sensitive information.
* Created `AuthRepositoryError` in `backend/src/repositories/authRepository.js` catching `ER_BAD_FIELD_ERROR` and distinguishing missing schema columns from transient query errors.
* Added fail-safe JSON parsing for `facility.permissions` preventing server crashes on corrupt or null permission data.

#### 3. Database Pre-flight Safety Guard
* Created `backend/scripts/check-db-columns.js`:
  - Automatically verifies MySQL connection status and existence of required columns (`password_hash`, `permissions`).
  - Displays formatted, actionable diagnostic box if MySQL is down or if migrations are missing.
* Integrated into `backend/package.json` dev script before nodemon execution.

#### 4. Unified One-Command Developer Workflow
* Created root `package.json` with `concurrently`:
  - `npm run dev`: starts both backend Express API (with DB check) and React Vite development server simultaneously with color-coded prefix tags (`[API]`, `[REACT]`).
  - `npm run build`: builds the React SPA.
  - `npm run install:all`: one-command dependency installation for backend and frontend.
* Created root `.env.example` documenting all configuration options across Node.js, database, JWT, and CORS.
* Rewrote `docs/DEVELOPMENT_GUIDE.md` and updated `docs/ARCHITECTURE.md`.

---

## [v1.1.0] - 2026-09-22

### Phased Migration Execution Completed

#### Phase 3: Production Backup & Safety Checkpoint
* Full database backup created and verified: `database/backup_murg_pre_multibranch_20260922.sql` (1.24 MB).
* Git repository status verified clean on `main`.

#### Phase 4: Non-Destructive Database Schema Migrations (Additive)
* Migration file: `database/migrations/001_multibranch_and_stock_ledger.sql`.
* Added `status` and `phone` to `branch`.
* Added `password_hash` (bcrypt) and `permissions` (JSON) to `facility`.
* Added `facilityID` to `deposit_history` for branch-scoped debt repayment tracking.
* Created `stock_movements` (immutable inventory ledger).
* Created `shipments` and `shipment_items` (inter-branch transfer tracking).
* Created `audit_logs` (security & sensitive operation audit trail).
* Backfilled `deposit_history.facilityID` from `customers.facilityID`.

#### Phase 5 & 6: Branch Foundation, RBAC, and Authentication Engine
* **Node.js Backend Layered Architecture**:
  - `backend/src/config/database.js`: MySQL connection pool matching PHP Lagos timezone (+01:00).
  - `backend/src/utils/passwordUtils.js`: Dual-hash authentication (verifies legacy MD5 and transparently upgrades to bcrypt).
  - `backend/src/middleware/auth.js`: JWT verification, query-level branch scoping (`requireBranchScope`), granular permissions, and Admin-only price protection (`requireAdminPriceControl`).
  - `backend/src/repositories/branchRepository.js`: Atomic branch creation with sequential `conca.lastID` auto-incrementing, branch CRUD, and branch dashboard metrics.
  - `backend/src/repositories/staffRepository.js`: Staff management and branch assignment.
  - `backend/src/controllers/authController.js`, `branchController.js`, `staffController.js`.
  - `backend/src/routes/authRoutes.js`, `branchRoutes.js`, `staffRoutes.js`.

#### Phase 7: Branch-Scoped Sales & POS Engine
* `backend/src/repositories/salesRepository.js`:
  - Atomic POS checkout (`atomicCheckout`) inside an ACID SQL transaction.
  - Fixes premature stock deduction bug: inventory is only decremented upon successful checkout commit.
  - Writes to `stock_movements` with `STOCK_OUT_SALE`.
  - Supports split payment (Cash, POS, Transfer) and credit sale debt tracking (`outstand`).

#### Phase 8: Stock Tracking Engine & Movement Ledger
* `backend/src/repositories/stockRepository.js`:
  - Scoped product catalog retrieval.
  - Immutable movement ledger writing for every inventory change.
  - Stock movement query API: `GET /api/stocks/movements`.

#### Phase 9: Supplier Stock Intake & History
* `POST /api/stocks/receive`: Records supplier/dealer name, product, unit cost price, quantity, and updates inventory atomically while logging `STOCK_IN_SUPPLIER`.

#### Phase 10: Receipts & 3-Tier Mobile Thermal Printing
* `GET /api/sales/:orderId/receipt`: Dynamically compiles receipt data using issuing branch's profile (name, address, phone).
* React POS modal renders 80mm thermal receipt with CSS print styling (`@page { size: 80mm auto; }`).

#### Phase 11: Inter-Branch Stock Shipping
* `backend/src/repositories/shipmentRepository.js`:
  - State machine: `Draft` $\to$ `In Transit` (source stock deducted) $\to$ `Received` (destination stock verified and credited).
  - Zero phantom inventory: destination branch inventory is never incremented until physical receipt confirmation.

#### Phase 12: Admin-Only Price Protection Boundary
* Backend middleware `requireAdminPriceControl` strictly rejects non-Admin price modifications with `403 Forbidden`.
* Logs unauthorized attempts and confirmed price adjustments in `audit_logs`.
* React UI restricts price editing to Global Admin.

#### Phase 13: End-to-End Automated Integration Testing
* Automated test suite `backend/tests/api.test.js`:
  - 14 tests executed: 14 PASSED, 0 FAILED.
  - Verified branch isolation (Staff cannot query another branch).
  - Verified Admin-only price protection.
  - Verified atomic checkout and stock movement ledger.
  - Verified legacy MD5 login and bcrypt transparent upgrade.

#### Modern React Frontend Application (`/frontend`)
* Single Page Application built on React 19, Vite 8, Tailwind CSS v4, Zustand 5, and React Router v7.
* Pages implemented:
  - `LoginPage.jsx`
  - `DashboardLayout.jsx` (Responsive layout, branch selector, legacy portal link)
  - `DashboardPage.jsx` (Branch metrics, operational launchpad)
  - `POSTerminalPage.jsx` (Point of sale cashier, split payment, 80mm thermal receipt modal)
  - `StockPage.jsx` (Catalog, Admin price control modal, supplier intake modal, movement ledger tab)
  - `ShipmentsPage.jsx` (Inter-branch transfer dispatch and arrival inspection)
  - `CustomersPage.jsx` (Customer debt ledgers and repayment deposits)
  - `StaffPage.jsx` (Staff registration, role allocation, suspension)
  - `BranchesPage.jsx` (Admin branch management)
* Production build verified (`vite build`: 0 errors).
