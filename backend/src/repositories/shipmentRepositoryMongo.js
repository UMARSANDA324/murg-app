const { Shipment, Stock, StockMovement } = require('../models');
const { mongoose } = require('../config/mongodb');

/**
 * ShipmentRepositoryMongo — MongoDB-based shipment operations.
 */
class ShipmentRepositoryMongo {
  async findAll(facilityID) {
    return await Shipment.find({
      $or: [{ source_branch: facilityID }, { destination_branch: facilityID }],
    })
      .populate('items.stock_id')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id) {
    return await Shipment.findById(id).populate('items.stock_id').lean();
  }

  async create({ tracking_number, source_branch, destination_branch, source_store_id, destination_store_id, items, created_by }) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Validate and lock stock
      for (const item of items) {
        const stock = await Stock.findOne({ _id: item.stock_id, facilityID: source_branch })
          .session(session)
          .lean();
        
        if (!stock) {
          throw new Error(`Stock not found for item: ${item.product_name}`);
        }

        const available = parseFloat(stock.quantity) || 0;
        if (item.quantity_sent > available) {
          throw new Error(`Insufficient stock for ${item.product_name}. Available: ${available}, Requested: ${item.quantity_sent}`);
        }

        // Deduct stock
        await Stock.updateOne(
          { _id: item.stock_id, facilityID: source_branch, quantity: { $gte: item.quantity_sent } },
          { $inc: { quantity: -item.quantity_sent } },
          { session }
        );

        // Record movement
        await StockMovement.create(
          [{
            facilityID: source_branch,
            stock_id: item.stock_id,
            movement_type: 'STOCK_OUT_TRANSFER',
            quantity_change: -item.quantity_sent,
            quantity_before: available,
            quantity_after: available - item.quantity_sent,
            reference_type: 'shipments',
            reference_id: tracking_number,
            notes: `Shipment to ${destination_branch}`,
            performed_by: created_by,
            mysqlId: Date.now(),
          }],
          { session }
        );
      }

      const shipment = await Shipment.create(
        [{
          tracking_number,
          source_branch,
          destination_branch,
          source_store_id,
          destination_store_id,
          status: 'Pending',
          created_by,
          items,
          mysqlId: Date.now(),
        }],
        { session }
      );

      await session.commitTransaction();
      return shipment[0];
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async updateStatus(id, status, received_by = null) {
    const updateData = { status };
    if (status === 'Received' && received_by) {
      updateData.received_by = received_by;
      updateData.received_at = new Date();
    }

    return await Shipment.findByIdAndUpdate(id, updateData);
  }

  async receiveShipment(id, facilityID, received_by) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const shipment = await Shipment.findById(id).session(session).lean();
      if (!shipment) throw new Error('Shipment not found');

      for (const item of shipment.items) {
        // Add stock to destination
        const stock = await Stock.findOne({ _id: item.stock_id, facilityID })
          .session(session)
          .lean();

        if (stock) {
          const currentQty = parseFloat(stock.quantity) || 0;
          await Stock.updateOne(
            { _id: item.stock_id, facilityID },
            { $inc: { quantity: item.quantity_sent } },
            { session }
          );

          // Record movement
          await StockMovement.create(
            [{
              facilityID,
              stock_id: item.stock_id,
              movement_type: 'STOCK_IN_TRANSFER',
              quantity_change: item.quantity_sent,
              quantity_before: currentQty,
              quantity_after: currentQty + item.quantity_sent,
              reference_type: 'shipments',
              reference_id: shipment.tracking_number,
              notes: `Received from ${shipment.source_branch}`,
              performed_by: received_by,
              mysqlId: Date.now(),
            }],
            { session }
          );
        }
      }

      await Shipment.findByIdAndUpdate(
        id,
        {
          status: 'Received',
          received_by,
          received_at: new Date(),
        },
        { session }
      );

      await session.commitTransaction();
      return true;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new ShipmentRepositoryMongo();
