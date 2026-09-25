const db = require('../config/database');

class NotificationRepository {
  /**
   * Get notifications for a user based on their user ID, role, or branch.
   */
  async getForUser({ userId, role, facilityId, limit = 20 }) {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE (user_id = ? OR role_target = ? OR facility_id = ?)
       ORDER BY id DESC LIMIT ?`,
      [userId, role, facilityId, parseInt(limit)]
    );
    return rows;
  }

  /**
   * Get unread notification count.
   */
  async getUnreadCount({ userId, role, facilityId }) {
    const [rows] = await db.query(
      `SELECT COUNT(id) as unread_count FROM notifications
       WHERE (user_id = ? OR role_target = ? OR facility_id = ?)
         AND is_read = 0`,
      [userId, role, facilityId]
    );
    return parseInt(rows[0]?.unread_count || 0);
  }

  /**
   * Mark a single notification as read — scoped to current user/role/branch.
   * Idempotent: calling again on an already-read notification is a no-op.
   */
  async markAsRead(id, { userId, role, facilityId }) {
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW()
       WHERE id = ? AND is_read = 0
         AND (user_id = ? OR role_target = ? OR facility_id = ?)`,
      [id, userId, role, facilityId]
    );
    return true;
  }

  /**
   * Mark all unread notifications as read for current user/role/branch.
   * Idempotent: safe to call multiple times.
   */
  async markAllAsRead({ userId, role, facilityId }) {
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW()
       WHERE (user_id = ? OR role_target = ? OR facility_id = ?) AND is_read = 0`,
      [userId, role, facilityId]
    );
    return true;
  }

  /**
   * Mark a list of specific notification IDs as read.
   * Used when the panel opens — batch-marks all visible notifications for this user.
   * Only marks notifications that actually belong to this user (scoped query).
   * Idempotent.
   */
  async markListAsRead(ids, { userId, role, facilityId }) {
    if (!ids || ids.length === 0) return true;
    // Build parameterised IN clause safely
    const placeholders = ids.map(() => '?').join(', ');
    await db.query(
      `UPDATE notifications SET is_read = 1, read_at = NOW()
       WHERE id IN (${placeholders})
         AND is_read = 0
         AND (user_id = ? OR role_target = ? OR facility_id = ?)`,
      [...ids, userId, role, facilityId]
    );
    return true;
  }

  /**
   * Insert a notification.
   * Used by other repositories to create notifications atomically inside transactions.
   */
  async create({ conn = null, userId = null, roleTarget = null, facilityId = null, title, message, type = 'GOODS_REQUEST', referenceId = null }) {
    const executor = conn || db;
    const [result] = await executor.query(
      `INSERT INTO notifications (user_id, role_target, facility_id, title, message, type, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, roleTarget, facilityId, title, message, type, referenceId ? String(referenceId) : null]
    );
    return result.insertId;
  }
}

module.exports = new NotificationRepository();
