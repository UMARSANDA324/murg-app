# MySQL to MongoDB Migration Plan

**Status:** Audit Phase - No Code Changes Yet
**Date:** 2026-09-27
**Goal:** Migrate MURG application from MySQL to MongoDB Atlas for Render deployment

---

## TASK 1: DATABASE AUDIT - COMPLETED

### Current MySQL Tables (from migrations and documentation)

#### Core Tables
1. **facility** - Users/staff accounts
   - Columns: id, facilityID, name, fname, email, phone, role, status, password (MD5 legacy), password_hash (bcrypt), permissions (JSON)
   - Indexes: email, facilityID

2. **branch** - Branch configurations
   - Columns: id, facilityID, name, address, phone, status, sales_mode (DEALER/PER_YARD), created_at
   - Indexes: facilityID (unique), sales_mode

3. **stores** - Physical store locations
   - Columns: id, store_name, branch_id, status
   - Indexes: branch_id

4. **stocks** - Inventory by branch/store
   - Columns: id, name, facilityID, store_id, quantity, buying, selling, unit_type, price_per_yard, yards_per_belt, status
   - Indexes: facilityID, store_id, name

5. **orders** - Sales orders
   - Columns: id, orderID, facilityID, stockID, item, quantity, subtotal, net_total, buyer_name, customer_name, customerID, payment, discount, amount_paid, cash, pos, transfer, bank_name, staff, status, creation
   - Indexes: orderID, facilityID, creation

6. **customers** - Customer records
   - Columns: id, name, phone, facilityID, address
   - Indexes: facilityID, phone

7. **outstand** - Outstanding debts
   - Columns: id, customerID, facilityID, balance, last_payment, last_payment_date
   - Indexes: customerID, facilityID

8. **deposit_history** - Debt repayments
   - Columns: id, customerID, facilityID, amount, payment_date, receipt_number
   - Indexes: customerID, facilityID

9. **purchase_history** - Supplier purchases
   - Columns: id, facilityID, stock_id, initial_quantity, purchaser, purchase_from, stock_name, quantity, cost_price, total_cost, amount_paid, balance, for_desc, purchase_date
   - Indexes: facilityID, purchase_date

10. **expense** - Branch expenses
    - Columns: id, facilityID, item, price, type, date
    - Indexes: facilityID, date

#### Additive Tables (from migrations)
11. **stock_movements** - Immutable inventory ledger
    - Columns: id, facilityID, store_id, stock_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by, created_at
    - Indexes: stock_id/facilityID, movement_type, created_at

12. **shipments** - Inter-branch transfers
    - Columns: id, tracking_number, source_branch, destination_branch, source_store_id, destination_store_id, status, dispatched_by, dispatched_at, received_by, received_at, notes, created_by, created_at
    - Indexes: source_branch/destination_branch, status

13. **shipment_items** - Shipment line items
    - Columns: id, shipment_id, stock_id, product_name, quantity_sent, quantity_received
    - Foreign Key: shipment_id → shipments.id (CASCADE DELETE)
    - Indexes: shipment_id

14. **audit_logs** - Security audit trail
    - Columns: id, facilityID, user_id, user_name, action, entity_type, entity_id, old_values (JSON), new_values (JSON), ip_address, user_agent, created_at
    - Indexes: action, user_id, entity_type/entity_id

15. **auth_bridge_tickets** - Legacy session handoff (deprecated)
    - Columns: id, ticket, user_id, facilityID, role, email, name, target_path, consumed, consumed_at, expires_at, created_at
    - Indexes: ticket, user_id, expires, consumed

16. **password_resets** - OTP reset workflow
    - Columns: id, user_id, email, otp_hash, reset_token, attempts, max_attempts, is_verified, is_used, expires_at, created_at
    - Indexes: email, user_id, reset_token, expires_at

17. **goods_requests** - Stock requests
    - Columns: id, request_code, staff_id, staff_name, requesting_branch, stock_id, product_name, requested_quantity, unit_type, reason, status, admin_notes, source_branch, shipment_id, reviewed_by, reviewed_at, created_at, updated_at
    - Indexes: request_code, staff_id, requesting_branch, status

18. **notifications** - In-app notifications
    - Columns: id, user_id, role_target, facility_id, title, message, type, reference_id, is_read, created_at
    - Indexes: user_id, role_target, facility_id, is_read

