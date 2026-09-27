const analyticsRepo = require('../repositories/analyticsRepository');
const { success, error, forbidden } = require('../utils/responseUtils');

class AnalyticsController {
  async getSalesActivity(req, res, next) {
    try {
      const user = req.user;
      
      if (!user) {
        return forbidden(res, 'Authentication required');
      }
      
      // Determine facilityID based on user role
      let facilityID = null;
      if (user.isGlobalAdmin) {
        // Admin can see entire app (null) or specific branch if requested
        const requestedBranch = req.query.branchId || null;
        if (requestedBranch && requestedBranch !== 'all') {
          facilityID = requestedBranch;
        }
      } else {
        // Branch users can only see their own branch
        facilityID = user.facilityID;
      }
      
      // Get date boundaries from database
      const dateBounds = await analyticsRepo.getDateBoundaries();
      
      const metrics = await analyticsRepo.getSalesActivity({
        facilityID,
        date: dateBounds.today,
        weekStart: dateBounds.weekStart,
        weekEnd: dateBounds.weekEnd,
        monthStart: dateBounds.monthStart,
        monthEnd: dateBounds.monthEnd,
      });
      
      return success(res, {
        das: metrics.das,
        was: metrics.was,
        mas: metrics.mas,
        breakdown: metrics.breakdown,
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
