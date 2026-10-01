const { Branch, User, Stock, Order, Debt, Shipment, Purchase, Counter } = require('../models');
const { mongoose } = require('../config/mongodb');

/**
 * BranchRepository — MongoDB-based branch operations.
 * Preserves all business logic from MySQL version.
 */
class BranchRepositoryMongo {
  /**
   * List all branches (Admin: all; Branch user: their own).
   */
  async findAll(facilityID = null) {
    const query = facilityID ? { facilityID } : {};
    const branches = await Branch.find(query).sort({ mysqlId: 1, facilityID: 1 }).lean();

    // Add staff count for each branch
    const result = await Promise.all(
      branches.map(async (branch) => {
        const staffCount = await User.countDocuments({ facilityID: branch.facilityID });
        return { ...branch, staff_count: staffCount };
      })
    );

    return result;
  }

  /**
   * Get a single branch by facilityID.
   */
  async findByFacilityID(facilityID) {
    return await Branch.findOne({ facilityID }).lean();
  }

  /**
   * Get next available facilityID and create new branch atomically.
   */
  async create({ name, address, phone, sales_mode = 'DEALER' }) {
    const session = await mongoose.startSession();
    let createdBranch;
    try {
      await session.withTransaction(async () => {
        // Use atomic counter increment
        const counter = await Counter.findOneAndUpdate(
          { name: 'facilityID' },
          { $inc: { lastID: 1 } },
          { new: true, upsert: true, session }
        ).lean();

        const newID = counter.lastID;
        const facilityID = `MURG/${String(newID).padStart(3, '0')}`;
        const validMode = sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER';

        const [branch] = await Branch.create(
          [{
            facilityID,
            name,
            address: address || null,
            phone: phone || null,
            sales_mode: validMode,
            status: 'active',
            mysqlId: newID,
          }],
          { session }
        );

        createdBranch = { insertId: branch._id, facilityID, sales_mode: validMode };
      });

      return createdBranch;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Update branch details.
   */
  async update(facilityID, { name, address, phone, sales_mode }) {
    const updateData = { name, address: address || null, phone: phone || null };
    if (sales_mode) {
      updateData.sales_mode = sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER';
    }
    const result = await Branch.updateOne({ facilityID }, updateData);
    return result.matchedCount > 0;
  }

  /**
   * Activate or deactivate a branch.
   */
  async setStatus(facilityID, status, session = null) {
    const result = await Branch.updateOne(
      { facilityID },
      { status },
      session ? { session } : {}
    );
    return result.matchedCount > 0;
  }

  /**
   * Get dashboard summary metrics for a specific branch.
   */
  async getDashboardMetrics(facilityID) {
    const branch = await Branch.findOne({ facilityID }).lean();
    const branchInfo = branch || { sales_mode: 'DEALER' };
    const salesMode = branchInfo.sales_mode || 'DEALER';

    // Today's sales
    const businessDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const businessDate = Object.fromEntries(businessDateParts.map(({ type, value }) => [type, value]));
    const today = new Date(Date.UTC(
      Number(businessDate.year), Number(businessDate.month) - 1, Number(businessDate.day), -1
    ));
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const todaySales = await Order.aggregate([
      {
        $match: {
          facilityID,
          creation: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: '$orderID',
          order_count: { $first: 1 },
          gross_sales: { $sum: '$subtotal' },
          total_discount: { $first: '$discount' },
          credit_sales: {
            $first: {
              $cond: [
                {
                  $or: [
                    { $eq: [{ $toLower: { $ifNull: [{ $toString: '$payment' }, ''] } }, 'credit'] },
                    { $eq: [{ $convert: { input: '$status', to: 'int', onError: null, onNull: null } }, 0] },
                  ],
                },
                '$net_total',
                0
              ]
            }
          },
          cash_sales: {
            $first: {
              $cond: [
                {
                  $and: [
                    { $ne: [{ $toLower: { $ifNull: [{ $toString: '$payment' }, ''] } }, 'credit'] },
                    { $eq: [{ $convert: { input: '$status', to: 'int', onError: null, onNull: null } }, 1] },
                  ],
                },
                '$amount_paid',
                0
              ]
            }
          },
        },
      },
      {
        $group: {
          _id: null,
          order_count: { $sum: '$order_count' },
          gross_sales: { $sum: '$gross_sales' },
          total_discount: { $sum: '$total_discount' },
          credit_sales: { $sum: '$credit_sales' },
          cash_sales: { $sum: '$cash_sales' },
        },
      },
    ]);

    const salesData = todaySales[0] || {
      order_count: 0,
      gross_sales: 0,
      total_discount: 0,
      credit_sales: 0,
      cash_sales: 0,
    };

    // Stock metrics
    const stockMetrics = await Stock.aggregate([
      {
        $match: {
          facilityID,
          status: 'active',
        },
      },
      {
        $group: {
          _id: null,
          total_products: { $sum: 1 },
          total_quantity: { $sum: '$quantity' },
          total_value: { $sum: { $multiply: ['$quantity', '$selling'] } },
        },
      },
    ]);

    const stockData = stockMetrics[0] || {
      total_products: 0,
      total_quantity: 0,
      total_value: 0,
    };

    // Debts
    const debts = await Debt.aggregate([
      {
        $match: {
          facilityID,
          balance: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          total_outstanding: { $sum: '$balance' },
          debtor_count: { $sum: 1 },
        },
      },
    ]);

    const debtData = debts[0] || { total_outstanding: 0, debtor_count: 0 };

    // Staff count
    const staffCount = await User.countDocuments({ facilityID, status: 1 });

    // Shipment metrics
    const shipmentMetrics = await Shipment.aggregate([
      {
        $match: {
          $or: [{ source_branch: facilityID }, { destination_branch: facilityID }],
          status: 'In Transit',
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: '$tracking_number',
          tracking_number: { $first: '$tracking_number' },
          incoming_units: {
            $sum: {
              $cond: [{ $eq: ['$destination_branch', facilityID] }, '$items.quantity_sent', 0],
            },
          },
          outgoing_units: {
            $sum: {
              $cond: [{ $eq: ['$source_branch', facilityID] }, '$items.quantity_sent', 0],
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          in_transit: { $sum: 1 },
          incoming_units: { $sum: '$incoming_units' },
          outgoing_units: { $sum: '$outgoing_units' },
          incoming_shipments: {
            $sum: {
              $cond: [{ $gt: ['$incoming_units', 0] }, 1, 0],
            },
          },
          outgoing_shipments: {
            $sum: {
              $cond: [{ $gt: ['$outgoing_units', 0] }, 1, 0],
            },
          },
        },
      },
    ]);

    const shipmentData = shipmentMetrics[0] || {
      in_transit: 0,
      incoming_units: 0,
      outgoing_units: 0,
      incoming_shipments: 0,
      outgoing_shipments: 0,
    };

    // Received from supplier today
    const receivedSupplier = await Purchase.aggregate([
      {
        $match: {
          facilityID,
          purchase_date: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          intakes_today: { $sum: 1 },
          units_today: { $sum: '$quantity' },
        },
      },
    ]);

    const supplierData = receivedSupplier[0] || { intakes_today: 0, units_today: 0 };

    // Received from transfers today
    const receivedTransfers = await Shipment.aggregate([
      {
        $match: {
          destination_branch: facilityID,
          status: 'Received',
          received_at: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: null,
          transfers_today: { $sum: 1 },
          units_today: { $sum: '$items.quantity_received' },
        },
      },
    ]);

    const transferData = receivedTransfers[0] || { transfers_today: 0, units_today: 0 };

    const gross = salesData.gross_sales;
    const disc = salesData.total_discount;
    const net = gross - disc;

    return {
      sales_mode: salesMode,
      unit_label: salesMode === 'PER_YARD' ? 'Yards' : 'Belts',
      today_sales: {
        order_count: salesData.order_count,
        gross_sales: gross,
        total_discount: disc,
        net_sales: net,
        cash_sales: salesData.cash_sales,
        credit_sales: salesData.credit_sales,
      },
      stock: {
        total_products: stockData.total_products,
        total_quantity: stockData.total_quantity,
        total_value: stockData.total_value,
        unit_type: salesMode === 'PER_YARD' ? 'yards' : 'belts',
      },
      debts: {
        total_outstanding: debtData.total_outstanding,
        debtor_count: debtData.debtor_count,
      },
      staff: {
        active_count: staffCount,
      },
      shipments: {
        in_transit: shipmentData.in_transit,
        incoming_shipments: shipmentData.incoming_shipments,
        outgoing_shipments: shipmentData.outgoing_shipments,
        incoming_units: shipmentData.incoming_units,
        outgoing_units: shipmentData.outgoing_units,
      },
      received_today: {
        total_receipts: supplierData.intakes_today + transferData.transfers_today,
        total_units: supplierData.units_today + transferData.units_today,
        supplier_intakes: supplierData.intakes_today,
        supplier_units: supplierData.units_today,
        transfer_receipts: transferData.transfers_today,
        transfer_units: transferData.units_today,
      },
    };
  }
}

module.exports = new BranchRepositoryMongo();