19. **shipment_receipts** - Receipt codes for transfers
    - Columns: id, receipt_code, shipment_id, request_id, source_branch, destination_branch, product_name, quantity, unit_type, dispatched_by, dispatched_by_name, consumed, consumed_at, created_at
    - Indexes: receipt_code (unique)

20. **conca** - Branch code counter
    - Columns: id, lastID

#### Legacy Tables (possibly unused)
- cart, debt_cart - Temporary POS carts
- order_items - Historical normalized order items (check usage)

---

## TASK 2: MYSQL TO MONGODB MAPPING

### Table → Collection Mapping

| MySQL Table | MongoDB Collection | Key Considerations |
|-------------|-------------------|-------------------|
| facility | users | Keep password_hash (bcrypt), facilityID as unique, permissions as JSON |
| branch | branches | facilityID as unique index, sales_mode enum |
| stores | stores | branch_id reference to branches |
| stocks | stocks | facilityID, store_id indexes, unit_type enum |
| orders | orders | orderID as compound index with facilityID, stock_id reference |
| customers | customers | facilityID index, phone index |
| outstand | debts | customerID reference, facilityID index |
| deposit_history | deposits | customerID reference, facilityID index |
| purchase_history | purchases | facilityID index, purchase_date index |
| expense | expenses | facilityID index, date index |
| stock_movements | stockMovements | stock_id/facilityID compound index, movement_type enum |
| shipments | shipments | source_branch/destination_branch compound index, status enum |
| shipment_items | shipmentItems | shipment_id reference (embedded or referenced) |
| audit_logs | auditLogs | user_id index, action index, entity_type/entity_id compound |
| password_resets | passwordResets | email index, reset_token index, expires_at TTL |
| goods_requests | goodsRequests | request_code unique, status enum, requesting_branch index |
| notifications | notifications | user_id index, facility_id index, is_read index |
| shipment_receipts | shipmentReceipts | receipt_code unique, consumed boolean |
| conca | counters | Use MongoDB counter pattern for facilityID generation |

---

## TASK 3: MONGODB SCHEMA DESIGN

### User Collection (facility)
```javascript
{
  _id: ObjectId,
  facilityID: String, // unique index
  name: String,
  fname: String,
  email: String, // unique index
  phone: String,
  role: String, // 'Admin', 'Staff'
  status: Number, // 1 = active
  password: String, // legacy MD5 (for migration only)
  password_hash: String, // bcrypt
  permissions: [String] or Object,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { email: 1 } (unique)
- { facilityID: 1 } (unique)
- { role: 1 }
```

### Branch Collection (branch)
```javascript
{
  _id: ObjectId,
  facilityID: String, // unique index
  name: String,
  address: String,
  phone: String,
  status: String, // 'active', 'inactive'
  sales_mode: String, // 'DEALER', 'PER_YARD'
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { facilityID: 1 } (unique)
- { sales_mode: 1 }
- { status: 1 }
```

### Stock Collection (stocks)
```javascript
{
  _id: ObjectId,
  name: String,
  facilityID: String,
  store_id: ObjectId, // reference to stores
  quantity: Number,
  buying: Number,
  selling: Number,
  unit_type: String, // 'belt', 'yard'
  price_per_yard: Number,
  yards_per_belt: Number,
  status: String, // 'active', 'inactive'
  out_stocks: Number,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { facilityID: 1, name: 1 }
- { facilityID: 1, store_id: 1 }
- { store_id: 1 }
- { name: "text" }
```

### Order Collection (orders)
```javascript
{
  _id: ObjectId,
  orderID: String,
  facilityID: String,
  stockID: ObjectId, // reference to stocks
  item: String,
  quantity: Number,
  subtotal: Number,
  net_total: Number,
  buyer_name: String,
  customer_name: String,
  customerID: ObjectId, // reference to customers
  payment: String, // 'cash', 'credit', 'transfer'
  discount: Number,
  amount_paid: Number,
  cash: Number,
  pos: Number,
  transfer: Number,
  bank_name: String,
  staff: String,
  status: String,
  creation: Date
}

Indexes:
- { orderID: 1, facilityID: 1 } (unique)
- { facilityID: 1, creation: -1 }
- { customerID: 1 }
- { creation: -1 }
```

