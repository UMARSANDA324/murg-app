<?php
/**
 * MURG Textile Enterprises — Secure Session Auth Bridge
 *
 * Provides safe, single-use, user-bound handoff from React/Node JWT
 * to native legacy PHP session.
 *
 * Security Guarantees:
 * 1. Single-use: Atomically consumed via DB transaction. Replay fails.
 * 2. Short-lived: 60-second maximum TTL enforced.
 * 3. User-bound: Identity hydrated directly from authoritative `facility` table in MySQL.
 * 4. Destination-allowlisted: Strict whitelist check. External/arbitrary paths rejected.
 * 5. Authorization preserved: PHP role & facility checks remain 100% active.
 */

// Include existing database connection
require_once(__DIR__ . '/assets/mashaAllah/gyada.php');

$ticket = isset($_GET['ticket']) ? trim($_GET['ticket']) : '';

if (empty($ticket) || !preg_match('/^[a-f0-9]{64}$/', $ticket)) {
    http_response_code(400);
    die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>400 Bad Request</h2><p>Invalid or missing authentication bridge ticket.</p><a href="/">Return to Dashboard</a></body></html>');
}

// Ensure database connection
if (!$con || mysqli_connect_errno()) {
    http_response_code(500);
    die('Database connection error');
}

// 1. Atomically consume the ticket in a transaction
$con->begin_transaction();

try {
    $stmt = $con->prepare(
        "SELECT id, user_id, facilityID, role, target_path, expires_at, consumed 
         FROM auth_bridge_tickets 
         WHERE ticket = ? FOR UPDATE"
    );
    $stmt->bind_param("s", $ticket);
    $stmt->execute();
    $result = $stmt->get_result();
    $ticketRow = $result->fetch_assoc();
    $stmt->close();

    if (!$ticketRow) {
        $con->rollback();
        http_response_code(403);
        die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>403 Forbidden</h2><p>Ticket not found or invalid.</p><a href="/">Return to Dashboard</a></body></html>');
    }

    if ($ticketRow['consumed'] == 1) {
        $con->rollback();
        http_response_code(403);
        die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>403 Forbidden</h2><p>This bridge ticket has already been used.</p><a href="/">Return to Dashboard</a></body></html>');
    }

    if (strtotime($ticketRow['expires_at']) < time()) {
        $con->rollback();
        http_response_code(403);
        die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>403 Forbidden</h2><p>This bridge ticket has expired.</p><a href="/">Return to Dashboard</a></body></html>');
    }

    // Mark as consumed atomically
    $updateStmt = $con->prepare("UPDATE auth_bridge_tickets SET consumed = 1, consumed_at = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $ticketRow['id']);
    $updateStmt->execute();
    $updateStmt->close();

    // 2. Fetch authoritative user from facility table
    $userStmt = $con->prepare("SELECT * FROM facility WHERE id = ? AND status = 1");
    $userStmt->bind_param("i", $ticketRow['user_id']);
    $userStmt->execute();
    $userResult = $userStmt->get_result();
    $user = $userResult->fetch_assoc();
    $userStmt->close();

    if (!$user) {
        $con->rollback();
        http_response_code(403);
        die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>403 Forbidden</h2><p>Account inactive or suspended.</p><a href="/">Return to Dashboard</a></body></html>');
    }

    $con->commit();
} catch (Exception $e) {
    $con->rollback();
    http_response_code(500);
    die('Internal error processing bridge ticket.');
}

// 3. Strict Destination Allowlist
$targetPath = $ticketRow['target_path'];

// Normalize path: strip query params for matching
$parsedUrl = parse_url($targetPath);
$pathOnly = $parsedUrl['path'] ?? $targetPath;

// Admin allowed destinations
$adminAllowlist = [
    '/system/index.php',
    '/system/expense.php',
    '/system/deposit.php',
    '/system/deposit-receipt.php',
    '/system/purchase.php',
    '/system/view-purchase.php',
    '/system/view-purchase-details.php',
    '/system/store.php',
    '/system/return.php',
    '/system/report.php',
    '/system/sales_report.php',
    '/system/monthly.php',
    '/system/weekly.php',
    '/system/invoice.php',
    '/system/track-stock.php',
    '/system/branch.php',
    '/system/staff.php',
    '/system/stocks.php',
    '/system/cart.php',
    '/system/customer.php',
    '/system/out.php',
    '/system/profile.php',
];

// Staff allowed destinations
$staffAllowlist = [
    '/sub/index.php',
    '/sub/expense.php',
    '/sub/deposit.php',
    '/sub/purchase.php',
    '/sub/view-purchase.php',
    '/sub/return.php',
    '/sub/report.php',
    '/sub/stocks.php',
    '/sub/cart.php',
    '/sub/customer.php',
    '/sub/out.php',
    '/sub/profile.php',
];

// Also allow extensionless variants handled by .htaccess
$extensionlessAdmin = array_map(function($p) { return preg_replace('/\.php$/', '', $p); }, $adminAllowlist);
$extensionlessStaff = array_map(function($p) { return preg_replace('/\.php$/', '', $p); }, $staffAllowlist);

$isAdmin = ($user['role'] === 'Admin');

$isAllowed = false;
if ($isAdmin) {
    $isAllowed = in_array($pathOnly, $adminAllowlist) || in_array($pathOnly, $extensionlessAdmin) ||
                 in_array($pathOnly, $staffAllowlist) || in_array($pathOnly, $extensionlessStaff);
} else {
    // Non-admin can ONLY access /sub/* destinations
    $isAllowed = in_array($pathOnly, $staffAllowlist) || in_array($pathOnly, $extensionlessStaff);
}

if (!$isAllowed) {
    http_response_code(403);
    die('<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h2>403 Forbidden</h2><p>Access to destination "' . htmlspecialchars($pathOnly) . '" is not authorized for your role.</p><a href="/">Return to Dashboard</a></body></html>');
}

// 4. Hydrate native PHP session
if (session_status() === PHP_SESSION_NONE) {
    // Ensure cookie is available across the entire origin
    session_set_cookie_params([
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

$_SESSION["id"] = $user["id"];
$_SESSION["email"] = $user["email"];
$_SESSION["phone"] = $user["phone"];
$_SESSION["role"] = $user["role"];
$_SESSION["name"] = $user["name"];
$_SESSION["facilityID"] = $user["facilityID"];
$_SESSION["address"] = $user["address"];
$_SESSION["fname"] = $user["fname"];
$_SESSION["type"] = $user["type"];

// 5. Safe internal redirect (supports both direct /murg access and root proxy)
$redirectUrl = $targetPath;
if (strpos($_SERVER['REQUEST_URI'], '/murg/') === 0 && strpos($redirectUrl, '/murg/') !== 0) {
    $redirectUrl = '/murg' . $redirectUrl;
}
header("Location: " . $redirectUrl);
exit;
