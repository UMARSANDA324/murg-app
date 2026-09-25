# Authentication, Roles & Permissions Architecture

## 1. Existing Legacy Authentication System

### 1.1 How It Works Today

In the legacy PHP application, authentication is handled via a combination of jQuery AJAX, session cookies, and database lookups in `dologin.php`.

1. **Credentials**: The user supplies an `email` and plain-text `password`.
2. **Hashing**: The password is hashed using legacy `md5()`:
   ```php
   $pass = md5($password);
   $query = $con->query("SELECT * FROM facility WHERE email='$email' AND password='$pass'");
   ```
3. **Session Variables**: Upon a matching row, the PHP session (`$_SESSION`) is populated:
   * `$_SESSION["id"]`: Integer primary key of the user (`facility.id`)
   * `$_SESSION["email"]`: User email
   * `$_SESSION["phone"]`: User phone number
   * `$_SESSION["name"]`: User display name
   * `$_SESSION["fname"]`: Business / facility name
   * `$_SESSION["role"]`: String identifier (`Admin`, `Sub-admin`, `Staff`)
   * `$_SESSION["facilityID"]`: Branch code to which user belongs (e.g., `MURG/001`)
   * `$_SESSION["address"]`: User address
4. **Redirection by Role**:
   * `Admin` $\to$ `/system/` (Full administrative dashboard)
   * `Sub-admin` $\to$ `/sub/` (Branch Manager dashboard)
   * `Staff` $\to$ `/front/` (Cashier point-of-sale interface)
5. **Account Status Check**:
   * If `status === 0`, login is blocked with "Account Suspended Contact System Admin".

### 1.2 Legacy Role Hierarchy & File Boundaries

| Legacy Role | UI Directory | Real-World Role | Legacy Capabilities |
|---|---|---|---|
| `Admin` | `/system/` | Global Administrator / Owner | Global visibility, user management, store creation, purchase records, reports. |
| `Sub-admin` | `/sub/` | Branch Manager | Branch sales view, branch stock updates, debt viewing, branch reports. |
| `Staff` | `/front/` | Cashier / Sales Assistant | POS checkout, customer debt cart, cash/POS/transfer receipts, order returns. |

---

## 2. Weaknesses in the Legacy Auth System

1. **MD5 Vulnerability**: Passwords hashed with standard MD5 without salt are vulnerable to rainbow table attacks.
2. **Insecure Authorization Boundaries**:
   * Each page in `/system/`, `/sub/`, and `/front/` only checks `if (strlen($_SESSION['email']) == 0) header('location:../index.php');`.
   * An authenticated `Staff` user who directly browses to `/system/stocks.php` or `/sub/edit-stock.php` can view and manipulate admin pages if their session is active.
3. **Unprotected Price Modification**:
   * `/sub/edit-stock.php` directly updates `selling` and `buying` prices in SQL without verifying if the user has price change authority.
4. **Rigid Hardcoded Roles**:
   * Permissions are tied directly to hardcoded role strings rather than a granular permission model.

---

## 3. Modernized Authorization Engine (Node.js API + React)

### 3.1 Security Core Principles
1. **The Server is the Only Security Boundary**: The frontend UI merely adapts to user permissions for UX purposes; every Node.js endpoint independently verifies identity, role, permission, and branch access.
2. **Zero-Trust Client Input**: Never trust `role`, `permissions`, or `branchId` passed in the request body or query string. Extract verified claims solely from the validated server-side token or session.
3. **Strict Price Protection (Admin Only)**: Only verified global `Admin` users can alter product selling or buying prices.

---

## 4. Role & Permission Model

```
                    +-------------------+
                    |    Permissions    |
                    | (Granular Actions)|
                    +-------------------+
                              ^
                              | (M:N)
                    +-------------------+
                    |       Roles       |
                    | Admin/Manager/... |
                    +-------------------+
                              ^
                              | (Assigned to)
                    +-------------------+
                    |    User/Staff     |
                    +-------------------+
                              | (Scoped to)
                              v
                    +-------------------+
                    |      Branch       |
                    +-------------------+
```

### 4.1 Granular Permissions Matrix