### Stock Movement Collection (stockMovements)
```javascript
{
  _id: ObjectId,
  facilityID: String,
  store_id: ObjectId,
  stock_id: ObjectId,
  movement_type: String, // enum
  quantity_change: Number,
  quantity_before: Number,
  quantity_after: Number,
  reference_type: String,
  reference_id: String,
  notes: String,
  performed_by: ObjectId, // reference to users
  createdAt: Date
}

Indexes:
- { stock_id: 1, facilityID: 1 }
- { movement_type: 1 }
- { createdAt: -1 }
- { reference_type: 1, reference_id: 1 }
```

### Goods Request Collection (goodsRequests)
```javascript
{
  _id: ObjectId,
  request_code: String, // unique
  staff_id: ObjectId,
  staff_name: String,
  requesting_branch: String,
  stock_id: ObjectId,
  product_name: String,
  requested_quantity: Number,
  unit_type: String,
  reason: String,
  status: String, // enum
  admin_notes: String,
  source_branch: String,
  shipment_id: ObjectId,
  reviewed_by: ObjectId,
  reviewed_at: Date,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { request_code: 1 } (unique)
- { staff_id: 1 }
- { requesting_branch: 1 }
- { status: 1 }
```

### Shipment Collection (shipments)
```javascript
{
  _id: ObjectId,
  tracking_number: String, // unique
  source_branch: String,
  destination_branch: String,
  source_store_id: ObjectId,
  destination_store_id: ObjectId,
  status: String, // enum
  dispatched_by: ObjectId,
  dispatched_at: Date,
  received_by: ObjectId,
  received_at: Date,
  notes: String,
  created_by: ObjectId,
  createdAt: Date,
  items: [{
    stock_id: ObjectId,
    product_name: String,
    quantity_sent: Number,
    quantity_received: Number
  }]
}

Indexes:
- { tracking_number: 1 } (unique)
- { source_branch: 1, destination_branch: 1 }
- { status: 1 }
```

### Password Reset Collection (passwordResets)
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  email: String,
  otp_hash: String,
  reset_token: String,
  attempts: Number,
  max_attempts: Number,
  is_verified: Boolean,
  is_used: Boolean,
  expires_at: Date,
  createdAt: Date
}

