const managementRepo = require('../repositories/managementRepository');
const { success, error, forbidden } = require('../utils/responseUtils');

// Server-side strict allowlists
// NOTE: Do NOT add decommissioned paths here. The following were removed because
// they have been replaced by the React application and now issue 302 redirects:
//   /system/index.php, /system/branch.php, /system/staff.php,
//   /system/cart.php, /system/customer.php (+ extensionless aliases)
const ADMIN_ALLOWED_DESTINATIONS = [
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
  '/system/stocks.php',
  '/system/out.php',
  '/system/profile.php',
  // Extensionless aliases
  '/system/expense',
  '/system/deposit',
  '/system/purchase',
  '/system/view-purchase',
  '/system/store',
  '/system/return',
  '/system/report',
  '/system/monthly',
  '/system/weekly',
  '/system/invoice',
  '/system/track-stock',
  '/system/stocks',
  '/system/out',
  '/system/profile',
];

// NOTE: Do NOT add decommissioned paths here. The following were removed because
// they have been replaced by the React application and now issue 302 redirects:
//   /sub/index.php, /sub/cart.php, /sub/customer.php (+ extensionless aliases)
const STAFF_ALLOWED_DESTINATIONS = [
  '/sub/expense.php',
  '/sub/deposit.php',
  '/sub/purchase.php',
  '/sub/view-purchase.php',
  '/sub/return.php',
  '/sub/report.php',
  '/sub/stocks.php',
  '/sub/out.php',
  '/sub/profile.php',
  // Extensionless aliases
  '/sub/expense',
  '/sub/deposit',
  '/sub/purchase',
  '/sub/return',
  '/sub/report',
  '/sub/stocks',
  '/sub/out',
  '/sub/profile',
];

class ManagementController {
  async getOverview(req, res, next) {
    try {
      const overview = await managementRepo.getOverview();
      return success(res, overview);
    } catch (err) {
      next(err);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const action = req.query.action || null;
      const facilityID = req.query.facilityID || null;

      const result = await managementRepo.getAuditLogs({ limit, offset, action, facilityID });
      return success(res, result);
    } catch (err) {
      next(err);
    }
  }

  async createBridgeTicket(req, res, next) {
    try {
      const { targetPath } = req.body;
      const user = req.user;

      if (!targetPath || typeof targetPath !== 'string') {
        return error(res, 'Target destination path is required', 400);
      }

      // 1. Sanitize & inspect path (reject external URLs, protocol-relative, null bytes)
      const trimmedPath = targetPath.trim();
      if (
        trimmedPath.startsWith('http://') ||
        trimmedPath.startsWith('https://') ||
        trimmedPath.startsWith('//') ||
        trimmedPath.includes('\0') ||
        trimmedPath.includes('\\')
      ) {
        return error(res, 'Invalid destination path. Only internal paths are allowed.', 400);
      }

      // Extract base path without query string for allowlist evaluation
      const basePath = trimmedPath.split('?')[0];

      const isAdmin = user.isGlobalAdmin || user.role === 'Admin';

      let isPermitted = false;
      if (isAdmin) {
        isPermitted =
          ADMIN_ALLOWED_DESTINATIONS.includes(basePath) ||
          STAFF_ALLOWED_DESTINATIONS.includes(basePath);
      } else {
        // Staff cannot access /system/* destinations
        isPermitted = STAFF_ALLOWED_DESTINATIONS.includes(basePath);
      }

      if (!isPermitted) {
        return forbidden(
          res,
          `Access to legacy destination "${basePath}" is not permitted for role "${user.role}".`
        );
      }

      // 2. Generate secure ticket
      const ticket = await managementRepo.createBridgeTicket({
        userId: user.id,
        facilityID: user.facilityID,
        role: user.role,
        email: user.email,
        name: user.name,
        targetPath: trimmedPath,
      });

      return success(res, {
        ticket,
        bridgeUrl: `/auth_bridge.php?ticket=${ticket}`,
        targetPath: trimmedPath,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ManagementController();
