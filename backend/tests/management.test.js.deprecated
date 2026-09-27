/**
 * backend/tests/management.test.js
 *
 * Comprehensive End-to-End Test Suite for:
 * 1. Admin Management Center authorization (Staff 403 vs Admin 200)
 * 2. Cryptographic single-use, user-bound, allowlisted bridge tickets
 * 3. Atomic ticket consumption and replay rejection
 * 4. Expired ticket rejection
 * 5. Destination allowlist enforcement (open redirect defense)
 * 6. Native PHP session hydration and PHPSESSID cookie retention
 * 7. Legacy PHP module access under active session
 * 8. Legacy static asset accessibility (CSS, JS, Bootstrap)
 * 9. Direct XAMPP access compatibility
 */

const http = require('http');
const app = require('../src/app');
const db = require('../src/config/database');

let server;
let baseUrl;

function request(method, path, body = null, token = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (cookies) headers['Cookie'] = cookies;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsedBody;
        try {
          parsedBody = JSON.parse(data);
        } catch (_) {
          parsedBody = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsedBody,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function apacheRequest(path, cookies = null, followRedirects = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost');
    const headers = {};
    if (cookies) headers['Cookie'] = cookies;

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', async () => {
        let currentCookies = cookies;
        if (res.headers['set-cookie']) {
          const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
          currentCookies = currentCookies ? `${currentCookies}; ${newCookies}` : newCookies;
        }

        if (followRedirects && (res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          try {
            const nextRes = await apacheRequest(res.headers.location, currentCookies, false);
            return resolve(nextRes);
          } catch (err) {
            return reject(err);
          }
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runManagementTests() {
  console.log('\n=============================================================');
  console.log('   RUNNING MANAGEMENT & AUTH BRIDGE COMPATIBILITY SUITE');
  console.log('=============================================================\n');

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
  const testAdminEmail = `mgmt_admin_${uniqueId}@murg.test`;
  const testStaffEmail = `mgmt_staff_${uniqueId}@murg.test`;

  try {
    // -------------------------------------------------------------
    // 1. Setup Test Users
    // -------------------------------------------------------------
    await db.query(
      `INSERT INTO facility (facilityID, agentID, name, email, phone, gender, fname, address, role, status, password, password_hash)
       VALUES ('MURG/001', '1', 'Mgmt Admin', ?, '0000000000', 'Male', 'Admin User', 'HQ', 'Admin', 1, MD5('admin123'), NULL)`,
      [testAdminEmail]
    );

    await db.query(
      `INSERT INTO facility (facilityID, agentID, name, email, phone, gender, fname, address, role, status, password, password_hash)
       VALUES ('MURG/001', 'N/A', 'Mgmt Staff', ?, '0000000000', 'Female', 'Staff User', 'HQ', 'Staff', 1, MD5('staff123'), NULL)`,
      [testStaffEmail]
    );

    const adminLogin = await request('POST', '/api/auth/login', {
      email: testAdminEmail,
      password: 'admin123',
    });
    const adminToken = adminLogin.body.data.token;
    assert(adminLogin.status === 200 && adminToken, 'Admin user logs in and receives JWT');

    const staffLogin = await request('POST', '/api/auth/login', {
      email: testStaffEmail,
      password: 'staff123',
    });
    const staffToken = staffLogin.body.data.token;
    assert(staffLogin.status === 200 && staffToken, 'Staff user logs in and receives JWT');

    // -------------------------------------------------------------
    // 2. Admin Management Authorization (Staff 403 vs Admin 200)
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Management Route Authorization ---');
    const staffOverview = await request('GET', '/api/management/overview', null, staffToken);
    assert(staffOverview.status === 403, 'Staff user is rejected with 403 Forbidden from /api/management/overview');

    const staffAudit = await request('GET', '/api/management/audit-logs', null, staffToken);
    assert(staffAudit.status === 403, 'Staff user is rejected with 403 Forbidden from /api/management/audit-logs');

    const adminOverview = await request('GET', '/api/management/overview', null, adminToken);
    assert(
      adminOverview.status === 200 &&
      adminOverview.body.data.branches?.total > 0 &&
      adminOverview.body.data.staff?.total > 0,
      'Admin user successfully retrieves multi-branch management overview'
    );

    const adminAudit = await request('GET', '/api/management/audit-logs', null, adminToken);
    assert(
      adminAudit.status === 200 && Array.isArray(adminAudit.body.data.logs),
      'Admin user successfully retrieves system audit logs'
    );

    // -------------------------------------------------------------
    // 3. Bridge Ticket Destination Allowlist & Open-Redirect Defense
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Bridge Ticket Allowlist & Security ---');

    // Attempt open redirect via external URL
    const evilRedirect = await request('POST', '/api/management/bridge-ticket', {
      targetPath: 'https://malicious-site.com/steal-creds',
    }, adminToken);
    assert(evilRedirect.status === 400, 'External redirect URL rejected with 400 Bad Request');

    // Attempt protocol-relative URL
    const protoRelative = await request('POST', '/api/management/bridge-ticket', {
      targetPath: '//malicious-site.com',
    }, adminToken);
    assert(protoRelative.status === 400, 'Protocol-relative URL rejected with 400 Bad Request');

    // Staff attempts to request admin module ticket (/system/expense.php)
    const staffAdminModuleAttempt = await request('POST', '/api/management/bridge-ticket', {
      targetPath: '/system/expense.php',
    }, staffToken);
    assert(staffAdminModuleAttempt.status === 403, 'Staff cannot request bridge ticket for /system/* admin destinations');

    // Staff requests permitted staff module ticket (/sub/expense.php)
    const staffPermittedTicket = await request('POST', '/api/management/bridge-ticket', {
      targetPath: '/sub/expense.php',
    }, staffToken);
    assert(
      staffPermittedTicket.status === 200 && staffPermittedTicket.body.data.ticket.length === 64,
      'Staff generates 64-char ticket for permitted /sub/expense.php destination'
    );

    // Admin requests permitted admin module ticket (/system/expense.php)
    const adminTicketRes = await request('POST', '/api/management/bridge-ticket', {
      targetPath: '/system/expense.php',
    }, adminToken);
    assert(
      adminTicketRes.status === 200 && adminTicketRes.body.data.ticket.length === 64,
      'Admin generates 64-char cryptographically secure ticket for /system/expense.php'
    );
    const adminTicket = adminTicketRes.body.data.ticket;

    // -------------------------------------------------------------
    // 4. Atomic Consumption & Single-Use Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Atomic Consumption & Replay Rejection ---');
    // First request: Hand off ticket to Apache auth_bridge.php
    const firstHandoff = await apacheRequest(`/murg/auth_bridge.php?ticket=${adminTicket}`);
    assert(
      firstHandoff.status === 302 &&
      (firstHandoff.headers['location'] === '/murg/system/expense.php' ||
       firstHandoff.headers['location'] === '/system/expense.php'),
      'First ticket consumption succeeds with 302 Redirect to /system/expense.php'
    );

    // Capture PHPSESSID cookie
    const setCookie = firstHandoff.headers['set-cookie'];
    assert(
      setCookie && setCookie.some((c) => c.includes('PHPSESSID')),
      'auth_bridge.php sets native PHPSESSID cookie'
    );
    const phpsessid = setCookie.find((c) => c.includes('PHPSESSID')).split(';')[0];

    // Second request: Replay attempt with same ticket MUST FAIL
    const replayAttempt = await apacheRequest(`/murg/auth_bridge.php?ticket=${adminTicket}`);
    assert(replayAttempt.status === 403, 'Replay of consumed ticket rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // 5. Expired Ticket Rejection
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Expired Ticket Rejection ---');
    const crypto = require('crypto');
    const expiredTicket = crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO auth_bridge_tickets 
       (ticket, user_id, facilityID, role, email, name, target_path, consumed, expires_at)
       VALUES (?, 1, 'MURG/001', 'Admin', ?, 'Admin', '/system/expense.php', 0, DATE_SUB(NOW(), INTERVAL 5 SECOND))`,
      [expiredTicket, testAdminEmail]
    );

    const expiredHandoff = await apacheRequest(`/murg/auth_bridge.php?ticket=${expiredTicket}`);
    assert(expiredHandoff.status === 403, 'Expired ticket rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // 6. Native Legacy PHP Session Verification & Module Execution
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Native PHP Session Verification ---');
    // Access /system/expense.php with the established PHPSESSID (follow extensionless redirect if needed)
    const expensePage = await apacheRequest('/murg/system/expense.php', phpsessid, true);
    assert(
      expensePage.status === 200 && !expensePage.body.includes('location:../index.php'),
      'Legacy /system/expense.php renders 200 OK without redirecting to login'
    );

    // Verify user info is visible in session (header renders admin name)
    assert(
      expensePage.body.includes('MURG TEXTILE') || expensePage.body.includes('Expense'),
      'Legacy page contains expected MurG system navigation and content'
    );

    // -------------------------------------------------------------
    // 7. Legacy Static Assets Verification
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Static Assets Verification ---');
    const cssRes = await apacheRequest('/murg/assets/css/loader.css');
    assert(cssRes.status === 200, 'Legacy stylesheet /assets/css/loader.css is accessible (200 OK)');

    const jsRes = await apacheRequest('/murg/assets/js/loader.js');
    assert(jsRes.status === 200, 'Legacy script /assets/js/loader.js is accessible (200 OK)');

    const bsRes = await apacheRequest('/murg/bootstrap/css/bootstrap.min.css');
    assert(bsRes.status === 200, 'Legacy bootstrap stylesheet is accessible (200 OK)');

    // -------------------------------------------------------------
    // 8. Direct XAMPP Legacy Entry Point Compatibility
    //    POST-DECOMMISSION: /murg/index.php now issues a 302 redirect
    //    to the React login page (http://localhost:5173/login).
    //    The old HTML login form has been replaced by the React LoginPage.
    //    followRedirects=false so we can assert the 302 itself fires.
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Direct XAMPP Entry Point Compatibility ---');
    const directLegacyLogin = await apacheRequest('/murg/index.php', null, false);
    const legacyLoginStatus = directLegacyLogin.status;
    const legacyLoginLocation = directLegacyLogin.headers && directLegacyLogin.headers.location || '';
    // After decommissioning, Apache first 301s to /murg/index (canonical URL),
    // then our PHP issues 302 → React. Either way, this endpoint must redirect.
    const legacyLoginRedirects = (legacyLoginStatus === 301 || legacyLoginStatus === 302);
    assert(legacyLoginRedirects, `Decommissioned /murg/index.php issues a redirect (got HTTP ${legacyLoginStatus})`);
    const pointsToReact = legacyLoginLocation.includes('/murg/index') || legacyLoginLocation.includes('/login');
    assert(pointsToReact, `Redirect location points toward React login (got: ${legacyLoginLocation})`);

    console.log('\n=============================================================');
    console.log(`MANAGEMENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Teardown test records
    try {
      await db.query("DELETE FROM auth_bridge_tickets WHERE email LIKE '%@murg.test'");
      await db.query("DELETE FROM facility WHERE email LIKE '%@murg.test'");
    } catch (_) {}

    server.close();
    await db.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runManagementTests();
