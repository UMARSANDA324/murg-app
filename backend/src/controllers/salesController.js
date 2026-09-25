const salesRepo = require('../repositories/salesRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, created, error, notFound, forbidden } = require('../utils/responseUtils');

class SalesController {
  async list(req, res, next) {
    try {
      const facilityID = req.branchId || req.user.facilityID;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;

      const sales = await salesRepo.findByBranch({ facilityID, startDate, endDate, limit, offset });
      return success(res, sales);
    } catch (err) {
      next(err);
    }
  }

  async getSalesByDate(req, res, next) {
    try {
      const facilityID = req.branchId || req.user.facilityID;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const limit = req.query.limit ? parseInt(req.query.limit) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset) : 0;

      const sales = await salesRepo.getSalesByDateRange({ facilityID, startDate, endDate, limit, offset });
      return success(res, sales);
    } catch (err) {
      next(err);
    }
  }

  async getOrderItems(req, res, next) {
    try {
      const facilityID = req.branchId || req.user.facilityID;
      const orderID = req.params.orderId;
      const items = await salesRepo.findOrderItems(orderID, facilityID);
      return success(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getReceipt(req, res, next) {
    try {
      const orderID = req.params.orderId;
      const facilityID = req.user.isGlobalAdmin ? null : req.user.facilityID;
      const receipt = await salesRepo.getReceiptData(orderID, facilityID);
      if (!receipt) {
        return notFound(res, 'Receipt not found');
      }

      return success(res, receipt);
    } catch (err) {
      next(err);
    }
  }

  async checkout(req, res, next) {
    try {
      const facilityID = req.branchId;
      const {
        items,
        buyerName,
        customerName,
        customerId,
        globalDiscount = 0,
        payment = { cash: 0, pos: 0, transfer: 0, bankName: null },
        isCredit = false,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return error(res, 'Cart is empty. Please add items before checking out.', 400);
      }

      // Validate payment totals if not a credit order
      const totalPaid = (parseFloat(payment.cash) || 0) + (parseFloat(payment.pos) || 0) + (parseFloat(payment.transfer) || 0);

      const result = await salesRepo.atomicCheckout({
        facilityID,
        staffID: req.user.id,
        staffName: req.user.name,
        items: items.map(i => ({
          stockId: parseInt(i.stockId),
          quantity: parseFloat(i.quantity),
          price: parseFloat(i.price),
          itemDiscount: parseFloat(i.itemDiscount) || 0,
        })),
        buyerName: buyerName ? buyerName.trim() : null,
        customerName: customerName ? customerName.trim() : null,
        customerID: customerId ? parseInt(customerId) : null,
        globalDiscount: parseFloat(globalDiscount) || 0,
        payment: {
          cash: parseFloat(payment.cash) || 0,
          pos: parseFloat(payment.pos) || 0,
          transfer: parseFloat(payment.transfer) || 0,
          bankName: payment.bankName || null,
        },
        isCredit: Boolean(isCredit),
      });

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: isCredit ? 'CREDIT_SALE_COMPLETED' : 'SALE_COMPLETED',
        referenceId: result.orderID,
      });

      return created(res, result, 'Order completed successfully');
    } catch (err) {
      if (err.message.includes('Insufficient stock')) {
        return error(res, err.message, 409);
      }
      next(err);
    }
  }
}

module.exports = new SalesController();
