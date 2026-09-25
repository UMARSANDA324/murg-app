# MURG Textile Enterprises - System Architecture Documentation

## 1. Executive Summary

MURG Textile Enterprises operates a live retail, dealer-based, and wholesale textile management platform in Kano, Nigeria. The software handles product cataloging (fabrics, shadda, swiss, coco, geznar, etc. measured in belts and yards), point-of-sale transactions, credit sales with customer debt ledgers, supplier purchase tracking, and multi-store inventory.

This document details both the **existing legacy production architecture** and the **modernized target architecture** (React + Node.js/Express + MySQL), establishing an incremental migration pathway that guarantees zero production downtime, full backward compatibility, and zero data loss.

---

## 2. High-Level Architecture

The overall system architecture follows a **coexistence model** (Strangler Fig Pattern):

```
                        +------------------------------------+
                        |           Client Devices           |
                        |   Desktop / Tablet / Android / iOS |
                        +------------------------------------+
                                    |              |
                    (Legacy Routes) |              | (Modern SPA)
                                    v              v
                   +------------------+          +-------------------+
                   | Apache / PHP     |          | Vite / React SPA  |
                   | (Port 80/443)    |          | (Port 5173 / CDN) |
                   +------------------+          +-------------------+
                     |              |                      |
      (HTML/Bootstrap)              | (Direct PHP DB)      | (REST API Calls)
                     v              |                      v
           +------------------+     |            +-------------------+
           | /system (Admin)  |     |            | Node.js / Express |
           | /sub (Manager)   |     |            | (Port 5000 API)   |
           | /front (Staff)   |     |            +-------------------+
           +------------------+     |                      |
                                    v                      v
                       +----------------------------------------+
                       |        Shared MySQL / MariaDB          |
                       |             Database (murg)            |
                       +----------------------------------------+
```

---

## 3. Legacy PHP Architecture Audit

### 3.1 Directory Topology

| Directory | Target Persona | Technology Stack | Purpose |
|---|---|---|---|
| `/` (Root) | Public / Gateway | Vanilla PHP, jQuery | Landing page, login handler (`dologin.php`), public verification, migration scripts |
| `/front/` | Sales Staff / Cashiers | PHP, Bootstrap 4, DataTables | Cashier POS checkout, customer debt cart, cash/POS/transfer receipts, order returns |
| `/sub/` | Branch Managers | PHP, Bootstrap 4, DataTables | Branch inventory viewing, stock adjustments, customer debt viewing, branch reporting |
| `/system/` | Global Administrator | PHP, Bootstrap 4, DataTables | Complete system oversight, staff creation, store creation, purchase tracking, global reports |
| `/assets/` | Shared Assets | CSS, JS, Vendor libs | Shared stylesheet and core connection script (`assets/mashaAllah/gyada.php`) |
| `/database/` | Database backups | SQL Dumps | Historical schema snapshots (`murg.sql`, `mqbpzutq_murg.sql`) |

### 3.2 Legacy Request Lifecycle

1. **Authentication**:
   - The user enters credentials at `index.php`.
   - JavaScript triggers an AJAX POST to `dologin.php`.
   - Credentials are evaluated against the `facility` table using `MD5(password)`.
   - On success, `$_SESSION` is populated:
     - `$_SESSION['id']` (User Primary Key)
     - `$_SESSION['email']`
     - `$_SESSION['role']` (`Admin`, `Sub-admin`, or `Staff`)
     - `$_SESSION['name']`
     - `$_SESSION['facilityID']` (Branch Identifier, e.g. `MURG/001`)
   - `dologin.php` sends a client-side JavaScript redirect:
     - `role === 'Admin'` $\to$ `/system/`
     - `role === 'Sub-admin'` $\to$ `/sub/`
     - `role === 'Staff'` $\to$ `/front/`

