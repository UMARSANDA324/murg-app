const analyticsRepo = require('../repositories/analyticsRepository');
const { success, error, forbidden } = require('../utils/responseUtils');

class AnalyticsController {
  async getSalesActivity(req, res, next) {
    try {
      const user = req.user;
      const requestedBranch = req.query.branchId || null;
      const targetDate = req.query.date || null;

      // Validate branch scope
      let facilityID = null;
      if (!user.isGlobalAdmin) {
        // Branch staff can ONLY access their own assigned branch
        if (requestedBranch && requestedBranch !== user.facilityID) {
          return forbidden(res, 'Access denied: You cannot access analytics for another branch.');
        }
        facilityID = user.facilityID;
      } else {
        // Global admin can request specific branch or entire app (when branchId is omitted or 'all')
        if (requestedBranch && requestedBranch !== 'all') {
          facilityID = requestedBranch;
        }
      }

      // Get exact business date boundaries in Africa/Lagos (+01:00)
      const dateBounds = await analyticsRepo.getDateBoundaries(targetDate);

      const metrics = await analyticsRepo.getSalesActivity({
        facilityID,
        date: dateBounds.today,
        weekStart: dateBounds.weekStart,
        weekEnd: dateBounds.weekEnd,
        monthStart: dateBounds.monthStart,
        monthEnd: dateBounds.monthEnd,
      });

      return success(res, {
        ...metrics,
        scope: facilityID || 'entire-app',
        period: {
          day: dateBounds.today,
          weekStart: dateBounds.weekStart,
          weekEnd: dateBounds.weekEnd,
          monthStart: dateBounds.monthStart,
          monthEnd: dateBounds.monthEnd,
          timezone: dateBounds.timezone,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
