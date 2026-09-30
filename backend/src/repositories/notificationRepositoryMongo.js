const { Notification, User } = require('../models');
const { mongoose } = require('../config/mongodb');
const { reserveLegacyIds } = require('../services/legacyIdService');

/**
 * NotificationRepositoryMongo — MongoDB-based notification operations.
 * Matches the interface expected by notificationController.
 */
class NotificationRepositoryMongo {
  /**
   * Get notifications for a user based on their user ID, role, or branch.
   * Matches the MySQL repository interface.
   */
  async getForUser({ userId, role, facilityId, limit = 20 }) {
    const query = {};
    // Match on user_id OR role_target OR facility_id (like MySQL OR logic)
    const orConditions = [];
    if (userId) orConditions.push({ user_id: userId });
    if (role) orConditions.push({ role_target: role });
    if (facilityId) orConditions.push({ facility_id: facilityId });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    return notifications.map(n => ({
      ...n,
      id: n._id.toString(),
      created_at: n.createdAt,
      is_read: !!n.is_read, // Ensure boolean (true/false) for frontend compatibility
    }));
  }

  /**
   * Get unread notification count.
   * Matches the MySQL repository interface.
   */
  async getUnreadCount({ userId, role, facilityId }) {
    const query = { is_read: false };
    const orConditions = [];
    if (userId) orConditions.push({ user_id: userId });
    if (role) orConditions.push({ role_target: role });
    if (facilityId) orConditions.push({ facility_id: facilityId });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return await Notification.countDocuments(query);
  }

  /**
   * Mark a single notification as read — scoped to current user/role/branch.
   * Idempotent: calling again on an already-read notification is a no-op.
   */
  async markAsRead(id, { userId, role, facilityId }) {
    const query = { _id: id, is_read: false };
    const orConditions = [];
    if (userId) orConditions.push({ user_id: userId });
    if (role) orConditions.push({ role_target: role });
    if (facilityId) orConditions.push({ facility_id: facilityId });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return await Notification.updateOne(query, { is_read: true });
  }

  /**
   * Mark all unread notifications as read for current user/role/branch.
   * Idempotent: safe to call multiple times.
   */
  async markAllAsRead({ userId, role, facilityId }) {
    const query = { is_read: false };
    const orConditions = [];
    if (userId) orConditions.push({ user_id: userId });
    if (role) orConditions.push({ role_target: role });
    if (facilityId) orConditions.push({ facility_id: facilityId });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return await Notification.updateMany(query, { is_read: true });
  }

  /**
   * Mark a list of specific notification IDs as read.
   * Used when the panel opens — batch-marks all visible notifications for this user.
   * Only marks notifications that actually belong to this user (scoped query).
   * Idempotent.
   */
  async markListAsRead(ids, { userId, role, facilityId }) {
    if (!ids || ids.length === 0) return true;

    const query = {
      _id: { $in: ids },
      is_read: false
    };
    const orConditions = [];
    if (userId) orConditions.push({ user_id: userId });
    if (role) orConditions.push({ role_target: role });
    if (facilityId) orConditions.push({ facility_id: facilityId });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return await Notification.updateMany(query, { is_read: true });
  }

  /**
   * Create a notification.
   * Used by other repositories to create notifications atomically inside transactions.
   */
  async create({ user_id, role_target, facility_id, title, message, type, reference_id }, session = null) {
    const createWithSession = async (activeSession) => {
      const [mysqlId] = await reserveLegacyIds(Notification, 'notificationId', 1, activeSession);
      const [notification] = await Notification.create([{
        user_id,
        role_target,
        facility_id,
        title,
        message,
        type: type || 'GOODS_REQUEST',
        reference_id,
        mysqlId,
      }], { session: activeSession });
      return notification;
    };
    if (session) return createWithSession(session);

    const newSession = await mongoose.startSession();
    try {
      let notification;
      await newSession.withTransaction(async () => { notification = await createWithSession(newSession); });
      return notification;
    } finally { await newSession.endSession(); }
  }

  async findAll({ user_id = null, role_target = null, facility_id = null, limit = 50 }) {
    const query = {};
    // Match on user_id OR role_target OR facility_id (like MySQL OR logic)
    const orConditions = [];
    if (user_id) orConditions.push({ user_id });
    if (role_target) orConditions.push({ role_target });
    if (facility_id) orConditions.push({ facility_id });

    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

module.exports = new NotificationRepositoryMongo();
