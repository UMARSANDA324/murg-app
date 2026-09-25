const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { unauthorized, forbidden } = require('../utils/responseUtils');
const { JWT_SECRET } = require('../config/auth');

/**
 * Verify JWT and attach user to req.user.
 * Supports token from Authorization header or 'token' cookie.
 */
async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Fallback to cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return unauthorized(res, 'Authentication required. Please log in.');
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Re-verify user still exists and is active in database
    const [rows] = await db.query(
      'SELECT id, facilityID, name, email, role, status, permissions FROM facility WHERE id = ? AND status = 1',
      [decoded.sub]
    );

    if (rows.length === 0) {
      return unauthorized(res, 'Account not found or suspended.');
    }

    const user = rows[0];
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      facilityID: user.facilityID,
      isGlobalAdmin: user.role === 'Admin',
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Session expired. Please log in again.');
    }
    if (err.name === 'JsonWebTokenError') {
      return unauthorized(res, 'Invalid authentication token.');
    }
    console.error('[Auth Middleware] Error:', err.message);
    return unauthorized(res, 'Authentication failed.');
  }
}

/**
 * Enforce branch data isolation.
 * Global Admin can access any branch.
 * Branch users are locked to their facilityID from the token — NEVER from client input.
 *
 * After this middleware runs:
 *   req.branchId — the verified, safe branch to scope queries to.
 */
function requireBranchScope(req, res, next) {
  const user = req.user;
  const requestedBranch =
    req.params.branchId || req.query.branchId || req.body.branchId || req.body.facilityID;

  // Global Admin: can target any branch
  if (user.isGlobalAdmin) {
    req.branchId = requestedBranch || user.facilityID;
    return next();
  }

  // Branch user: may only access their own branch
  if (requestedBranch && requestedBranch !== user.facilityID) {
    return forbidden(res, 'Access denied: You cannot access data for another branch.');
  }

  req.branchId = user.facilityID;
  next();
}

/**
 * Check if user has a specific permission.
 * Admins implicitly have all permissions.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return unauthorized(res);

    // Global Admin has all permissions
    if (user.isGlobalAdmin || user.permissions.includes('*')) {
      return next();
    }

    if (user.permissions.includes(permission)) {
      return next();
    }

    return forbidden(res, `Access denied: Missing permission '${permission}'.`);
  };
}

/**
 * Require global Admin role specifically.
 * Used for price changes, branch creation, staff management.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return forbidden(res, 'Access denied: Global Administrator role required.');
  }
  next();
}

/**
 * CRITICAL: Protect all product price modification endpoints.
 * Rejects non-Admin requests with 403 Forbidden and logs the attempt.
 */
async function requireAdminPriceControl(req, res, next) {
  const user = req.user;
  if (!user || user.role !== 'Admin') {
    // Log unauthorized price change attempt
    try {
      await db.query(
        `INSERT INTO audit_logs (facilityID, user_id, user_name, action, entity_type, entity_id, old_values, ip_address)
         VALUES (?, ?, ?, 'UNAUTHORIZED_PRICE_CHANGE_ATTEMPT', 'stocks', ?, '{}', ?)`,
        [
          user?.facilityID || 'unknown',
          user?.id || 0,
          user?.name || 'unknown',
          req.params.id || 'unknown',
          req.ip,
        ]
      );
    } catch (_) { /* don't fail the response due to log error */ }

    return forbidden(
      res,
      'Forbidden: Only the Global Administrator is authorized to modify product prices.'
    );
  }
  next();
}

module.exports = {
  authenticate,
  requireBranchScope,
  requirePermission,
  requireAdmin,
  requireAdminPriceControl,
};
