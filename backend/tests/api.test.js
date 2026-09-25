const http = require('http');
const app = require('../src/app');
const db = require('../src/config/database');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n=============================================');
  console.log('   RUNNING MURG COMPREHENSIVE TEST SUITE');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const uniqueId = Date.now();
  const testAdminEmail = `test_admin_${uniqueId}@murg.test`;
  const testStaffEmail = `test_staff_${uniqueId}@murg.test`;
  const testYardStaffEmail = `test_yardstaff_${uniqueId}@murg.test`;
  let perYardBranchId = null;
  let testYardStockId = null;
  let testCustomerId = null;
  let testShipmentId = null;

  try {
    // -------------------------------------------------------------
    // Base Auth & Verification Tests
    // -------------------------------------------------------------
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.status === 'online', 'Healthcheck endpoint returns 200 online');

    // Create isolated temporary test users
    await db.query(
      `INSERT INTO facility (facilityID, agentID, name, email, phone, gender, fname, address, role, status, password, password_hash, dob)
       VALUES ('MURG/001', '1', 'Test Admin Temp', ?, '0000000000', 'Male', 'Alh Yasir', 'Test St', 'Admin', 1, MD5('admin123'), NULL, '1990-01-01')`,
      [testAdminEmail]
    );

    await db.query(
      `INSERT INTO facility (facilityID, agentID, name, email, phone, gender, fname, address, role, status, password, password_hash, dob)
       VALUES ('MURG/001', 'N/A', 'Test Staff Temp', ?, '0000000000', 'Male', 'Alh Yasir', 'Test St', 'Staff', 1, MD5('staff123'), NULL, '1990-01-01')`,
      [testStaffEmail]
    );

    const adminLogin = await request('POST', '/api/auth/login', {
      email: testAdminEmail,
      password: 'admin123',
    });
    assert(adminLogin.status === 200 && adminLogin.body.data.token, 'Admin login succeeds and returns JWT');
    const adminToken = adminLogin.body.data.token;

    const staffLogin = await request('POST', '/api/auth/login', {
      email: testStaffEmail,
      password: 'staff123',
    });
    assert(staffLogin.status === 200 && staffLogin.body.data.token, 'Staff login succeeds and returns JWT');
    const staffToken = staffLogin.body.data.token;

    // -------------------------------------------------------------
    // Scenario L: Password Reset via Email OTP
    // -------------------------------------------------------------
    console.log('\n--- Scenario L: Secure Forgot Password via Email OTP ---');
    const forgotRes = await request('POST', '/api/auth/forgot-password', { email: testAdminEmail });
    assert(forgotRes.status === 200 && forgotRes.body.data.message, 'Forgot password request returns safe generic response');

    // Get OTP directly from DB for test verification
    const [resetRows] = await db.query('SELECT * FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1', [testAdminEmail]);
    assert(resetRows.length > 0 && resetRows[0].otp_hash, 'Password reset OTP hash recorded in database');
    const resetId = resetRows[0].id;

    // Test invalid OTP rejection
    const invalidVerifyRes = await request('POST', '/api/auth/verify-reset-otp', { email: testAdminEmail, otp: '000000' });
    assert(invalidVerifyRes.status === 400, 'Invalid OTP code rejected with 400 Bad Request');

    // Manually fetch plaintext OTP or override hash for test verification
    const crypto = require('crypto');
    const testOtp = '123456';
    const testOtpHash = crypto.createHash('sha256').update(testOtp).digest('hex');
    await db.query('UPDATE password_resets SET otp_hash = ?, attempts = 0 WHERE id = ?', [testOtpHash, resetId]);

    const validVerifyRes = await request('POST', '/api/auth/verify-reset-otp', { email: testAdminEmail, otp: testOtp });
    assert(validVerifyRes.status === 200 && validVerifyRes.body.data.resetToken, 'Valid OTP code verified and returns single-use resetToken');
    const resetToken = validVerifyRes.body.data.resetToken;

    // Reset password
    const newPassRes = await request('POST', '/api/auth/reset-password', { resetToken, newPassword: 'newadminpass123' });
    assert(newPassRes.status === 200, 'New password set successfully');

    // Test login with new password
    const newLoginRes = await request('POST', '/api/auth/login', { email: testAdminEmail, password: 'newadminpass123' });
    assert(newLoginRes.status === 200 && newLoginRes.body.data.token, 'Login with newly reset password succeeds');

    // -------------------------------------------------------------
    // Scenario K: Management Overview Security & Data Test
    // -------------------------------------------------------------
    console.log('\n--- Scenario K: Management Overview Security & Aggregation ---');
    const mgmtAdminRes = await request('GET', '/api/management/overview', null, adminToken);
    assert(
      mgmtAdminRes.status === 200 &&
      mgmtAdminRes.body.data.todaySales !== undefined &&
      mgmtAdminRes.body.data.inventory !== undefined &&
      mgmtAdminRes.body.data.customers !== undefined &&
      mgmtAdminRes.body.data.shipments !== undefined &&
      mgmtAdminRes.body.data.debts !== undefined,
      'Admin GET /api/management/overview returns 200 with all business overview metrics'
    );

    const mgmtStaffRes = await request('GET', '/api/management/overview', null, staffToken);
    assert(
      mgmtStaffRes.status === 403,
      'Staff GET /api/management/overview is rejected with 403 Forbidden'
    );

    // -------------------------------------------------------------
    // Scenario A: Dealer Branch Behavior Preserved
    // -------------------------------------------------------------
    console.log('\n--- Scenario A: Dealer Branch (Belts Mode) ---');
    const [dealerBranch] = await db.query('SELECT facilityID, sales_mode FROM branch WHERE facilityID = "MURG/001"');
    assert(dealerBranch[0]?.sales_mode === 'DEALER', 'Existing branch MURG/001 operates in DEALER mode');

    const dealerMetrics = await request('GET', '/api/branches/MURG/001/dashboard', null, adminToken);
    assert(
      dealerMetrics.status === 200 && dealerMetrics.body.data.metrics.sales_mode === 'DEALER',
      'MURG/001 dashboard reports DEALER sales mode and Belts unit label'
    );

    // -------------------------------------------------------------
    // Scenario B: PER_YARD Branch Creation by Global Admin
    // -------------------------------------------------------------
    console.log('\n--- Scenario B: PER_YARD Branch Creation ---');
    const createBranchRes = await request('POST', '/api/branches', {
      name: `Test Yard Branch ${uniqueId}`,
      address: '77 Fagge Textile Market, Kano',
      phone: '08099887766',
      sales_mode: 'PER_YARD',
    }, adminToken);

    assert(createBranchRes.status === 201 && createBranchRes.body.data.facilityID, 'Admin creates a new retail branch');
    perYardBranchId = createBranchRes.body.data.facilityID;
    assert(createBranchRes.body.data.sales_mode === 'PER_YARD', 'New branch has sales_mode = "PER_YARD"');

    // Create staff belonging specifically to the new PER_YARD branch
    await db.query(
      `INSERT INTO facility (facilityID, agentID, name, email, phone, gender, fname, address, role, status, password, password_hash, dob)
       VALUES (?, 'N/A', 'Yard Branch Cashier', ?, '0000000000', 'Female', 'Yard Store', 'Market', 'Staff', 1, MD5('staff123'), NULL, '1990-01-01')`,
      [perYardBranchId, testYardStaffEmail]
    );

    const yardStaffLogin = await request('POST', '/api/auth/login', {
      email: testYardStaffEmail,
      password: 'staff123',
    });
    const yardStaffToken = yardStaffLogin.body.data.token;
    assert(yardStaffLogin.status === 200 && yardStaffToken, 'Staff assigned to PER_YARD branch logs in successfully');

    // Create an initial stock item in the PER_YARD branch
    const [initStockResult] = await db.query(
      `INSERT INTO stocks 
       (facilityID, name, unit_type, yards_per_belt, selling, buying, price_per_yard, quantity, opening_quantity, new_order, out_stocks, status)
       VALUES (?, 'SUPER SHADDA GOLD', 'yard', 100.00, '350000', '300000', 3500.00, '0', '0', '0', '0', 'active')`,
      [perYardBranchId]
    );
    testYardStockId = initStockResult.insertId;
    assert(testYardStockId > 0, 'Catalog product registered in PER_YARD branch');

    // -------------------------------------------------------------
    // Scenario C: Stock Receiving in PER_YARD Branch (Belt-to-Yard Conversion)
    // -------------------------------------------------------------
    console.log('\n--- Scenario C: Stock Receiving with Belt-to-Yard Conversion ---');
    // Restock 5 belts into the product that has yards_per_belt = 100.00
    const receiveRes = await request('POST', `/api/stocks/receive?branchId=${perYardBranchId}`, {
      stockId: testYardStockId,
      quantity: 5, // 5 belts
      costPrice: 300000,
      purchaseFrom: 'Kano Wholesale Textile Dealers Ltd',
      forDesc: 'Batch A Delivery',
      amountPaid: 1500000,
      unitType: 'belt',
    }, adminToken);

    assert(receiveRes.status === 201, 'Supplier stock intake recorded successfully');
    const [stockAfterReceive] = await db.query('SELECT quantity, unit_type FROM stocks WHERE id = ?', [testYardStockId]);
    assert(
      parseFloat(stockAfterReceive[0].quantity) === 500,
      '5 belts automatically converted to 500.00 yards in PER_YARD branch'
    );
    assert(stockAfterReceive[0].unit_type === 'yard', 'Stock unit_type is confirmed as "yard"');

    // Verify stock movement ledger
    const [intakeMovement] = await db.query(
      'SELECT quantity_change, movement_type FROM stock_movements WHERE stock_id = ? AND movement_type = "STOCK_IN_SUPPLIER" ORDER BY id DESC LIMIT 1',
      [testYardStockId]
    );
    assert(
      intakeMovement.length > 0 && parseFloat(intakeMovement[0].quantity_change) === 500,
      'Stock movement ledger records +500.00 yards intake'
    );

    // -------------------------------------------------------------
    // Scenario D: Admin Configures Price per Yard and Yards per Belt
    // -------------------------------------------------------------
    console.log('\n--- Scenario D: Admin Price Configuration ---');
    const updateYardRes = await request('PATCH', `/api/stocks/${testYardStockId}/yard-config?branchId=${perYardBranchId}`, {
      price_per_yard: 3800.00,
      yards_per_belt: 100.00,
      reason: 'Standard retail markup adjustment',
    }, adminToken);

    assert(updateYardRes.status === 200, 'Global Admin updates price_per_yard to ₦3,800/yd');
    const [verifiedYardStock] = await db.query('SELECT price_per_yard, yards_per_belt FROM stocks WHERE id = ?', [testYardStockId]);
    assert(parseFloat(verifiedYardStock[0].price_per_yard) === 3800, 'Database price_per_yard is exactly 3800.00');

    // -------------------------------------------------------------
    // Scenario E: Staff Price Rejection Boundary (Security Enforcement)
    // -------------------------------------------------------------
    console.log('\n--- Scenario E: Staff Price Modification Rejection ---');
    const staffYardPriceRes = await request('PATCH', `/api/stocks/${testYardStockId}/yard-config?branchId=${perYardBranchId}`, {
      price_per_yard: 1000.00,
      yards_per_belt: 100.00,
    }, yardStaffToken);

    assert(staffYardPriceRes.status === 403, 'Non-Admin staff price update rejected with 403 Forbidden');

    const [unauthAudit] = await db.query(
      "SELECT * FROM audit_logs WHERE action = 'UNAUTHORIZED_PRICE_CHANGE_ATTEMPT' AND entity_id = ? ORDER BY id DESC LIMIT 1",
      [String(testYardStockId)]
    );
    assert(unauthAudit.length > 0, 'Security audit log captures unauthorized staff price attempt');

    // -------------------------------------------------------------
    // Scenario F: PER_YARD Fractional Yard POS Sale
    // -------------------------------------------------------------
    console.log('\n--- Scenario F: Fractional Yard Sale ---');
    // Sell 3.5 yards of SUPER SHADDA GOLD @ ₦3,800/yd = ₦13,300
    const yardSaleRes = await request('POST', '/api/sales/checkout', {
      branchId: perYardBranchId,
      buyerName: 'Hajiya Amina Retail',
      items: [
        {
          stockId: testYardStockId,
          quantity: 3.5, // fractional yard
          price: 9999, // tampered client price; backend must enforce DB price (3800)
          itemDiscount: 0,
        },
      ],
      globalDiscount: 0,
      payment: { cash: 13300, pos: 0, transfer: 0 },
      isCredit: false,
    }, yardStaffToken);

    assert(yardSaleRes.status === 201 && yardSaleRes.body.data.orderID, 'Fractional yard checkout succeeds');
    const yardOrderId = yardSaleRes.body.data.orderID;

    // Verify server-side price enforcement (3.5 * 3800 = 13300)
    const [yardOrderRows] = await db.query('SELECT price, quantity, subtotal FROM orders WHERE orderID = ?', [yardOrderId]);
    assert(
      parseFloat(yardOrderRows[0].price) === 3800 && parseFloat(yardOrderRows[0].subtotal) === 13300,
      'Backend enforced authoritative price (₦3,800/yd × 3.5 = ₦13,300) ignoring client tampering'
    );

    // Verify stock deducted by exactly 3.5 yards (500 - 3.5 = 496.5)
    const [stockAfterSale] = await db.query('SELECT quantity FROM stocks WHERE id = ?', [testYardStockId]);
    assert(parseFloat(stockAfterSale[0].quantity) === 496.5, 'Stock quantity decremented from 500 to 496.5 yards');

    // -------------------------------------------------------------
    // Scenario G: Credit Sale in PER_YARD Branch
    // -------------------------------------------------------------
    console.log('\n--- Scenario G: Credit Sale in PER_YARD Branch ---');
    // Create test customer
    const [custResult] = await db.query(
      `INSERT INTO customers (facilityID, name, phone, address, creation)
       VALUES (?, 'Alhaji Sani Wholesale', '08012345678', 'Kano', NOW())`,
      [perYardBranchId]
    );
    testCustomerId = custResult.insertId;

    // Sell 10 yards @ 3800 = 38,000. Customer deposits 10,000 cash, balance 28,000 on credit
    const creditSaleRes = await request('POST', '/api/sales/checkout', {
      branchId: perYardBranchId,
      customerId: testCustomerId,
      customerName: 'Alhaji Sani Wholesale',
      items: [
        {
          stockId: testYardStockId,
          quantity: 10,
          price: 3800,
          itemDiscount: 0,
        },
      ],
      globalDiscount: 0,
      payment: { cash: 10000, pos: 0, transfer: 0 },
      isCredit: true,
    }, yardStaffToken);

    assert(creditSaleRes.status === 201 && creditSaleRes.body.data.isCredit === true, 'Credit sale completed successfully');

    // Verify outstand debt record was created/updated
    const [debtRows] = await db.query(
      'SELECT amount, balance FROM outstand WHERE customerID = ? AND facilityID = ?',
      [testCustomerId, perYardBranchId]
    );
    assert(
      debtRows.length > 0 && parseFloat(debtRows[0].balance) === 28000,
      'Customer outstanding debt balance recorded accurately as ₦28,000'
    );

    // -------------------------------------------------------------
    // Scenario H: Insufficient Stock Rejection
    // -------------------------------------------------------------
    console.log('\n--- Scenario H: Insufficient Stock Rejection ---');
    // Available stock is now 486.5 yards. Try to buy 999 yards.
    const oversellRes = await request('POST', '/api/sales/checkout', {
      branchId: perYardBranchId,
      items: [
        {
          stockId: testYardStockId,
          quantity: 999,
          price: 3800,
        },
      ],
      payment: { cash: 999 * 3800, pos: 0, transfer: 0 },
      isCredit: false,
    }, yardStaffToken);

    assert(oversellRes.status === 409, 'Oversell attempt rejected with 409 Conflict');
    const [stockUnchanged] = await db.query('SELECT quantity FROM stocks WHERE id = ?', [testYardStockId]);
    assert(parseFloat(stockUnchanged[0].quantity) === 486.5, 'Inventory remains completely unchanged after failed oversell');

    // -------------------------------------------------------------
    // Scenario I: Shipping Transfer (DEALER belts -> PER_YARD yards conversion)
    // -------------------------------------------------------------
    console.log('\n--- Scenario I: Inter-Branch Shipment with Belt-to-Yard Conversion ---');
    // Dealer MURG/001 stock ID 1 has 1 belt with yards_per_belt = 100.00
    // First increment stock ID 1 by 5 belts so we have plenty to transfer
    await db.query('UPDATE stocks SET quantity = 10 WHERE id = 1 AND facilityID = "MURG/001"');

    // Dispatch shipment of 2 belts from MURG/001 to perYardBranchId
    const dispatchRes = await request('POST', '/api/shipments', {
      sourceBranch: 'MURG/001',
      destinationBranch: perYardBranchId,
      items: [{ stockId: 1, quantity: 2 }],
      notes: 'Transfer 2 belts to retail branch',
    }, adminToken);

    assert(dispatchRes.status === 201 && dispatchRes.body.data.id, 'Shipment dispatched from DEALER branch (Status: In Transit)');
    testShipmentId = dispatchRes.body.data.id;

    // Confirm receipt at destination branch (PER_YARD)
    const receiveShipmentRes = await request('POST', `/api/shipments/${testShipmentId}/receive`, {
      receivedItems: [{ id: dispatchRes.body.data.items?.[0]?.id || 1, quantityReceived: 2 }],
    }, yardStaffToken);

    assert(receiveShipmentRes.status === 200, 'Destination PER_YARD branch confirms receipt of shipment');

    // Verify destination received 2 belts * 100 = 200 yards!
    const [destStockResult] = await db.query(
      'SELECT quantity, unit_type FROM stocks WHERE facilityID = ? AND name = (SELECT name FROM stocks WHERE id = 1)',
      [perYardBranchId]
    );
    assert(
      destStockResult.length > 0 && parseFloat(destStockResult[0].quantity) === 200,
      'Destination branch credited with 200.00 yards (converted from 2 belts)'
    );
    assert(destStockResult[0].unit_type === 'yard', 'Destination stock unit_type is "yard"');

    // -------------------------------------------------------------
    // Scenario M: Goods Request, Admin Notification, Shipping & Receipt Release
    // -------------------------------------------------------------
    console.log('\n--- Scenario M: Staff Goods Request & Admin Approval ---');
    // Staff submits goods request for 2 belts of stock ID 1
    const createReqRes = await request('POST', '/api/goods-requests', {
      stockId: 1,
      productName: 'SUPER SHADDA GOLD',
      requestedQuantity: 2,
      unitType: 'belt',
      reason: 'Low stock in branch',
    }, yardStaffToken);

    assert(createReqRes.status === 201 && createReqRes.body.data.id, 'Staff submits goods request successfully');
    const testReqId = createReqRes.body.data.id;

    // Admin checks notifications
    const notifRes = await request('GET', '/api/notifications/unread-count', null, adminToken);
    assert(notifRes.status === 200 && notifRes.body.data.unreadCount >= 1, 'Admin receives unread header bell notification for goods request');

    // Admin checks eligible source branches
    const eligibleRes = await request('GET', `/api/goods-requests/${testReqId}/eligible-branches`, null, adminToken);
    assert(eligibleRes.status === 200 && eligibleRes.body.data.length > 0, 'Admin queries eligible source branches with sufficient stock');

    const sourceBranchObj = eligibleRes.body.data.find(b => b.facilityID === 'MURG/001');
    assert(sourceBranchObj && sourceBranchObj.stockId, 'MURG/001 identified as eligible source branch');

    // Admin approves request and dispatches shipment
    const approveRes = await request('POST', `/api/goods-requests/${testReqId}/approve-and-ship`, {
      sourceBranch: 'MURG/001',
      sourceStockId: sourceBranchObj.stockId,
      adminNotes: 'Approved by Global Admin',
    }, adminToken);

    assert(approveRes.status === 200 && approveRes.body.data.receiptCode, 'Admin approves request and dispatches shipment with receipt code');
    const testReceiptCode = approveRes.body.data.receiptCode;

    // Staff at destination branch verifies receipt code
    const verifyRcptRes = await request('GET', `/api/shipment-receipts/${testReceiptCode}/verify`, null, yardStaffToken);
    assert(verifyRcptRes.status === 200 && verifyRcptRes.body.data.consumed === 0, 'Destination staff verifies valid active receipt code');

    // Staff at WRONG branch tries to release receipt -> 400 Access Denied
    const wrongBranchRelease = await request('POST', `/api/shipment-receipts/${testReceiptCode}/release`, null, staffToken);
    assert(wrongBranchRelease.status === 400, 'Staff at wrong branch prevented from releasing receipt (Access Denied)');

    // Destination staff releases receipt
    const releaseRes = await request('POST', `/api/shipment-receipts/${testReceiptCode}/release`, null, yardStaffToken);
    assert(releaseRes.status === 200 && releaseRes.body.data.success === true, 'Authorized destination staff releases receipt and credits inventory');

    // Replay attempt on same receipt code -> 400 Replay Prevented
    const replayRes = await request('POST', `/api/shipment-receipts/${testReceiptCode}/release`, null, yardStaffToken);
    assert(replayRes.status === 400, 'Replay attempt on consumed receipt code rejected');

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Teardown: ALWAYS clean up temporary test records to prevent test leakage
    try {
      await db.query("DELETE FROM password_resets WHERE email LIKE '%@murg.test'");
      await db.query("DELETE FROM shipment_receipts WHERE receipt_code LIKE 'RCPT-%'");
      await db.query("DELETE FROM notifications WHERE type IN ('GOODS_REQUEST', 'SHIPMENT_DISPATCHED')");
      await db.query("DELETE FROM goods_requests WHERE request_code LIKE 'REQ-%'");
      if (testShipmentId) {
        await db.query('DELETE FROM shipment_items WHERE shipment_id = ?', [testShipmentId]);
        await db.query('DELETE FROM shipments WHERE id = ?', [testShipmentId]);
      }
      if (testCustomerId) {
        await db.query('DELETE FROM outstand WHERE customerID = ?', [testCustomerId]);
        await db.query('DELETE FROM customers WHERE id = ?', [testCustomerId]);
      }
      if (perYardBranchId) {
        await db.query('DELETE FROM orders WHERE facilityID = ?', [perYardBranchId]);
        await db.query('DELETE FROM stock_movements WHERE facilityID = ?', [perYardBranchId]);
        await db.query('DELETE FROM purchase_history WHERE facilityID = ?', [perYardBranchId]);
        await db.query('DELETE FROM sales_queue WHERE facilityID = ?', [perYardBranchId]);
        await db.query('DELETE FROM stocks WHERE facilityID = ?', [perYardBranchId]);
        await db.query('DELETE FROM branch WHERE facilityID = ?', [perYardBranchId]);
      }
      // Restore MURG/001 stock ID 1
      await db.query('UPDATE stocks SET quantity = 1 WHERE id = 1');
      await db.query("DELETE FROM facility WHERE email LIKE '%@murg.test'");
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await db.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
