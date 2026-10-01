const expenseRepo = require('../repositories/expenseRepositoryMongo');
const { mongoose } = require('../config/mongodb');
const { recordAuditLog } = require('../services/auditLogService');
const { success, error, forbidden, notFound } = require('../utils/responseUtils');

class ExpenseController {
  /**
   * GET /api/expenses
   * Get all expenses for the authenticated user's branch
   */
  async list(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const { type, fromDate, toDate } = req.query;

      const expenses = await expenseRepo.getExpenses({
        facilityID,
        type,
        fromDate,
        toDate,
      });

      return success(res, expenses);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/totals
   * Get expense totals for dashboard
   */
  async getTotals(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const { fromDate, toDate } = req.query;

      const totals = await expenseRepo.getExpenseTotals({
        facilityID,
        fromDate,
        toDate,
      });

      return success(res, totals);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/dashboard
   * Get dashboard summary cards
   */
  async getDashboard(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const [today, allTime] = await Promise.all([
        expenseRepo.getTodayTotals(facilityID),
        expenseRepo.getAllTimeTotals(facilityID),
      ]);

      return success(res, {
        today,
        allTime,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/expenses/:id
   * Get single expense by ID
   */
  async getById(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { id } = req.params;
      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const expense = await expenseRepo.getExpenseById(id, facilityID);
      if (!expense) {
        return notFound(res, 'Expense not found');
      }

      return success(res, expense);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/expenses
   * Create new expense
   */
  async create(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.body.branchId || user.facilityID)
        : user.facilityID;

      const { item, price, type } = req.body;

      // Validation
      if (!item || !price || !type) {
        return error(res, 'Item, price, and type are required');
      }

      if (!['in', 'out'].includes(type)) {
        return error(res, 'Type must be either "in" or "out"');
      }

      const expenseId = await expenseRepo.createExpense({
        facilityID,
        item,
        price: parseFloat(price),
        type,
      });

      const expense = await expenseRepo.getExpenseById(expenseId, facilityID);
      return success(res, expense, 'Expense created successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/expenses/:id
   * Update expense
   */
  async update(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { id } = req.params;
      const facilityID = user.isGlobalAdmin 
        ? (req.body.branchId || user.facilityID)
        : user.facilityID;

      const { item, price, type } = req.body;

      // Validation
      if (!item || !price || !type) {
        return error(res, 'Item, price, and type are required');
      }

      if (!['in', 'out'].includes(type)) {
        return error(res, 'Type must be either "in" or "out"');
      }

      const updated = await expenseRepo.updateExpense(id, {
        facilityID,
        item,
        price: parseFloat(price),
        type,
      });

      if (!updated) {
        return notFound(res, 'Expense not found');
      }

      const expense = await expenseRepo.getExpenseById(id, facilityID);
      return success(res, expense, 'Expense updated successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/expenses/:id
   * Delete expense
   */
  async delete(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const { id } = req.params;
      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;

      const expense = await expenseRepo.getExpenseById(id, facilityID);
      if (!expense) return notFound(res, 'Expense not found');

      const session = await mongoose.startSession();
      let archived = false;
      try {
        await session.withTransaction(async () => {
          archived = await expenseRepo.archiveExpense(id, facilityID, user.id, session);
          if (!archived) return;
          await recordAuditLog({
            facilityID,
            user_id: user.id,
            user_name: user.name,
            action: 'EXPENSE_ARCHIVED',
            entity_type: 'expenses',
            entity_id: id,
            old_values: { item: expense.item, price: expense.price, type: expense.type, date: expense.date },
            new_values: { isArchived: true },
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
          }, session);
        });
      } finally {
        await session.endSession();
      }
      if (!archived) return notFound(res, 'Expense not found');

      return success(res, null, 'Expense archived; the historical financial record is preserved.');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ExpenseController();