2. **Database Connectivity**:
   - Included via `assets/mashaAllah/gyada.php`.
   - Checks if `../../db_config.php` exists (for live production server); otherwise falls back to `localhost:3306`, user `root`, blank password, database `murg`.
   - Global variable `$con` (`mysqli` instance) is exposed to all scripts.
   - Sets timezone to `Africa/Lagos`.
   - Intercepts `?switch_branch=` parameter to allow an Admin to switch active branch context in session.

3. **Page Rendering & Security**:
   - Each page independently checks `if (strlen($_SESSION['email']) == 0) header('location:../index.php');`.
   - Direct raw SQL queries with basic `mysqli_real_escape_string` or direct parameter embedding.
   - Error suppression via `error_reporting(0)` is widespread across legacy scripts.

---

## 4. Modernized Architecture (React + Node.js)

### 4.1 Node.js / Express Backend (`/backend`)

The backend is structured under a **Layered Architecture** adhering to clean separation of concerns:

```
backend/
├── src/
│   ├── config/             # DB connection pool (mysql2/promise), JWT secrets, env config
│   ├── controllers/        # HTTP request/response handlers, status codes
│   ├── middleware/         # Auth, RBAC, branch isolation, validation, error handler
│   ├── models/             # Domain data shapes, constants, types
│   ├── repositories/       # Pure SQL queries, parameterized statements, transactions
│   ├── routes/             # Express Router endpoint definitions
│   ├── services/           # Core business logic (stock deduction, order calculations, pricing)
│   ├── utils/              # Password hasher (MD5/bcrypt dual-verification), logger, ESC/POS generator
│   └── app.js              # Express app setup, CORS, JSON parsers, security headers
├── server.js               # Entry point, HTTP server listen
├── package.json
└── .env
```

#### Core Backend Responsibilities:
1. **Unified Database Access**: Connection pooling via `mysql2/promise` connected to the same MySQL `murg` database.
2. **Dual-Hash Authentication**: Validates legacy `MD5` password hashes and transparently upgrades them to `bcrypt` upon login.
3. **Strict Branch Scoping**: Automatically applies `WHERE facilityID = :branchId` at the repository layer based on verified JWT claims.
4. **ACID Transactions**: Wraps order placement, inventory decrements, and debt updates inside atomic SQL transactions (`START TRANSACTION` ... `COMMIT`).
5. **Strict Admin-Only Pricing**: Any request modifying `selling` or `buying` price is verified against the authenticated user's global admin role.

### 4.2 React Frontend (`/frontend`)

The frontend is a modern Single Page Application built on:
- **React 19** + **Vite 8**
- **Tailwind CSS v4** + **shadcn/ui** design system
- **Zustand** for state management (User Session, Active Branch, Cart State)
- **React Router v7** for nested routes, authenticated route guards, and branch context
- **Axios** for API calls with automatic bearer token injection and 401/403 interceptors

```
frontend/src/
├── app/                    # Providers, App wrapper
├── components/             # Reusable UI widgets (buttons, modals, tables, badges)
├── layouts/                # AdminLayout, BranchLayout, StaffPOSLayout
├── pages/                  # Route view components
├── features/
│   ├── auth/               # Login form, session handling
│   ├── branches/           # Branch switcher, branch creation & edit, staff assignment
│   ├── staff/              # Staff management, role assignments
│   ├── stock/              # Stock catalog, stock receipts, store/yard tracking
│   ├── sales/              # POS terminal, credit sales, discount calculator
│   ├── receipts/           # Thermal print preview (80mm), ESC/POS generator
│   ├── suppliers/          # Supplier/dealer receipt records, purchase history
│   └── shipping/           # Inter-branch transfer requests, in-transit dispatch, receiving
├── services/               # Axios API client functions
├── store/                  # Zustand stores (useAuthStore, useBranchStore, useCartStore)
├── hooks/                  # Custom hooks (usePermissions, useThermalPrint)
└── utils/                  # Formatting (Currency NGN, Date formatting, print helpers)
```

---

## 5. Architectural Coexistence & Boundary Strategy

