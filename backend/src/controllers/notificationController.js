const notificationRepo = require('../repositories/notificationRepository');
const { success } = require('../utils/responseUtils');

class NotificationController {
  /**
   * Get notifications for authenticated user.
   */
  async getNotifications(req, res, next) {
    try {
      const user = req.user;
      const limit = parseInt(req.query.limit) || 20;

      const notifications = await notificationRepo.getForUser({
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
        limit,
      });

      return success(res, notifications);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get unread notification count for header bell.
   */
  async getUnreadCount(req, res, next) {
    try {
      const user = req.user;
      const unreadCount = await notificationRepo.getUnreadCount({
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      return success(res, { unreadCount });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark single notification as read.
   * Scoped to the authenticated user — cannot mark another user's notification.
   */
  async markAsRead(req, res, next) {
    try {
      const { id } = req.params;
      const user = req.user;

      await notificationRepo.markAsRead(id, {
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      return success(res, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark all notifications as read.
   * Scoped to the authenticated user — cannot affect another user's notifications.
   */
  async markAllAsRead(req, res, next) {
    try {
      const user = req.user;
      await notificationRepo.markAllAsRead({
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      const unreadCount = await notificationRepo.getUnreadCount({
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      return success(res, { unreadCount }, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Batch mark a list of notification IDs as read.
   * Called when the notification panel opens — marks all currently visible notifications.
   * The backend enforces ownership: only notifications belonging to req.user are affected.
   * Idempotent.
   */
  async markListAsRead(req, res, next) {
    try {
      const user = req.user;
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        // Nothing to mark — return current unread count
        const unreadCount = await notificationRepo.getUnreadCount({
          userId: user.id,
          role: user.role,
          facilityId: user.facilityID,
        });
        return success(res, { unreadCount }, 'No notifications to mark');
      }

      // Sanitize IDs — must be integers
      const safeIds = ids.map((id) => parseInt(id)).filter((id) => !isNaN(id) && id > 0);
      if (safeIds.length === 0) {
        return success(res, { unreadCount: 0 }, 'No valid notification IDs provided');
      }

      await notificationRepo.markListAsRead(safeIds, {
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      // Return updated unread count so the bell can update immediately
      const unreadCount = await notificationRepo.getUnreadCount({
        userId: user.id,
        role: user.role,
        facilityId: user.facilityID,
      });

      return success(res, { unreadCount }, 'Notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new NotificationController();