Indexes:
- { email: 1 }
- { user_id: 1 }
- { reset_token: 1 }
- { expires_at: 1 } (TTL index for cleanup)
```

---

## TASK 4: MIGRATION STRATEGY

### Phase 1: Setup (No Data Loss)
1. Install Mongoose and MongoDB driver
2. Create MongoDB connection module (parallel to MySQL)
3. Create Mongoose models for all collections
4. Add MONGODB_URI to .env.example
5. Keep MySQL connection intact (fallback)

### Phase 2: Repository Layer Migration
1. Create new Mongoose-based repositories (e.g., authRepositoryMongo.js)
2. Keep MySQL repositories as authRepositoryMySQL.js
3. Add feature flag to switch between MySQL/MongoDB
4. Migrate one repository at a time:
   - authRepository
   - branchRepository
   - stockRepository
   - salesRepository
   - customerRepository
   - etc.

### Phase 3: Transaction Safety
1. Identify all MySQL transactions:
   - Branch creation (conca table + branch insert)
   - Sales checkout (stock decrement + order insert + movement insert)
   - Stock receiving (stock insert + movement insert)
   - Shipments (shipment insert + items insert)
   - Returns (stock restore + order delete + movement insert)
2. Implement MongoDB transactions using sessions
3. Test transaction rollback scenarios

### Phase 4: Branch Isolation Verification
1. Audit every query for facilityID filtering
2. Ensure MongoDB queries include facilityID where applicable
3. Test cross-branch access prevention
4. Verify admin global access still works

### Phase 5: Testing
1. Run existing API tests against MongoDB
2. Fix any query differences (SQL → MongoDB aggregation)
3. Verify authentication/authorization
4. Verify all business rules
5. Performance test critical queries

### Phase 6: Data Migration (Production)
1. Create MySQL → MongoDB data migration script
2. Backup MongoDB before migration
3. Migrate data in phases (users → branches → stocks → etc.)
4. Verify data integrity
5. Keep MySQL as backup during cutover period

### Phase 7: Cutover
1. Switch feature flag to MongoDB
2. Monitor for errors
3. Keep MySQL available for rollback
4. After successful cutover, remove MySQL code

---

## TASK 5: CRITICAL CONSIDERATIONS

### Branch Isolation
- Every MongoDB query must include facilityID filter where applicable
- Admin queries can omit facilityID
- Repository layer must enforce this

### Transactions
- MongoDB requires sessions for transactions
- All write operations in a transaction must use the same session
- Transaction timeout considerations

### Data Types
- MySQL DECIMAL → MongoDB Number (use precision in validation)
- MySQL ENUM → MongoDB String with validation
- MySQL JSON → MongoDB Object
- MySQL TIMESTAMP → MongoDB Date
- MySQL AUTO_INCREMENT → MongoDB ObjectId or counter pattern

### Indexes
- Create indexes before data migration
- Monitor query performance after migration
- Add compound indexes for common query patterns

### Passwords
- Preserve bcrypt hashes (no re-hashing needed)
- Remove MD5 legacy passwords during migration
- Keep password verification logic unchanged

### Relationships
- Use ObjectId references for foreign keys
- Use populate() for joins
- Consider embedding for small, read-only subdocuments

---

## TASK 6: FILES TO CHANGE

### New Files to Create
1. `backend/src/config/mongodb.js` - MongoDB connection
2. `backend/src/models/*.js` - Mongoose models (all collections)
3. `backend/src/repositories/*Mongo.js` - MongoDB repositories
4. `backend/scripts/migrate-mysql-to-mongodb.js` - Data migration script

### Files to Modify
1. `backend/src/config/database.js` - Add MongoDB parallel connection
2. `backend/src/app.js` - Add MongoDB connection initialization
3. `backend/package.json` - Add mongoose dependency
4. `backend/.env.example` - Add MONGODB_URI
5. All controllers - Switch repository calls (via feature flag)

### Files to Keep (Initially)
1. All MySQL repositories (for rollback)
2. MySQL connection module (for rollback)
3. Migration files (for reference)

---

## TASK 7: ENVIRONMENT VARIABLES

### New Variables
```env
MONGODB_URI=mongodb+srv://...
DB_TYPE=mongodb  # Feature flag: 'mysql' or 'mongodb'
```

### Variables to Keep (MySQL fallback)
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=murg
DB_USER=root
DB_PASS=
```

### Variables Unchanged
```env
NODE_ENV=production
PORT=5000
JWT_SECRET=
JWT_EXPIRES_IN=7d
CORS_ORIGIN=
EMAILJS_SERVICE_ID=
EMAILJS_TEMPLATE_ID=
EMAILJS_PUBLIC_KEY=
EMAILJS_PRIVATE_KEY=
```

---

## TASK 8: RISKS AND MITIGATION

### Risk 1: Transaction Safety
- **Risk:** MongoDB transactions behave differently than MySQL
- **Mitigation:** Implement comprehensive transaction testing, keep MySQL as fallback

### Risk 2: Query Performance
- **Risk:** MongoDB aggregation slower than SQL joins
- **Mitigation:** Create proper indexes, monitor performance, optimize queries

### Risk 3: Data Loss During Migration
- **Risk:** Migration script could fail midway
- **Mitigation:** Backup both databases, migrate in phases, verify each phase

### Risk 4: Branch Isolation Breach
- **Risk:** MongoDB queries missing facilityID filter
- **Mitigation:** Audit all queries, add repository-level validation, test extensively

### Risk 5: Password Hash Compatibility
- **Risk:** bcrypt verification fails after migration
- **Mitigation:** Test password login immediately after migration, keep MySQL as backup

---

## NEXT STEPS

1. ✅ Database audit completed
2. ⏳ Install Mongoose dependency
3. ⏳ Create MongoDB connection module
4. ⏳ Create Mongoose models
5. ⏳ Create MongoDB repositories (one at a time)
6. ⏳ Implement MongoDB transactions
7. ⏳ Create data migration script
8. ⏳ Test migration with sample data
9. ⏳ Full migration testing
10. ⏳ Production data migration
11. ⏳ Cutover to MongoDB
12. ⏳ Remove MySQL code

**IMPORTANT:** Do not proceed with code changes until this plan is reviewed and approved. This is a high-risk migration that affects all data and business logic.