To avoid downtime or breaking existing retail operations:

1. **Shared Database**:
   - Both legacy PHP scripts and Node.js backend connect to the exact same MySQL database (`murg`).
   - New tables (e.g. `stock_movements`, `shipments`, `shipment_items`, `roles`, `permissions`, `audit_logs`) and columns (`password_hash`, `permissions`) are purely additive and verified in production.
   - Any schema modification to existing tables preserves existing column names and backward compatibility.

2. **Session & Auth Compatibility**:
   - Passwords in the database are either legacy `md5($password)` or modern bcrypt in `password_hash`.
   - Node.js verifies `bcrypt` first if `password_hash` is present; otherwise falls back to `md5(password) === db_password`. When verified via MD5, Node.js transparently writes an upgraded hash in `password_hash` while leaving `password` intact for PHP compatibility until full cutover.
   - Structured diagnostic logging records specific failure reasons internally (`user_not_found`, `account_suspended`, `password_mismatch`, `MISSING_COLUMNS`) without leaking security details or PII over the wire.

3. **Unified Single-Command Development Gateway**:
   - Root `package.json` coordinates all micro-services using `concurrently`:
     - `npm run dev`: Runs pre-flight DB schema check (`check-db-columns.js`), launches Node API server (`PORT=5000`), and launches Vite React SPA (`PORT=5173`).
     - Vite proxy routes `/api/*` to `http://localhost:5000`.
     - Apache (XAMPP) runs legacy PHP application on `http://localhost/murg/` concurrently against the same MySQL database.
   - In production: Nginx or Apache acts as a reverse proxy routing `/api/*` to Node.js, `/` to React SPA build (`frontend/dist`), and legacy routes (`/system`, `/sub`, `/front`) to PHP.

---

## 6. Migration Status Matrix

| Module | Legacy PHP Implementation | Modern Target Implementation | Migration Status |
|---|---|---|---|
| **Authentication** | `dologin.php` (MD5, sessions) | JWT + HttpOnly cookie + RBAC | Phase 6 |
| **Branch Management** | `system/branch.php` (Basic CRUD) | Isolated multi-branch API + Dashboard | Phase 5 |
| **Staff & Roles** | `system/staff.php` (`facility` table) | Centralized Role & Permission Engine | Phase 6 |
| **Product & Price Control** | `system/stocks.php`, `sub/edit-stock.php` | Admin-Only Price Protected API | Phase 12 |
| **Stock Tracking** | `system/stocks.php`, `track-stock.php` | Immutable Movement Ledger (`stock_movements`) | Phase 8 |
| **Supplier Stock Receipts**| `purchase_history` | Formal Stock Receipts with History | Phase 9 |
| **Point of Sale (Sales)** | `front/cart.php`, `system/order.php` | Branch-Scoped Atomic POS Engine | Phase 7 |
| **Credit & Debts** | `system/credit.php`, `outstand` | Customer Balance & Credit Ledger | Phase 7 |
| **Receipts & Thermal Print**| `invoice.php` (80mm CSS print) | 80mm Web Print + Web Bluetooth ESC/POS | Phase 10 |
| **Inter-Branch Shipping** | None (only store conversions) | Audited Multi-Status Shipping Workflow | Phase 11 |
| **Audit Logging** | None | Centralized `audit_logs` table & tracker | Phase 6-12 |
| **Management Center** | None | Unified Admin Hub with Auth Bridge to legacy | **v1.4.0 ✅** |
| **Auth Bridge** | None | Secure single-use session handoff ticket system | **v1.4.0 ✅** |
| **Dev Orchestrator** | None | MySQL health check + Apache Mode A/B + pre-flight | **v1.4.0 ✅** |

---

## 7. Unified Application Architecture (v1.4.0)

### 7.1 Strangler Fig Pattern — Evolution

The system has evolved from a **fully split dual-entry** architecture (React on port 5173, PHP on port 80, accessed separately) to a **unified single-entry-point** architecture where `http://localhost:5173` is the only gateway.

