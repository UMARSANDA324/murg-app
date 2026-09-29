const { Expense } = require('../models');

/**
 * ExpenseRepositoryMongo — MongoDB-based expense operations.
 */
class ExpenseRepositoryMongo {
  async findAll(facilityID, { startDate = null, endDate = null, limit = 100 } = {}) {
    const query = { facilityID };
    if (startDate) query.date = { ...query.date, $gte: new Date(startDate) };
    if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };

    return await Expense.find(query)
      .sort({ date: -1 })
      .limit(limit)
      .lean();
  }

  async findById(id, facilityID) {
    return await Expense.findOne({ _id: id, facilityID }).lean();
  }

  async create({ facilityID, item, price, type, date }) {
    const expense = await Expense.create({
      facilityID,
      item,
      price,
      type,
      date: date || new Date(),
      mysqlId: Date.now(),
    });
    return expense;
  }

  async update(id, facilityID, { item, price, type, date }) {
    const result = await Expense.updateOne(
      { _id: id, facilityID },
      { item, price, type, date }
    );
    return result.modifiedCount > 0;
  }

  async delete(id, facilityID) {
    const result = await Expense.deleteOne({ _id: id, facilityID });
    return result.deletedCount > 0;
  }

  async getTotals(facilityID, { startDate = null, endDate = null } = {}) {
    const matchQuery = { facilityID };
    if (startDate) matchQuery.date = { ...matchQuery.date, $gte: new Date(startDate) };
    if (endDate) matchQuery.date = { ...matchQuery.date, $lte: new Date(endDate) };

    const result = await Expense.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_expenses: { $sum: '$price' },
          count: { $sum: 1 },
        },
      },
    ]);

    return result[0] || { total_expenses: 0, count: 0 };
  }
}

module.exports = new ExpenseRepositoryMongo();
