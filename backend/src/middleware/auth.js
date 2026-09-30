const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { User } = require('../models');
const { unauthorized, forbidden } = require('../utils/responseUtils');
const { JWT_SECRET } = require('../config/auth');
const { mongoose: appMongoose } = require('../config/mongodb');
const { recordAuditLog } = require('../services/auditLogService');

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
    if (!mongoose.Types.ObjectId.isValid(decoded.sub)) {
      return unauthorized(res, 'Invalid authentication token.');
    }

    const user = await User.findById(decoded.sub)
      .select('-password -password_hash')
      .lean();

    if (!user || user.status !== 1) {
      return unauthorized(res, 'Account not found or suspended.');
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      facilityID: user.facilityID,
      isGlobalAdmin: user.role === 'Admin',
      permissions: user.role === 'Admin'
        ? ['*']
        : (Array.isArray(user.permissions) ? user.permissions.filter((permission) => permission !== '*') : []),
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
    return next(err);
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
    const session = await appMongoose.startSession();
    try {
      await session.withTransaction(async () => recordAuditLog({
        facilityID: user?.facilityID || 'unknown',
        user_id: user?.id,
        user_name: user?.name || 'unknown',
        action: 'UNAUTHORIZED_PRICE_CHANGE_ATTEMPT',
        entity_type: 'stocks',
        entity_id: req.params.id || 'unknown',
        old_values: {},
        ip_address: req.ip,
      }, session));
    } catch (auditError) {
      console.error('[AUTH_AUDIT_FAILURE]', {
        method: req.method,
        endpoint: req.originalUrl,
        userId: user?.id || null,
        branchId: user?.facilityID || null,
        error: auditError.message,
      });
    } finally {
      await session.endSession();
    }

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
