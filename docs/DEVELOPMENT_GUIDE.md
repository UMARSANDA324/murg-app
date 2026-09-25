# Developer Setup & Contribution Guide

## 1. Prerequisites & Tooling

| Requirement | Version | Purpose |
|---|---|---|
| **XAMPP** | Any recent | Apache (PHP runtime) + MySQL on port 3306 |
| **PHP** | 8.0+ (tested 8.0.30) | Legacy PHP application (`/system`, `/sub`, `/front`) |
| **Node.js** | v20+ (tested v24) | Express API backend + npm tooling |
| **npm** | 11+ | Package management |
| **Browser** | Any modern | `http://localhost:5173` (unified React gateway) |

> **Windows**: All paths below assume XAMPP installed at `C:\xampp\`.

---

## 2. One-Command Local Development

### 2.1 First-Time Setup

**Step 1 — Start MySQL manually via XAMPP**

Open the XAMPP Control Panel and start **MySQL** (port 3306).

> ⚠️ **MySQL must be running before `npm run dev`**. The development orchestrator will check for MySQL connectivity and **abort with a clear error message** if MySQL is unavailable. It will **never** attempt to auto-start MySQL for you.

Apache start-up is handled automatically by the orchestrator (see [Section 2.3 — Apache Mode A vs Mode B](#23-apache-mode-a-vs-mode-b)).

**Step 2 — Apply database migrations (first time only)**

If this is a fresh local clone, apply all additive migrations in order:

```powershell
# Migration 001 — Multi-branch, stock ledger, shipments, audit logs
mysql -u root murg < C:\xampp\htdocs\murg\database\migrations\001_multibranch_and_stock_ledger.sql

# Migration 002 — Branch sales modes, per-yard pricing, stock extensions
mysql -u root murg < C:\xampp\htdocs\murg\database\migrations\002_branch_sales_modes_and_stock.sql

# Migration 003 — Auth bridge tickets table (single-use, short-lived session handoff)
mysql -u root murg < C:\xampp\htdocs\murg\database\migrations\003_auth_bridge_and_management.sql
```

All migrations are **non-destructive** — existing data is fully preserved.

To verify migration 001:
```powershell
mysql -u root -e "DESCRIBE murg.facility;" | Select-String "password_hash"
```

To verify migration 003:
```powershell
mysql -u root -e "SHOW TABLES FROM murg;" | Select-String "auth_bridge_tickets"
```

You can also run the Node.js migration helper for migration 003:
```powershell
cd C:\xampp\htdocs\murg
node backend/scripts/run-migration-003.js
```

**Step 3 — Configure backend environment**

If `backend/.env` does not exist, create it:
```powershell
Copy-Item backend\.env.example backend\.env   # if .env.example exists
# OR create manually:
```
```env
PORT=5000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=murg
DB_USER=root
DB_PASS=
JWT_SECRET=any_long_random_string_here_change_in_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

> See `.env.example` at the project root for a full reference of all variables.

**Step 4 — Install all dependencies (first time only)**