```
v1.3.x (Split — Two entry points)
────────────────────────────────────────────────────
Browser → http://localhost:5173    (React SPA)
Browser → http://localhost/murg/   (PHP legacy — separate login)

v1.4.0 (Unified — Single entry point)
────────────────────────────────────────────────────
Browser → http://localhost:5173    (ONLY entry point)
              │
              ├──/api/*           → Node.js :5000  (REST API)
              ├──/system/*        → Apache :80      (PHP Admin panel)
              ├──/sub/*           → Apache :80      (PHP Manager panel)
              ├──/assets/*        → Apache :80      (Shared CSS/JS)
              ├──/auth_bridge.php → Apache :80      (Session bridge)
              └──/* (SPA)         → Vite            (React components)
```

### 7.2 Unified Architecture Diagram

```
                    ┌─────────────────────────────────────────┐
                    │         Browser (Port 5173)             │
                    │  React SPA — all traffic enters here    │
                    └─────────────────────────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │        Vite Dev Server (Port 5173)      │
                    │         Proxy Gateway + React HMR       │
                    └────┬───────────────────────────────┬────┘
                         │                               │
           /api/* proxy  │                  /system,     │
                         │                  /sub,        │
                         ▼                  /assets etc  ▼
          ┌──────────────────────┐    ┌──────────────────────┐
          │  Node.js / Express   │    │   Apache / PHP       │
          │     Port 5000        │    │     Port 80          │
          │                      │    │                      │
          │  REST API            │    │  /murg/system/       │
          │  JWT Auth            │    │  /murg/sub/          │
          │  Branch Isolation    │    │  /murg/front/        │
          │  Bridge Ticket Gen   │    │  auth_bridge.php     │
          └──────────┬───────────┘    └───────────┬──────────┘
                     │                            │
                     └──────────┬─────────────────┘
                                │ (Both connect to same DB)
                    ┌───────────▼─────────────────┐
                    │     MySQL / MariaDB          │
                    │     Port 3306               │
                    │     Database: murg           │
                    └─────────────────────────────┘
```

### 7.3 Node / PHP Boundary — System Ownership

| Concern | Owner | Technology |
|---------|-------|-----------|
| User authentication (login) | Node.js | JWT, bcrypt/MD5 dual-verify |
| Session management (legacy pages) | PHP | `$_SESSION` + PHPSESSID cookie |
| Session bridge (Node → PHP handoff) | Auth Bridge | Single-use ticket, MySQL transaction |
| Product catalog, pricing | Node.js | REST API + `requireAdminPriceControl` |
| Branch management | Node.js | REST API + branch isolation middleware |
| Stock movements ledger | Node.js | Immutable `stock_movements` table |
| Shipments | Node.js | State machine API |
| Audit logging | Node.js | `audit_logs` table, auto-written on mutations |
| Legacy sales/POS | PHP | `/front/cart.php`, `/front/checkout.php` |
| Legacy supplier records | PHP | `/system/` purchase history |
| Legacy reports | PHP | `/system/reports/` |
| Static assets (CSS/JS) | Apache | `/assets/`, `/bootstrap/`, `/plugins/` |
| Database connection | Both | Node via `mysql2/promise` pool; PHP via `mysqli` in `gyada.php` |

### 7.4 Auth Bridge Architecture

The Auth Bridge is the **only** sanctioned mechanism to transfer a verified Node.js JWT session into a PHP `$_SESSION`. It uses a **single-use, short-lived, user-bound ticket** stored in MySQL.

