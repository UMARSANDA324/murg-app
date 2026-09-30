const { Expense } = require('../models');
const { Branch } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');

function dateFilter(fromDate, toDate) {
  if (!fromDate && !toDate) return null;
  const range = {};
  if (fromDate) range.$gte = new Date(fromDate);
  if (toDate) {
    const end = new Date(toDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(toDate)) end.setDate(end.getDate() + 1);
    range.$lt = end;
  }
  return range;
}

function expenseDTO(expense) {
  return { ...expense, id: expense._id.toString() };
}

/**
 * ExpenseRepositoryMongo — MongoDB-based expense operations.
 */
class ExpenseRepositoryMongo {
  async getExpenses({ facilityID, type = null, fromDate = null, toDate = null, limit = 200 } = {}) {
    const query = { facilityID };
    if (type) query.type = type;
    const dates = dateFilter(fromDate, toDate);
    if (dates) query.date = dates;

    const rows = await Expense.find(query)
      .sort({ date: -1 })
      .limit(Math.min(Math.max(Number(limit) || 200, 1), 500))
      .lean();
    return rows.map(expenseDTO);
  }

  async getExpenseById(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const expense = await Expense.findOne({ _id: id, facilityID }).lean();
    return expense ? expenseDTO(expense) : null;
  }

  async createExpense({ facilityID, item, price, type, date = new Date() }) {
    if (!await Branch.exists({ facilityID })) throw new Error('Branch not found.');
    const session = await require('../config/mongodb').mongoose.startSession();
    let id;
    try {
      await session.withTransaction(async () => {
        const [mysqlId] = await reserveLegacyIds(Expense, 'expenseId', 1, session);
        const [expense] = await Expense.create([{ facilityID, item, price, type, date, mysqlId }], { session });
        id = expense._id.toString();
      });
      return id;
    } finally { await session.endSession(); }
  }

  async updateExpense(id, { facilityID, item, price, type, date = new Date() }) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Expense.updateOne(
      { _id: id, facilityID },
      { item, price, type, date }
    );
    return result.matchedCount > 0;
  }

  async deleteExpense(id, facilityID) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Expense.deleteOne({ _id: id, facilityID });
    return result.deletedCount > 0;
  }

  async getExpenseTotals({ facilityID, fromDate = null, toDate = null } = {}) {
    const matchQuery = { facilityID };
    const dates = dateFilter(fromDate, toDate);
    if (dates) matchQuery.date = dates;

    const result = await Expense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_in: { $sum: { $cond: [{ $eq: ['$type', 'in'] }, '$price', 0] } },
          total_out: { $sum: { $cond: [{ $eq: ['$type', 'out'] }, '$price', 0] } },
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0] || { total_in: 0, total_out: 0, count: 0 };
  }

  async getTodayTotals(facilityID) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return this.getExpenseTotals({ facilityID, fromDate: start.toISOString(), toDate: end.toISOString() });
  }

  async getAllTimeTotals(facilityID) {
    return this.getExpenseTotals({ facilityID });
  }
}

module.exports = new ExpenseRepositoryMongo();