From the **project root** (`C:\xampp\htdocs\murg\`):
```powershell
npm run install:all
```

This installs backend, frontend, and root orchestrator dependencies.

---

### 2.2 Daily Development Startup

**Only two steps needed each session:**

```powershell
# 1. Start MySQL via the XAMPP Control Panel (port 3306)

# 2. From the project root:
cd C:\xampp\htdocs\murg
npm run dev
```

The orchestrator performs the following startup sequence:

```
[1/3] MySQL health check ............... ONLINE ✓
[2/3] Apache detection ................. Mode B (ACTIVE) ✓   (or Mode A)
[3/3] DB schema pre-flight ............. PASS ✓
[API]  [MURG Backend API] Server listening on http://localhost:5000
[REACT] VITE ready → http://localhost:5173/
```

**`http://localhost:5173` is the single entry point for all development.**
The Vite gateway transparently proxies all API, legacy PHP, and static asset requests.

---

### 2.3 Apache Mode A vs Mode B

The orchestrator detects which Apache mode to use at startup — no manual configuration needed.

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Mode B** (recommended) | Apache already running on port 80 (XAMPP started manually) | Orchestrator connects to existing Apache. No process spawned. |
| **Mode A** | Port 80 is free | Orchestrator spawns `C:\xampp\apache\bin\httpd.exe` automatically. |

**Mode B is preferred for stability.** If you prefer to start Apache manually via the XAMPP Control Panel, do so before running `npm run dev`.

If the orchestrator exits with `[APACHE] Failed to start` in Mode A, open the XAMPP Control Panel and start Apache manually, then re-run `npm run dev`.

---

### 2.4 Service Port Map

| Port | Service | Purpose |
|------|---------|---------|
| **5173** | Vite Dev Server (React) | **Primary gateway** — all browser traffic in development |
| **5000** | Node.js / Express API | REST API (proxied from 5173 via `/api/*`) |
| **80** | Apache / PHP | Legacy PHP application (proxied from 5173 via `/system`, `/sub`, `/assets`, etc.) |
| **3306** | MySQL / MariaDB | Shared database (accessed by both Node.js and PHP directly) |

> In development, **never** access port 5000 or port 80 directly from the browser. Always use `http://localhost:5173`.

---

### 2.5 Vite Proxy Gateway

The Vite development server routes requests as follows:

| Path Pattern | Proxied To | Purpose |
|---|---|---|
| `/api/*` | `http://localhost:5000` | Node.js / Express REST API |
| `/system/*` | `http://localhost/murg` | Legacy PHP Admin panel |
| `/sub/*` | `http://localhost/murg` | Legacy PHP Branch Manager panel |
| `/assets/*` | `http://localhost/murg` | Shared CSS/JS/vendor assets |
| `/bootstrap/*` | `http://localhost/murg` | Bootstrap distribution files |
| `/plugins/*` | `http://localhost/murg` | jQuery and DataTables plugins |
| `/auth_bridge.php` | `http://localhost/murg` | Auth bridge (query string preserved) |
| `/auth_bridge` | `http://localhost/murg` | Auth bridge (extensionless form, htaccess alias) |
| `/murg/*` | `http://localhost` | Direct legacy root path fallback |

All proxied PHP responses have `cookiePathRewrite` applied so that `PHPSESSID` cookies are returned with `path=/` (compatible with the port 5173 origin).

---

### 2.6 Accessing the Applications

| Application | URL | Description |
|---|---|---|
| **React SPA** (primary) | `http://localhost:5173` | Modern React frontend — unified entry point |
| **Management Center** | `http://localhost:5173/management` | Admin-only hub with legacy module launcher |
| **Node.js API** | `http://localhost:5173/api` | REST API (via Vite proxy) |
| **API health check** | `http://localhost:5173/api/health` | Confirms API is running |
| **Legacy PHP Admin** | `http://localhost/murg/system/` | Direct XAMPP access (bypasses proxy; for diagnostics) |
| **Legacy PHP Manager** | `http://localhost/murg/sub/` | Direct XAMPP access (bypasses proxy; for diagnostics) |
| **Legacy PHP Cashier** | `http://localhost/murg/front/` | Direct XAMPP access (bypasses proxy; for diagnostics) |

> Direct XAMPP access URLs (`http://localhost/murg/...`) require you to be already logged into the PHP session. Use the **Management Center** in the React app to launch legacy modules via the secure Auth Bridge.

---

## 3. Diagnosing Common Problems

### Problem: `npm run dev` fails immediately — `[MYSQL] UNREACHABLE`

MySQL is not running. The orchestrator performs a TCP health check on port 3306 and aborts if MySQL is down. **Start MySQL via the XAMPP Control Panel**, then re-run `npm run dev`.

> The orchestrator will **never** start MySQL automatically. This is by design — auto-starting `mysqld.exe` can conflict with XAMPP's own MySQL instance and corrupt data.

### Problem: `POST /api/auth/login` returns 401

Check the **backend terminal output** — the server logs exactly why login failed:

| Log Message | Meaning | Fix |
|---|---|---|
| `AUTH_LOGIN_FAILED: user_not_found` | Email not in `facility` table | Check the email — use the correct account |
| `AUTH_LOGIN_FAILED: account_suspended` | `facility.status = 0` | Re-activate the account in MySQL/PHP admin |
| `AUTH_LOGIN_FAILED: password_mismatch` | Wrong password | Use the correct password |
| `AUTH_LOGIN_FAILED: DB error — code: MISSING_COLUMNS` | Migration 001 not applied | Run migration (Step 2 in setup above) |
| `AUTH_LOGIN_FAILED: DB error — code: DB_QUERY_FAILED` | MySQL is down | Start XAMPP MySQL |

**The browser always receives the safe generic message:** `"Invalid email or password"` — sensitive details only appear in the server terminal.

### Problem: Legacy PHP page shows login redirect after launching from Management Center

The Auth Bridge ticket may have expired (60-second TTL) or already been consumed (single-use). Click the launch button again to generate a fresh ticket.

If the issue persists, confirm that:
1. Apache is running (port 80 accessible)
2. Migration 003 has been applied (`auth_bridge_tickets` table exists)
3. The `auth_bridge.php` file is at `C:\xampp\htdocs\murg\auth_bridge.php`

### Problem: `[DB-CHECK] ✗ CANNOT CONNECT TO MYSQL`

MySQL is not running. Open XAMPP Control Panel and start MySQL.

### Problem: React shows a blank page or 404

Ensure `npm run dev` is running from the project root. Check that port 5173 (React) and port 5000 (API) are both active.

### Problem: `npm run dev` starts but API process exits immediately

Check the backend terminal for a clear error message. Most commonly:
- Missing `backend/.env` file
- Syntax error in `backend/src/`

---

## 4. Build & Production

```powershell
# Build the React frontend (outputs to frontend/dist/)
npm run build

# Start the production API server
npm start
```

In production, serve `frontend/dist/` as a static site behind the same domain as the API, or configure Apache/Nginx to proxy `/api/*` to the Node server and serve `frontend/dist/` for all other routes.

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for full production deployment and rollback instructions.

---

## 5. Engineering Rules (Non-Negotiable)

### Rule 1: Backward Compatibility is Non-Negotiable
- Never rename or drop existing MySQL columns without an explicit, staged migration.
- New tables must not break existing PHP queries.
- All schema changes go in numbered migration files under `database/migrations/`.

### Rule 2: Strict Admin-Only Price Protection
- Never allow any non-Admin role to alter `buying` or `selling` prices.
- The `requireAdminPriceControl` middleware must be applied to every price modification endpoint.
- Every price change must write to `audit_logs`.

### Rule 3: Branch Data Isolation
- Branch users must never view, query, or mutate records of another branch.
- Enforce `WHERE facilityID = ?` at the repository level using verified JWT token claims.
- Never trust `branchId` from the request body or query string.

### Rule 4: Atomic Transactions for State Changes
- Any operation modifying multiple tables (order + inventory + debt ledger) must use `BEGIN TRANSACTION / COMMIT / ROLLBACK`.
- Never decrement inventory when an item is added to cart — only on confirmed checkout.

### Rule 5: No Passwords in Logs
- Never log: passwords, password hashes, JWT secrets, API keys, or database credentials.
- Internal auth failure reasons are logged by error code and user ID only.

### Rule 6: MySQL Must Never Be Auto-Started
- The development orchestrator must never call `mysqld.exe` or any equivalent to start MySQL.
- MySQL startup is exclusively the responsibility of the developer via XAMPP Control Panel or Windows Service Manager.
- If MySQL is down, `npm run dev` must abort immediately with a clear, actionable error message.

### Rule 7: Auth Bridge Tickets Are Single-Use
- Never re-use or cache auth bridge tickets.
- Each ticket must be consumed atomically (MySQL `FOR UPDATE` row lock) and marked as consumed before the PHP session is established.
- Expired or already-consumed tickets must be rejected with `403 Forbidden`.

---

## 6. Database Schema Changes

Before ANY schema modification:
1. Take a backup: `mysqldump -u root murg > database/backup_murg_YYYYMMDD.sql`
2. Write the change as a numbered migration file in `database/migrations/`
3. Test against a local copy first
4. Document the change in `docs/DATABASE.md` and `docs/CHANGELOG.md`