```
React (Authenticated User)
       │
       │  POST /api/management/bridge-ticket
       │  { destination: "/system/expense.php" }
       ▼
Node.js Controller (managementController.js)
       │  1. Verify JWT — user must be authenticated
       │  2. Validate destination against server-side allowlist
       │     - Admin: /system/* and /sub/*
       │     - Staff: /sub/* only
       │  3. crypto.randomBytes(32).toString('hex') → 64-char ticket
       │  4. INSERT auth_bridge_tickets (ticket, user_id, role, expires_at = NOW()+60s)
       │
       │  Returns: { ticket: "a3f9...", url: "/auth_bridge.php?ticket=a3f9..." }
       ▼
Browser opens tab → GET /auth_bridge.php?ticket=a3f9...
       │
       ▼
Vite Proxy → Apache :80 → auth_bridge.php
       │  1. Validate ticket format (64-char hex)
       │  2. BEGIN TRANSACTION; SELECT ... FOR UPDATE (atomic row lock)
       │  3. Check: consumed = 0, expires_at > NOW(), ticket exists
       │  4. UPDATE auth_bridge_tickets SET consumed = 1, consumed_at = NOW()
       │  5. COMMIT
       │  6. Fetch user from facility WHERE id = ? AND status = 1
       │  7. Validate destination against PHP-side allowlist (same rules)
       │  8. session_start(); populate $_SESSION keys
       │  9. Redirect → destination URL
       ▼
Legacy PHP Page (e.g. /system/expense.php)
       │  - Checks $_SESSION['email'] (not empty → authorized)
       │  - PHP authorization remains FULLY ACTIVE
       │  - Bridge does NOT bypass any PHP permission checks
       ▼
Page renders normally
```

**Security Properties:**
- **Single-use**: `consumed = 1` set atomically with `FOR UPDATE` — replay attacks return `403`
- **Short-lived**: `expires_at = NOW() + INTERVAL 60 SECOND` — stale tickets return `403`
- **User-bound**: Ticket stores `user_id`, `role`, `email` — cannot be used by a different user
- **Destination allowlisted**: Both Node.js (issuance) and PHP (consumption) validate against identical allowlists
- **No PHP auth bypass**: Bridge only sets `$_SESSION`; every legacy PHP page still checks session validity independently

### 7.5 Development Orchestrator

`scripts/dev-orchestrator.js` replaces the old `concurrently` command with a smart startup sequence:

```
npm run dev
    │
    ├─ [1/3] TCP health check → localhost:3306
    │         PASS: MySQL online → continue
    │         FAIL: Abort with actionable error (never auto-starts MySQL)
    │
    ├─ [2/3] TCP probe → localhost:80
    │         Port 80 ACTIVE  → Mode B (connect to existing XAMPP Apache)
    │         Port 80 FREE    → Mode A (spawn httpd.exe, wait 1.5s)
    │
    ├─ [3/3] node backend/scripts/check-db-columns.js
    │         Verifies: facility columns (migration 001+002)
    │         Verifies: auth_bridge_tickets table (migration 003)
    │         FAIL: Abort with migration instructions
    │
    └─ Launch concurrently:
          nodemon backend/server.js    → Port 5000
          vite --config frontend/...  → Port 5173
```

### 7.6 Production Deployment Notes

In production (no Vite dev server), the proxy gateway must be replicated at the web server level:

**Nginx example:**
```nginx
server {
    listen 443 ssl;
    server_name murg.example.com;

    # React SPA (built assets)
    root /var/www/murg/frontend/dist;
    try_files $uri $uri/ /index.html;

    # Node.js API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Auth Bridge
    location /auth_bridge {
        proxy_pass http://127.0.0.1:80/murg/auth_bridge.php;
        proxy_cookie_path /murg/ /;
    }

    # Legacy PHP (via Apache on 127.0.0.1:80)
    location ~ ^/(system|sub|front|assets|bootstrap|plugins)/ {
        proxy_pass http://127.0.0.1:80/murg$request_uri;
        proxy_cookie_path /murg/ /;
        proxy_set_header Host $host;
    }
}
```

> **Cookie path rewriting** (`proxy_cookie_path /murg/ /`) is mandatory in production to ensure PHPSESSID cookies are valid across the unified domain.

