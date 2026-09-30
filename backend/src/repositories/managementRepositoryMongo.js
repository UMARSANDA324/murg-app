const { Branch, User, Stock, Shipment, Debt, Order, Customer, AuditLog } = require('../models');

/**
 * ManagementRepositoryMongo — MongoDB-based management operations.
 * Preserves all business logic from MySQL version.
 */
class ManagementRepositoryMongo {
  /**
   * Global multi-branch administrative overview
   */
  async getOverview() {
    // Define today for queries
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const businessDate = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const today = new Date(Date.UTC(
      Number(businessDate.year), Number(businessDate.month) - 1, Number(businessDate.day), -1
    ));
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // 1. Branch stats
    const branches = await Branch.find({}).sort({ mysqlId: 1 }).lean();
    const totalBranches = branches.length;
    const activeBranches = branches.filter(b => b.status === 'active').length;

    // 2. Staff stats
    const staff = await User.find({ status: 1 }).lean();
    const totalStaff = staff.length;
    const adminCount = staff.filter(s => s.role === 'Admin').length;
    const cashierCount = staff.filter(s => s.role === 'Staff').length;

    // 3. Stock inventory valuation across all branches
    const stockStats = await Stock.aggregate([
      { $match: { status: 'active' } },
      {
        $group: {
          _id: null,
          total_products: { $sum: 1 },
          total_units: { $sum: { $toDouble: '$quantity' } },
          total_cost_value: { $sum: { $multiply: [{ $toDouble: '$quantity' }, { $toDouble: '$buying' }] } },
          total_retail_value: { $sum: { $multiply: [{ $toDouble: '$quantity' }, { $toDouble: '$selling' }] } },
        },
      },
    ]);

    // 4. Shipment logistics stats
    const shipmentStats = await Shipment.aggregate([
      {
        $group: {
          _id: null,
          total_shipments: { $sum: 1 },
          in_transit_count: { $sum: { $cond: [{ $eq: ['$status', 'In Transit'] }, 1, 0] } },
          received_total_count: { $sum: { $cond: [{ $eq: ['$status', 'Received'] }, 1, 0] } },
        },
      },
    ]);

    // Count received today
    const receivedToday = await Shipment.countDocuments({
      status: 'Received',
      received_at: { $gte: today, $lt: tomorrow }
    });

    // 5. Receivables / Outstanding debts
    const debtStats = await Debt.aggregate([
      { $match: { balance: { $gt: 0 } } },
      {
        $group: {
          _id: null,
          debtor_count: { $sum: 1 },
          total_debt_balance: { $sum: { $toDouble: '$balance' } },
        },
      },
    ]);

    // 6. Today's sales across all branches
    const salesStats = await Order.aggregate([
      {
        $match: {
          creation: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: '$orderID',
          order_net: { $first: {
            $cond: [
              { $ne: ['$net_total', null] },
              { $toDouble: '$net_total' },
              { $toDouble: '$subtotal' },
            ],
          } },
        },
      },
      {
        $group: {
          _id: null,
          today_sales_total: { $sum: '$order_net' },
          today_orders_count: { $sum: 1 },
        },
      },
    ]);

    // 7. Customer stats across all branches
    const customerStats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          total_customers: { $sum: 1 },
          unique_customers: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$phone', null] },
                    { $ne: ['$phone', ''] },
                    { $ne: ['$phone', '0'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // 8. Recent audit log count
    const auditCount = await AuditLog.countDocuments();

    return {
      todaySales: {
        total: parseFloat(salesStats[0]?.today_sales_total || 0),
        count: parseInt(salesStats[0]?.today_orders_count || 0),
      },
      inventory: {
        total_products: parseInt(stockStats[0]?.total_products || 0),
        total_units: parseFloat(stockStats[0]?.total_units || 0),
        total_cost_value: parseFloat(stockStats[0]?.total_cost_value || 0),
        total_retail_value: parseFloat(stockStats[0]?.total_retail_value || 0),
      },
      customers: {
          total: parseInt(customerStats[0]?.total_customers || 0),
        raw_total: parseInt(customerStats[0]?.total_customers || 0),
      },
      shipments: {
        total: parseInt(shipmentStats[0]?.total_shipments || 0),
        in_transit: parseInt(shipmentStats[0]?.in_transit_count || 0),
        received_today: receivedToday,
        received: parseInt(shipmentStats[0]?.received_total_count || 0),
      },
      debts: {
        debtor_count: parseInt(debtStats[0]?.debtor_count || 0),
        total_balance: parseFloat(debtStats[0]?.total_debt_balance || 0),
      },
      branches: {
        total: totalBranches,
        active: activeBranches,
        list: branches,
      },
      staff: {
        total: totalStaff,
        admins: adminCount,
        cashiers: cashierCount,
      },
      audit: {
        total_logs: auditCount,
      },
    };
  }

  /**
   * System audit log retrieval with pagination
   */
  async getAuditLogs({ limit = 50, offset = 0, action = null, facilityID = null } = {}) {
    const query = {};
    
    if (action) {
      query.action = action;
    }
    if (facilityID) {
      query.facilityID = facilityID;
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await AuditLog.countDocuments(query);

    return {
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
  }
}

module.exports = new ManagementRepositoryMongo();