| Permission Key | Description | Global Admin | Branch Manager | Sales Staff / Cashier | Stock Staff |
|---|---|:---:|:---:|:---:|:---:|
| `view_global_dashboard` | View metrics across all branches | Yes | No | No | No |
| `manage_branches` | Create, edit, activate/deactivate branches | Yes | No | No | No |
| `manage_staff` | Create staff, change roles, assign branches | Yes | No | No | No |
| `change_product_price` | Alter product buying/selling prices | **Yes Only** | **No** | **No** | **No** |
| `view_branch_dashboard` | View branch operational dashboard | Yes | Yes | No | No |
| `create_sale` | Operate POS terminal and record sales | Yes | Yes | Yes | No |
| `view_sales` | View sales history within branch | Yes | Yes | Yes | No |
| `manage_debts` | Record credit sales and accept deposits | Yes | Yes | Yes | No |
| `view_debts` | View customer debt balances & deposit history| Yes | Yes | Yes | No |
| `print_receipts` | Print thermal receipts & invoices | Yes | Yes | Yes | Yes |
| `receive_supplier_stock`| Record incoming supplier stock receipts | Yes | Yes | No | Yes |
| `view_stock` | View inventory balances in branch | Yes | Yes | Yes | Yes |
| `adjust_stock` | Record damage, loss, or count corrections | Yes | Yes | No | Yes |
| `create_shipment` | Initiate inter-branch stock shipment | Yes | Yes | No | Yes |
| `receive_shipment` | Inspect & receive incoming shipment | Yes | Yes | No | Yes |
| `view_audit_logs` | Inspect system security & audit trail | Yes | No | No | No |

---

## 5. Token & Session Design (Dual-Compatibility)

### 5.1 Authentication Flow

1. **POST `/api/auth/login`**:
   - Accepts `{ email, password }`.
   - Fetches user from `facility WHERE email = ?`.
   - Verifies password using dual-layer fallback:
     1. If `password_hash` is present, checks with `bcrypt.compare(password, user.password_hash)`.
     2. If bcrypt comparison fails OR `password_hash` is NULL: falls back to compare `md5(password) === user.password`.
        - **Why this fallback is essential**: If a user updates their password in the legacy PHP system (`system/edit-staff.php`, `front/profile.php`), PHP updates `facility.password = md5(...)` and leaves `password_hash` untouched. The fallback ensures the user is never locked out of the Node application.
     3. On successful MD5 match, automatically re-hashes the password using `bcrypt` (12 rounds) and saves it into `facility.password_hash` for future logins. The existing `password` column is preserved for PHP compatibility.
     4. If both bcrypt and MD5 fail, returns a safe generic `401 Unauthorized` (`Invalid email or password`) while logging the internal failure diagnostic (`AUTH_LOGIN_FAILED`).
   - Generates a signed **JWT**:
     ```json
     {
       "sub": 4,
       "name": "Alh Yasir",
       "email": "yasir@gmail.com",
       "role": "Admin",
       "facilityID": "MURG/001",
       "isGlobalAdmin": true,
       "permissions": ["*"]
     }
     ```
   - Returns the token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie and standard JSON response for API consumers.

2. **Automated Test Isolation**:
   - Automated tests (`backend/tests/api.test.js`) generate isolated temporary test users (`%@murg.test`) and delete them in teardown.
   - Test suites MUST NEVER mutate or reset live production user rows (`id: 4`, `id: 6`).

### 5.2 Branch Scope Middleware (`requireBranchScope`)

```javascript
// middleware/branchScope.js
function requireBranchScope(req, res, next) {
  const user = req.user;
  const targetBranch = req.params.branchId || req.query.branchId || req.body.facilityID;

  // 1. Global Admin has universal access to all branches
  if (user.isGlobalAdmin || user.role === 'Admin') {
    req.branchId = targetBranch || user.facilityID;
    return next();
  }

  // 2. Branch users are strictly locked to their assigned facilityID
  if (!targetBranch || targetBranch === user.facilityID) {
    req.branchId = user.facilityID;
    return next();
  }

  // 3. Unauthorized access attempt across branch boundary
  return res.status(403).json({
    success: false,
    message: "Access Denied: You do not have permission to view or modify data for this branch."
  });
}
```

### 5.3 Price Protection Middleware (`requireAdminPriceControl`)

