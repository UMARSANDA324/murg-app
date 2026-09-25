const customerRepo = require('../repositories/customerRepository');
const { publishBranchEvent } = require('../services/realtimeService');
const { success, created, error, notFound } = require('../utils/responseUtils');

class CustomerController {
  async list(req, res, next) {
    try {
      const facilityID = req.branchId;
      const search = req.query.search || null;
      const customers = await customerRepo.findAll({ facilityID, search });
      return success(res, customers);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const facilityID = req.branchId;
      const customer = await customerRepo.findById(req.params.id, facilityID);
      if (!customer) {
        return notFound(res, 'Customer not found');
      }
      return success(res, customer);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const facilityID = req.branchId;
      const { name, phone, email, gender, address } = req.body;

      if (!name || !name.trim()) {
        return error(res, 'Customer name is required', 400);
      }

      const id = await customerRepo.create({
        facilityID,
        name: name.trim(),
        phone: phone ? phone.trim() : '',
        email: email ? email.trim() : '',
        gender: gender || 'Male',
        address: address ? address.trim() : '',
      });

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: 'CUSTOMER_CREATED',
        referenceId: id,
      });

      return created(res, { id }, 'Customer registered successfully');
    } catch (err) {
      next(err);
    }
  }

  async recordDeposit(req, res, next) {
    try {
      const facilityID = req.branchId;
      const customerId = parseInt(req.params.id);
      const { amount, paymentMethod, description } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return error(res, 'Deposit amount must be greater than zero', 400);
      }

      if (!paymentMethod) {
        return error(res, 'Payment method is required', 400);
      }

      const result = await customerRepo.recordDeposit({
        facilityID,
        customerId,
        amount: parseFloat(amount),
        paymentMethod,
        description: description ? description.trim() : '',
        processedByName: req.user.name,
      });

      publishBranchEvent({
        branchIds: [facilityID],
        type: 'branch-operation',
        operation: 'DEBT_PAYMENT_RECORDED',
        referenceId: result.depositId,
      });

      return created(res, result, 'Debt repayment deposit recorded successfully');
    } catch (err) {
      next(err);
    }
  }

  async getDeposits(req, res, next) {
    try {
      const facilityID = req.branchId;
      const customerId = req.params.id ? parseInt(req.params.id) : null;
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;

      const deposits = await customerRepo.getDepositHistory({ facilityID, customerId, limit });
      return success(res, deposits);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CustomerController();
