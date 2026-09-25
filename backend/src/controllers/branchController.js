const branchRepo = require('../repositories/branchRepository');
const { success, created, error, notFound } = require('../utils/responseUtils');

class BranchController {
  async list(req, res, next) {
    try {
      // Global Admin sees all; Branch staff sees only their branch
      const facilityID = req.user.isGlobalAdmin ? null : req.user.facilityID;
      const branches = await branchRepo.findAll(facilityID);
      return success(res, branches);
    } catch (err) {
      next(err);
    }
  }

  async get(req, res, next) {
    try {
      const branchId = req.params.branchId;
      const branch = await branchRepo.findByFacilityID(branchId);
      if (!branch) {
        return notFound(res, 'Branch not found');
      }
      return success(res, branch);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { name, address, phone, sales_mode } = req.body;
      if (!name || !name.trim()) {
        return error(res, 'Branch name is required', 400);
      }

      const validMode = sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER';
      const result = await branchRepo.create({ name: name.trim(), address, phone, sales_mode: validMode });
      return created(res, result, 'Branch created successfully');
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const branchId = req.params.branchId;
      const { name, address, phone, sales_mode } = req.body;
      if (!name || !name.trim()) {
        return error(res, 'Branch name is required', 400);
      }

      const updated = await branchRepo.update(branchId, {
        name: name.trim(),
        address,
        phone,
        sales_mode: sales_mode ? (sales_mode === 'PER_YARD' ? 'PER_YARD' : 'DEALER') : undefined,
      });
      if (!updated) {
        return notFound(res, 'Branch not found');
      }
      return success(res, null, 'Branch updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async setStatus(req, res, next) {
    try {
      const branchId = req.params.branchId;
      const { status } = req.body;
      if (!['active', 'inactive'].includes(status)) {
        return error(res, 'Status must be active or inactive', 400);
      }

      const updated = await branchRepo.setStatus(branchId, status);
      if (!updated) {
        return notFound(res, 'Branch not found');
      }
      return success(res, null, `Branch ${status === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const branchId = req.branchId; // from requireBranchScope middleware
      const branch = await branchRepo.findByFacilityID(branchId);
      if (!branch) {
        return notFound(res, 'Branch not found');
      }

      const metrics = await branchRepo.getDashboardMetrics(branchId);
      return success(res, {
        branch,
        metrics,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BranchController();
