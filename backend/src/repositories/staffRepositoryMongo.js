const { User, Branch } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');

const STAFF_FIELDS = '-password -password_hash';

function toStaffDTO(user, branchName = null) {
  return {
    ...user,
    id: user._id.toString(),
    branch_name: branchName,
  };
}

class StaffRepositoryMongo {
  async findAll({ facilityID = null, role = null } = {}) {
    const query = {};
    if (facilityID) query.facilityID = facilityID;
    if (role) query.role = role;

    const users = await User.find(query).select(STAFF_FIELDS).sort({ createdAt: -1, _id: -1 }).lean();
    const branchIds = [...new Set(users.map((user) => user.facilityID).filter(Boolean))];
    const branches = await Branch.find({ facilityID: { $in: branchIds } })
      .select('facilityID name')
      .lean();
    const namesByBranch = new Map(branches.map((branch) => [branch.facilityID, branch.name]));

    return users.map((user) => toStaffDTO(user, namesByBranch.get(user.facilityID) || null));
  }

  async findById(id, facilityID = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const query = { _id: id };
    if (facilityID) query.facilityID = facilityID;

    const user = await User.findOne(query).select(STAFF_FIELDS).lean();
    if (!user) return null;
    const branch = await Branch.findOne({ facilityID: user.facilityID }).select('name').lean();
    return toStaffDTO(user, branch?.name || null);
  }

  async create({ facilityID, name, email, phone, gender, role, passwordHash, fname, address }) {
    if (!['Admin', 'Staff'].includes(role)) throw new Error('Role must be Admin or Staff');

    const session = await mongoose.startSession();
    let createdUser;
    try {
      await session.withTransaction(async () => {
        const branchExists = await Branch.exists({ facilityID }).session(session);
        if (!branchExists) throw new Error('Branch not found');

        const [mysqlId] = await reserveLegacyIds(User, 'userId', 1, session);

        const [user] = await User.create([{
          mysqlId,
          facilityID,
          name,
          fname: fname || name,
          email,
          phone,
          gender: gender || 'Male',
          address: address || '',
          role,
          status: 1,
          password_hash: passwordHash,
          permissions: role === 'Admin' ? ['*'] : [],
        }], { session });

        createdUser = user._id.toString();
      });
      return createdUser;
    } finally {
      await session.endSession();
    }
  }

  async updateRole(id, { role, facilityID }) {
    if (!mongoose.Types.ObjectId.isValid(id) || !['Admin', 'Staff'].includes(role)) return false;
    if (!await Branch.exists({ facilityID })) throw new Error('Branch not found');

    const result = await User.updateOne(
      { _id: id },
      {
        role,
        facilityID,
        permissions: role === 'Admin' ? ['*'] : [],
        updatedAt: new Date(),
      },
      { runValidators: true }
    );
    return result.matchedCount > 0;
  }

  async setStatus(id, status) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await User.updateOne({ _id: id }, { status, updatedAt: new Date() });
    return result.matchedCount > 0;
  }

  async update(id, { name, phone, gender, address }, facilityID = null) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const query = { _id: id };
    if (facilityID) query.facilityID = facilityID;
    const result = await User.updateOne(
      query,
      { name, phone, gender, address, updatedAt: new Date() },
      { runValidators: true }
    );
    return result.matchedCount > 0;
  }

  async emailExists(email, excludeId = null) {
    const query = { email: email.trim().toLowerCase() };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) query._id = { $ne: excludeId };
    return Boolean(await User.exists(query));
  }

  async delete(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await User.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async updateEmail(id, email) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await User.updateOne(
      { _id: id },
      { email: email.trim().toLowerCase(), updatedAt: new Date() },
      { runValidators: true }
    );
    return result.matchedCount > 0;
  }

  async updatePassword(id, bcryptHash) {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await User.updateOne(
      { _id: id },
      { $set: { password_hash: bcryptHash, updatedAt: new Date() }, $unset: { password: 1 } }
    );
    return result.matchedCount > 0;
  }
}

module.exports = new StaffRepositoryMongo();