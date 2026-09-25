# MURG REST API Specification (Node.js / Express)

## 1. Global API Conventions

* **Base URL**: `http://localhost:5000/api` (Production: `https://[domain]/api`)
* **Transport Format**: JSON (`Content-Type: application/json`)
* **Authentication**: HTTP Bearer Token in `Authorization: Bearer <JWT>` header or HTTP-only cookie.
* **Standard Response Envelope**:
  ```json
  {
    "success": true,
    "message": "Operation completed successfully",
    "data": { ... }
  }
  ```
* **Standard Error Envelope**:
  ```json
  {
    "success": false,
    "message": "Detailed error explanation",
    "errors": [ ... ]
  }
  ```

---

## 2. Authentication Endpoints

### `POST /api/auth/login`
Authenticates user using email and password (supporting both MD5 legacy and bcrypt).
* **Body**:
  ```json
  {
    "email": "yasir@gmail.com",
    "password": "user_password"
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOi...",
      "user": {
        "id": 4,
        "name": "Alh Yasir",
        "email": "yasir@gmail.com",
        "role": "Admin",
        "facilityID": "MURG/001",
        "isGlobalAdmin": true,
        "permissions": ["*"]
      }
    }
  }
  ```

### `GET /api/auth/me`
Fetches active user profile and permissions from validated token.

### `POST /api/auth/logout`
Clears session cookie and invalidates client session.

---

## 3. Branch Management (`/api/branches`)

### `GET /api/branches`
Lists all branches. (Global Admin sees all; Branch Staff receives their single assigned branch).
* **Access**: All authenticated users.

### `POST /api/branches`
Creates a new physical retail branch and auto-increments `conca.lastID`.
* **Access**: Global Admin only (`manage_branches`).
* **Body**:
  ```json
  {
    "name": "Sabon Gari Branch",
    "address": "45 France Road, Sabon Gari, Kano",
    "phone": "08012345678"
  }
  ```

### `GET /api/branches/:branchId/dashboard`
Fetches isolated operational metrics for the branch (Sales, Inventory, Debt balance, Active Staff).
* **Access**: Global Admin or Staff assigned to `:branchId`.

### `PATCH /api/branches/:branchId/status`
Activates or deactivates a branch.
* **Access**: Global Admin only.

---

## 4. Staff & Role Management (`/api/staff`)

### `GET /api/staff`
Lists staff members. Automatically filtered by `facilityID` unless user is Global Admin.
* **Query Params**: `?branchId=MURG/001&role=Staff`

### `POST /api/staff`
Registers a new staff member, associates them with a branch, and assigns role/permissions.
* **Access**: Global Admin only (`manage_staff`).
* **Body**:
  ```json
  {
    "name": "Musa Ibrahim",
    "email": "musa@gmail.com",
    "phone": "08033221100",
    "gender": "Male",
    "facilityID": "MURG/001",
    "role": "Staff",
    "password": "SecurePassword123"
  }
  ```

### `PATCH /api/staff/:id/role`
Updates role or branch assignment for a staff member.
* **Access**: Global Admin only.

---

## 5. Stock & Price Management (`/api/stocks`)

### `GET /api/stocks`
Lists product stocks scoped to the active branch and optional sub-store.
* **Query Params**: `?branchId=MURG/001&storeId=1&search=LAS+VEGAS`

### `PATCH /api/stocks/:id/price` (STRICT ADMIN ONLY)
Updates product selling or buying price.
* **Access**: Global Admin only (`change_product_price`).
* **Body**:
  ```json
  {
    "selling": 350000,
    "buying": 325000,
    "reason": "Manufacturer price update"
  }
  ```
* **Security Enforcement**: Server rejects with `403 Forbidden` if requested by non-Admin. Automatically logs change to `audit_logs`.

### `POST /api/stocks/receive`
Records new incoming stock from a supplier/dealer.
* **Body**:
  ```json
  {
    "branchId": "MURG/001",
    "storeId": 1,
    "productName": "SILVER CROWN",
    "supplierName": "U&ME Textiles",
    "unitType": "belt",
    "yardsPerBelt": 100,
    "quantity": 50,
    "costPrice": 420000,
    "amountPaid": 10000000,
    "notes": "Consignment #491"
  }
  ```

### `POST /api/stocks/:id/adjust`
Records inventory adjustments (damage, loss, count reconciliation).
* **Access**: Manager or Admin (`adjust_stock`).

### `GET /api/stocks/movements`
Fetches the immutable stock movement audit ledger.

---

## 6. Sales & POS Checkout (`/api/sales`)

### `POST /api/sales/checkout`
Executes an atomic checkout transaction:
1. Validates stock availability with row-level locks (`FOR UPDATE`).
2. Deducts quantity from `stocks`.
3. Inserts ledger rows into `stock_movements`.
4. Writes order records into `orders`.
5. Updates customer debt balance in `outstand` if credit order.
* **Body**:
  ```json
  {
    "branchId": "MURG/001",
    "storeId": 1,
    "customerId": 12,
    "buyerName": "Alhaji Bello",
    "isCredit": false,
    "items": [
      { "stockId": 1, "quantity": 2, "price": 340000, "discount": 10000 }
    ],
    "globalDiscount": 0,
    "payment": {
      "cash": 200000,
      "pos": 0,
      "transfer": 460000,
      "bankName": "Jaiz Bank"
    }
  }
  ```

### `GET /api/sales/:orderId/receipt`
Returns complete receipt data including dynamic branch profile and thermal formatting.

---

## 7. Inter-Branch Shipping (`/api/shipments`)

### `GET /api/shipments`
Lists outgoing and incoming transfers for the user's branch.

### `POST /api/shipments`
Creates and dispatches an inter-branch shipment:
* Decrements stock at source branch immediately (`movement_type = STOCK_OUT_TRANSFER`).
* Status transitions to `In Transit`.

### `POST /api/shipments/:id/receive`
Destination branch verifies physical goods:
* Increments stock at destination branch (`movement_type = STOCK_IN_TRANSFER`).
* Status transitions to `Received`.
* Discrepancies logged to `audit_logs`.

---

## 8. Customer Debts & Collections (`/api/customers`)

### `GET /api/customers`
Lists customers and current outstanding debt balances.

### `POST /api/customers/:id/deposits`
Records debt repayment deposit:
* Updates `outstand.balance`.
* Inserts audit record into `deposit_history` with `facilityID` branch association.
