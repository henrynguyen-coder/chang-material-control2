import { NotificationModel } from '../models/NotificationModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class NotificationController {
  static getAll(req, searchParams, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    const notifications = NotificationModel.getForUser(user, {
      limit: searchParams.get('limit')
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      notifications,
      unread_count: NotificationModel.getUnreadCount(user)
    }));
  }

  static markRead(req, notificationId, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    const notification = NotificationModel.markRead(notificationId, user);
    if (!notification) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Không tìm thấy notification' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ notification }));
  }

  static markAllRead(req, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    NotificationModel.markAllRead(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ unread_count: 0 }));
  }
}