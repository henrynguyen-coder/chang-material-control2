import { NotificationModel } from '../models/NotificationModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class NotificationController {
  static async getAll(req, searchParams, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    const notifications = await NotificationModel.getForUser(user, {
      limit: searchParams.get('limit')
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      notifications,
      unread_count: await NotificationModel.getUnreadCount(user)
    }));
  }

  static async markRead(req, notificationId, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    const notification = await NotificationModel.markRead(notificationId, user);
    if (!notification) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Không tìm thấy notification' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ notification }));
  }

  static async markAllRead(req, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole(['AC_LD', 'ADMIN'])(user, res)) return;

    await NotificationModel.markAllRead(user);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ unread_count: 0 }));
  }
}