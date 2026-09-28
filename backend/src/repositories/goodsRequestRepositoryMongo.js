const { GoodsRequest, User, Stock, Shipment } = require('../models');
const { mongoose } = require('../config/mongodb');

/**
 * GoodsRequestRepositoryMongo — MongoDB-based goods request operations.
 */
class GoodsRequestRepositoryMongo {
  async findAll(facilityID) {
    return await GoodsRequest.find({
      $or: [{ requesting_branch: facilityID }, { source_branch: facilityID }],
    })
      .populate('staff_id')
      .populate('stock_id')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findById(id) {
    return await GoodsRequest.findById(id)
      .populate('staff_id')
      .populate('stock_id')
      .lean();
  }

  async create({ staff_id, staff_name, requesting_branch, stock_id, product_name, requested_quantity, unit_type, reason }) {
    const request_code = `REQ-${Date.now()}`;
    const request = await GoodsRequest.create({
      request_code,
      staff_id,
      staff_name,
      requesting_branch,
      stock_id,
      product_name,
      requested_quantity,
      unit_type,
      reason,
      status: 'PENDING',
      mysqlId: Date.now(),
    });
    return request;
  }

  async updateStatus(id, status, admin_notes = null, source_branch = null, shipment_id = null, reviewed_by = null) {
    const updateData = { status };
    if (admin_notes) updateData.admin_notes = admin_notes;
    if (source_branch) updateData.source_branch = source_branch;
    if (shipment_id) updateData.shipment_id = shipment_id;
    if (reviewed_by) {
      updateData.reviewed_by = reviewed_by;
      updateData.reviewed_at = new Date();
    }

    return await GoodsRequest.findByIdAndUpdate(id, updateData);
  }

  async findByRequestCode(request_code) {
    return await GoodsRequest.findOne({ request_code }).lean();
  }
}

module.exports = new GoodsRequestRepositoryMongo();
