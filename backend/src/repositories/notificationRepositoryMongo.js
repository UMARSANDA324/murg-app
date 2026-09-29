const { Notification, User } = require('../models');

/**
 * NotificationRepositoryMongo — MongoDB-based notification operations.
 */
class NotificationRepositoryMongo {
  async findAll({ user_id = null, role_target = null, facility_id = null, limit = 50 }) {
    const query = {};
    if (user_id) query.user_id = user_id;
    if (role_target) query.role_target = role_target;
    if (facility_id) query.facility_id = facility_id;

    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async create({ user_id, role_target, facility_id, title, message, type, reference_id }) {
    const notification = await Notification.create({
      user_id,
      role_target,
      facility_id,
      title,
      message,
      type: type || 'GOODS_REQUEST',
      reference_id,
      mysqlId: Date.now(),
    });
    return notification;
  }

  async markAsRead(id, user_id) {
    return await Notification.updateOne(
      { _id: id, user_id },
      { is_read: true }
    );
  }

  async markAllAsRead(user_id) {
    return await Notification.updateMany(
      { user_id, is_read: false },
      { is_read: true }
    );
  }

  async getUnreadCount(user_id = null, role_target = null, facility_id = null) {
    const query = { is_read: false };
    if (user_id) query.user_id = user_id;
    if (role_target) query.role_target = role_target;
    if (facility_id) query.facility_id = facility_id;

    return await Notification.countDocuments(query);
  }
}

module.exports = new NotificationRepositoryMongo();
