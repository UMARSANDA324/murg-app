const managementRepo = require('../repositories/managementRepository');
const { success, error, forbidden } = require('../utils/responseUtils');

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
}

module.exports = new ManagementController();