```javascript
// middleware/priceControl.js
function requireAdminPriceControl(req, res, next) {
  const user = req.user;

  // Reject any price change if user is not verified Global Admin
  if (user.role !== 'Admin' && !user.permissions?.includes('change_product_price')) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Only Global Administrator is authorized to modify product prices."
    });
  }
  next();
}
```

---

## 6. Auth Bridge Security Model (v1.4.0)

### 6.1 Overview

The Auth Bridge is the **only** sanctioned mechanism to launch legacy PHP modules (in `/system/` or `/sub/`) from the React application. It transfers a verified Node.js JWT identity into a PHP `$_SESSION` without exposing credentials or sharing session state directly between the two auth systems.

**Key principle**: The bridge provides *identity* only. It does **not** grant elevated access. All existing PHP authorization checks remain fully active after the bridge sets the session.

### 6.2 Ticket Lifecycle

| Stage | Location | Action |
|-------|----------|--------|
| **Issuance** | Node.js (`managementController.js`) | JWT verified → destination allowlisted → `crypto.randomBytes(32)` ticket generated → stored in `auth_bridge_tickets` with 60s TTL |
| **Delivery** | React frontend | Ticket URL opened in a new browser tab |
| **Consumption** | PHP (`auth_bridge.php`) | Ticket format validated → atomic `FOR UPDATE` row lock → expiry checked → `consumed = 1` set → `$_SESSION` populated → redirect to destination |
| **Post-use** | MySQL | `consumed = 1`, `consumed_at` timestamp recorded — ticket is permanently invalidated |

### 6.3 `auth_bridge_tickets` Table Schema

```sql
CREATE TABLE auth_bridge_tickets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket      VARCHAR(64) NOT NULL UNIQUE,     -- 64-char hex (32 random bytes)
  user_id     INT NOT NULL,                     -- facility.id of the requesting user
  facilityID  VARCHAR(50),                      -- Branch code (e.g. MURG/001)
  role        VARCHAR(20) NOT NULL,             -- Admin | Sub-admin | Staff
  email       VARCHAR(255) NOT NULL,            -- For session hydration
  name        VARCHAR(255),                     -- For session hydration
  target_path VARCHAR(500) NOT NULL,            -- Allowlisted destination path
  consumed    TINYINT(1) NOT NULL DEFAULT 0,    -- 0 = unused, 1 = consumed
  consumed_at DATETIME DEFAULT NULL,            -- When it was used
  expires_at  DATETIME NOT NULL,                -- created_at + 60 seconds
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 6.4 Destination Allowlists

The allowlists are defined **identically** in two places. Both must agree — discrepancy is a security defect.

**Node.js side** (`backend/src/controllers/managementController.js`):
```javascript
const ADMIN_ALLOWED_DESTINATIONS = [
  '/system/', '/system/expense.php', '/system/purchase.php',
  '/system/stocks.php', '/system/report.php', '/system/order.php',
  '/system/branch.php', '/system/staff.php',
  '/sub/', '/sub/expense.php', '/sub/stock.php',
];
const STAFF_ALLOWED_DESTINATIONS = [
  '/sub/', '/sub/expense.php', '/sub/stock.php',
];
```

**PHP side** (`auth_bridge.php`):
```php
$admin_allowed = ['/system/', '/sub/', /* ... same list ... */];
$staff_allowed = ['/sub/', /* ... same list ... */];
```

**Validation logic (both sides):**
1. Reject empty, external (starting with `http://`, `https://`, `//`), or protocol-relative URLs.
2. Check that `target_path` exactly matches or starts with an entry in the user's role-appropriate allowlist.
3. Admin → `ADMIN_ALLOWED_DESTINATIONS`; Sub-admin / Staff → `STAFF_ALLOWED_DESTINATIONS`.

### 6.5 PHP Session Keys Set by the Bridge

After consuming a valid ticket, `auth_bridge.php` populates `$_SESSION` with the **exact same keys** that `dologin.php` sets, ensuring full compatibility with all legacy PHP pages:

