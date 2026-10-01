const analyticsRepo = require('../repositories/analyticsRepository');
const { FinancialReportingService } = require('../services/financialReportingService');
const { success, error, forbidden } = require('../utils/responseUtils');

const financialReportingService = new FinancialReportingService();

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
      const dateBounds = await analyticsRepo.getDateBoundaries(req.query.date || null);
      
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
      if (err instanceof TypeError) {
        return error(res, err.message, 400);
      }
      next(err);
    }
  }

  async getFinancialReport(req, res, next) {
    try {
      const report = await financialReportingService.getReport({
        branchId: req.query.branchId || 'all',
        period: req.query.period || 'week',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        weekStart: req.query.weekStart,
        month: req.query.month,
        year: req.query.year,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }

  async getWeeklyReport(req, res, next) {
    try {
      const report = await financialReportingService.getReport({
        branchId: req.query.branchId || 'all',
        period: 'week',
        weekStart: req.query.weekStart || null,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }

  async getMonthlyReport(req, res, next) {
    try {
      const report = await financialReportingService.getReport({
        branchId: req.query.branchId || 'all',
        period: 'month',
        year: req.query.year,
        month: req.query.month,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }

  async getYearlyReport(req, res, next) {
    try {
      const report = await financialReportingService.getReport({
        branchId: req.query.branchId || 'all',
        period: 'year',
        year: req.query.year,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }

  async getDebtorReport(req, res, next) {
    try {
      const report = await financialReportingService.getDebtorReport({
        branchId: req.query.branchId || 'all',
        customerId: req.query.customerId || null,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }

  async getHistoryReport(req, res, next) {
    try {
      const report = await financialReportingService.getHistoryReport({
        branchId: req.query.branchId || 'all',
        period: req.query.period || 'custom',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        weekStart: req.query.weekStart,
        month: req.query.month,
        year: req.query.year,
      });
      return success(res, report);
    } catch (err) {
      if (err instanceof TypeError) return error(res, err.message, 400);
      if (err.statusCode) return error(res, err.message, err.statusCode);
      next(err);
    }
  }
}

module.exports = new AnalyticsController();
