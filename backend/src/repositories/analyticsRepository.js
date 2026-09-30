const { Order } = require('../models');

const TIME_ZONE = 'Africa/Lagos';
const UTC_OFFSET_MINUTES = 60;
const TIME_ZONE_LABEL = 'Africa/Lagos (+01:00)';

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('Date must use YYYY-MM-DD format.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new TypeError('Date must be a valid calendar date.');
  }
  return parsed;
}

function currentBusinessDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, days) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return formatDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function businessDayStart(date) {
  const value = parseDate(date);
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    0,
    -UTC_OFFSET_MINUTES
  ));
}

function countInPeriod(start, end, classification = null) {
  const conditions = [
    { $gte: ['$creation', start] },
    { $lt: ['$creation', end] },
  ];
  if (classification) conditions.push(classification);
  return { $sum: { $cond: [{ $and: conditions }, 1, 0] } };
}

function buildPeriodMetrics(start, end, normalSale, debtSale) {
  return {
    total: countInPeriod(start, end),
    normal: countInPeriod(start, end, normalSale),
    debt: countInPeriod(start, end, debtSale),
  };
}

/**
 * AnalyticsRepository — Sales activity metrics (DAS/WAS/MAS)
 * MongoDB aggregation covering both normal and debt sales.
 * All queries support facilityID scoping for branch isolation,
 * or cross-branch aggregation for Global Admin.
 * Uses official business timezone: Africa/Lagos (+01:00).
 */
class AnalyticsRepository {
  /**
  * Get date boundaries for target day, calendar week (Mon-Sun), and month in Africa/Lagos.
   * @param {string|null} targetDate - Optional YYYY-MM-DD
   */
  async getDateBoundaries(targetDate = null) {
    const today = targetDate || currentBusinessDate();
    const parsedToday = parseDate(today);
    const mondayOffset = (parsedToday.getUTCDay() + 6) % 7;
    const weekStart = addDays(today, -mondayOffset);
    const weekEnd = addDays(weekStart, 6);
    const monthStart = formatDate(parsedToday.getUTCFullYear(), parsedToday.getUTCMonth() + 1, 1);
    const monthEndDate = new Date(Date.UTC(parsedToday.getUTCFullYear(), parsedToday.getUTCMonth() + 1, 0));

    return {
      today,
      weekStart,
      weekEnd,
      monthStart,
      monthEnd: formatDate(monthEndDate.getUTCFullYear(), monthEndDate.getUTCMonth() + 1, monthEndDate.getUTCDate()),
      timezone: TIME_ZONE_LABEL,
    };
  }

  /**
   * Unified authoritative aggregation for DAS, WAS, MAS and sales/debt breakdown.
   * Scoped by facilityID if provided, or entire application if null.
   */
  async getSalesActivity({ facilityID = null, date, weekStart, weekEnd, monthStart, monthEnd }) {
    const dayStart = businessDayStart(date);
    const dayEnd = businessDayStart(addDays(date, 1));
    const weekStartDate = businessDayStart(weekStart);
    const weekEndDate = businessDayStart(addDays(weekEnd, 1));
    const monthStartDate = businessDayStart(monthStart);
    const monthEndDate = businessDayStart(addDays(monthEnd, 1));
    const rangeStart = new Date(Math.min(weekStartDate.getTime(), monthStartDate.getTime()));
    const rangeEnd = new Date(Math.max(weekEndDate.getTime(), monthEndDate.getTime()));

    const match = {
      orderID: { $exists: true, $ne: null },
      creation: { $gte: rangeStart, $lt: rangeEnd },
    };
    if (facilityID) match.facilityID = facilityID;

    const paymentLower = { $toLower: { $ifNull: [{ $toString: '$payment' }, ''] } };
    const statusNumber = {
      $convert: { input: '$status', to: 'int', onError: null, onNull: null },
    };
    const isDebt = {
      $or: [{ $eq: [paymentLower, 'credit'] }, { $eq: [statusNumber, 0] }],
    };
    const isNormal = {
      $and: [
        { $ne: [statusNumber, null] },
        { $ne: [statusNumber, 0] },
        { $ne: [paymentLower, 'credit'] },
      ],
    };

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$orderID',
          creation: { $first: '$creation' },
          payment: { $first: '$payment' },
          status: { $first: '$status' },
        },
      },
      {
        $group: {
          _id: null,
          das: buildPeriodMetrics(dayStart, dayEnd, isNormal, isDebt).total,
          was: buildPeriodMetrics(weekStartDate, weekEndDate, isNormal, isDebt).total,
          mas: buildPeriodMetrics(monthStartDate, monthEndDate, isNormal, isDebt).total,
          das_normal: buildPeriodMetrics(dayStart, dayEnd, isNormal, isDebt).normal,
          das_debt: buildPeriodMetrics(dayStart, dayEnd, isNormal, isDebt).debt,
          was_normal: buildPeriodMetrics(weekStartDate, weekEndDate, isNormal, isDebt).normal,
          was_debt: buildPeriodMetrics(weekStartDate, weekEndDate, isNormal, isDebt).debt,
          mas_normal: buildPeriodMetrics(monthStartDate, monthEndDate, isNormal, isDebt).normal,
          mas_debt: buildPeriodMetrics(monthStartDate, monthEndDate, isNormal, isDebt).debt,
        },
      },
    ]);
    const r = rows[0] || {};

    return {
      das: parseInt(r.das || 0),
      was: parseInt(r.was || 0),
      mas: parseInt(r.mas || 0),
      breakdown: {
        daily: {
          normalSales: parseInt(r.das_normal || 0),
          debtSales: parseInt(r.das_debt || 0),
          total: parseInt(r.das || 0),
        },
        weekly: {
          normalSales: parseInt(r.was_normal || 0),
          debtSales: parseInt(r.was_debt || 0),
          total: parseInt(r.was || 0),
        },
        monthly: {
          normalSales: parseInt(r.mas_normal || 0),
          debtSales: parseInt(r.mas_debt || 0),
          total: parseInt(r.mas || 0),
        },
      },
    };
  }

  /**
   * Backward-compatible convenience methods
   */
  async getDailyActiveSales({ facilityID, date }) {
    const bounds = await this.getDateBoundaries(date);
    const metrics = await this.getSalesActivity({ facilityID, ...bounds });
    return metrics.das;
  }

  async getWeeklyActiveSales({ facilityID, weekStart, weekEnd }) {
    const bounds = await this.getDateBoundaries(weekStart);
    const metrics = await this.getSalesActivity({ facilityID, ...bounds, weekStart, weekEnd });
    return metrics.was;
  }

  async getMonthlyActiveSales({ facilityID, monthStart, monthEnd }) {
    const bounds = await this.getDateBoundaries(monthStart);
    const metrics = await this.getSalesActivity({ facilityID, ...bounds, monthStart, monthEnd });
    return metrics.mas;
  }

  async getEntireAppSalesActivity({ date, weekStart, weekEnd, monthStart, monthEnd }) {
    return this.getSalesActivity({ facilityID: null, date, weekStart, weekEnd, monthStart, monthEnd });
  }
}

module.exports = new AnalyticsRepository();