| `$_SESSION` Key | Source | Example Value |
|---|---|---|
| `id` | `facility.id` | `4` |
| `email` | `facility.email` | `yasir@gmail.com` |
| `phone` | `facility.phone` | `08012345678` |
| `role` | `facility.role` | `Admin` |
| `name` | `facility.name` | `Alh Yasir` |
| `fname` | `facility.fname` | `MURG Textile` |
| `facilityID` | `facility.facilityID` | `MURG/001` |
| `address` | `facility.address` | `Kano, Nigeria` |
| `type` | `facility.type` | `Admin` |

### 6.6 Atomic Ticket Consumption (Replay Prevention)

Ticket consumption is performed inside a MySQL transaction with a row-level lock:

```php
// In auth_bridge.php
$con->begin_transaction();
$result = $con->query("SELECT * FROM auth_bridge_tickets WHERE ticket = '$ticket' FOR UPDATE");
// ... validate consumed = 0 and expires_at > NOW() ...
$con->query("UPDATE auth_bridge_tickets SET consumed = 1, consumed_at = NOW() WHERE ticket = '$ticket'");
$con->commit();
```

The `FOR UPDATE` lock ensures that even if two concurrent requests arrive with the same ticket (e.g., a double-click), only one will succeed — the second will find `consumed = 1` and return `403 Forbidden`.

### 6.7 MySQL Startup Policy

> **MySQL must NEVER be auto-started by the development toolchain.**

The development orchestrator (`scripts/dev-orchestrator.js`) performs a **read-only TCP health check** on port 3306. It does not call `mysqld.exe`, `mysql_start.bat`, or any equivalent.

| Condition | Orchestrator Behavior |
|-----------|----------------------|
| MySQL reachable (port 3306 open) | Continue startup normally |
| MySQL unreachable | **Abort immediately** with actionable error: "Start MySQL manually via XAMPP Control Panel" |

**Rationale**: Auto-starting MySQL from npm scripts can conflict with XAMPP's own MySQL instance, leading to port conflicts, data file corruption, or duplicate daemon processes. MySQL is a system service — its lifecycle must be managed by the developer, not build tooling.

### 6.8 PHP Authorization Chain (Bridge Does NOT Bypass It)

```
Bridge sets $_SESSION
        │
        ▼
Redirect → /system/expense.php
        │
        ▼
expense.php line 1: if (strlen($_SESSION['email']) == 0) header('location:../index.php');
        │
        ├── $_SESSION['email'] empty?  → Redirect to login (bridge failed silently)
        │
        └── $_SESSION['email'] present → Page continues rendering
                   │
                   ▼
              Page may also check:
              - $_SESSION['role'] === 'Admin' for admin-only sections
              - $_SESSION['facilityID'] for branch-scoped queries
```

The bridge's session hydration is equivalent to a successful `dologin.php` login. The full PHP authorization chain — including every role check, session check, and query-level branch scoping in every legacy page — remains active and unmodified.

### 6.9 Known Limitations

| Limitation | Impact | Workaround |
|---|---|---|
| Bridge requires Apache to be running | If Apache is down, ticket consumption will fail with a network error | Start Apache via XAMPP Control Panel before launching legacy modules |
| Bridge is one-way only (Node → PHP) | PHP session changes are NOT reflected back into the Node JWT | None — PHP and Node maintain separate auth state |
| Ticket TTL is 60 seconds | If network is slow or user delays, ticket may expire before consumption | Click the launch button again to generate a fresh ticket |
| `auth_bridge_tickets` grows over time | Consumed/expired tickets accumulate | Run periodic cleanup: `DELETE FROM auth_bridge_tickets WHERE consumed = 1 OR expires_at < NOW()` |
| `.htaccess` extensionless redirect exclusion | `auth_bridge` must be excluded from the 301 redirect to preserve `?ticket=` query string | Already handled in `.htaccess` with `RewriteCond %{REQUEST_URI} !auth_bridge [NC]` |

---

## 7. XAMPP Fallback Procedure

If the React application is unavailable (e.g., Vite is not running), legacy PHP modules can still be accessed directly through XAMPP:

1. Open XAMPP Control Panel — confirm Apache and MySQL are both running (green).
2. Navigate directly to `http://localhost/murg/` in your browser.
3. Log in using your credentials on the legacy PHP login page.
4. You will be redirected to the appropriate legacy panel (`/system/`, `/sub/`, or `/front/`) based on your role.

This fallback bypasses the React application and the Auth Bridge entirely. The legacy PHP session auth system functions independently.

