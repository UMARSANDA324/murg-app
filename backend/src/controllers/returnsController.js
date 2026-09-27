const returnsRepo = require('../repositories/returnsRepository');
const { success, error, forbidden, notFound } = require('../utils/responseUtils');

class ReturnsController {
  /**
   * POST /api/returns/process
   * Process order return - restore stock, reverse debt, move to cart
   */
  async processReturn(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.body.branchId || user.facilityID)
        : user.facilityID;
      
      const staffID = user.id;
      const { orderID } = req.body;

      if (!orderID) {
        return error(res, 'Order ID is required');
      }

      // Validate order exists and belongs to branch
      const validation = await returnsRepo.validateOrderForReturn(orderID, facilityID);
      if (!validation.valid) {
        return notFound(res, validation.message);
      }

      // Process the return
      const result = await returnsRepo.processOrderReturn(orderID, facilityID, staffID);

      if (result.success) {
        return success(res, result, result.message);
      } else {
        return error(res, result.message);
      }
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/returns/validate/:orderID
   * Validate if an order can be returned
   */
  async validateOrder(req, res, next) {
    try {
      const user = req.user;
      if (!user) {
        return forbidden(res, 'Authentication required');
      }

      const facilityID = user.isGlobalAdmin 
        ? (req.query.branchId || user.facilityID)
        : user.facilityID;
      
      const { orderID } = req.params;

      const validation = await returnsRepo.validateOrderForReturn(orderID, facilityID);

      if (validation.valid) {
        return success(res, {
          orderID: validation.order.orderID,
          canReturn: true,
          message: 'Order can be returned',
        });
      } else {
        return notFound(res, validation.message);
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReturnsController();
