import crypto from 'node:crypto';
import { executeSql, queryAll, queryOne } from '../database/db.js';

export class NotificationModel {
  static createForAssessment(assessment) {
    const recipients = queryAll(
      `SELECT u.id
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = 1
         AND (r.code = 'ADMIN' OR (
           r.code = 'AC_LD' AND EXISTS (
             SELECT 1 FROM user_restaurant_assignments ura
             WHERE ura.user_id = u.id AND ura.restaurant_id = ?
           )
         ))`,
      [assessment.restaurant_id]
    );
    if (!recipients.length) return 0;

    const details = assessment.details || [];
    const passCount = details.filter(item => item.overall_result === 'PASS').length;
    const failItems = details.filter(item => item.overall_result === 'FAIL');
    const shiftLabel = {
      MORNING: 'Ca sáng',
      MID_SHIFT: 'Ca giữa',
      EVENING: 'Ca tối'
    }[assessment.shift_type] || assessment.shift_type;
    const completedAt = new Date(assessment.submitted_at || assessment.created_at).toLocaleTimeString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const notifications = [{
      title: 'CHECKLIST COMPLETED',
      type: 'CHECKLIST_COMPLETED',
      restaurant_id: assessment.restaurant_id,
      assessment_id: assessment.id,
      message: `${assessment.restaurant_name}\n${shiftLabel}\nCompleted at ${completedAt}\n${passCount} PASS\n${failItems.length} FAIL`,
      data: {
        restaurant_id: assessment.restaurant_id,
        restaurant_name: assessment.restaurant_name,
        restaurant_code: assessment.restaurant_code,
        assessment_id: assessment.id,
        shift_date: assessment.shift_date,
        shift_type: assessment.shift_type,
        completed_at: completedAt,
        pass_count: passCount,
        fail_count: failItems.length,
        type: 'CHECKLIST_COMPLETED'
      }
    }];

    for (const item of failItems) {
      notifications.push({
        title: 'MATERIAL ISSUE',
        type: 'MATERIAL_ISSUE',
        restaurant_id: assessment.restaurant_id,
        assessment_id: assessment.id,
        message: `${assessment.restaurant_name}\n${item.material_name}\n${item.department} · FAIL\n${item.allowed_to_serve === 'NO' ? 'Not Allowed To Serve' : 'Allowed To Serve'}`,
        data: {
          restaurant_id: assessment.restaurant_id,
          restaurant_name: assessment.restaurant_name,
          restaurant_code: assessment.restaurant_code,
          assessment_id: assessment.id,
          shift_date: assessment.shift_date,
          shift_type: assessment.shift_type,
          material_id: item.material_id,
          material_name: item.material_name,
          department: item.department,
          result: item.overall_result,
          allowed_to_serve: item.allowed_to_serve,
          type: 'MATERIAL_ISSUE'
        }
      });
    }

    const createdAt = assessment.submitted_at || new Date().toISOString();
    for (const recipient of recipients) {
      for (const notification of notifications) {
        executeSql(
          `INSERT INTO notifications (id, user_id, restaurant_id, title, message, type, data, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            `ntf-${crypto.randomBytes(6).toString('hex')}`,
            recipient.id,
            notification.restaurant_id,
            notification.title,
            notification.message,
            notification.type,
            JSON.stringify({ ...notification.data, assessment_id: notification.assessment_id }),
            createdAt
          ]
        );
      }
    }

    return recipients.length * notifications.length;
  }

  static getForUser(user, { limit = 50 } = {}) {
    const userId = typeof user === 'object' ? user.id : user;
    const assignedIds = typeof user === 'object' ? user.assigned_restaurant_ids || [] : [];
    const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100));
    const scopeSql = user?.role_code === 'AC_LD'
      ? assignedIds.length ? ` AND restaurant_id IN (${assignedIds.map(() => '?').join(', ')})` : ' AND 1 = 0'
      : '';
    return queryAll(
      `SELECT id, restaurant_id, title, message, type, data, is_read, created_at
       FROM notifications
       WHERE user_id = ?${scopeSql}
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, ...assignedIds.filter(() => user?.role_code === 'AC_LD'), safeLimit]
    ).map(notification => ({
      ...notification,
      data: notification.data ? this.parseData(notification.data) : null,
      status: notification.is_read ? 'READ' : 'UNREAD'
    }));
  }

  static getUnreadCount(user) {
    const userId = typeof user === 'object' ? user.id : user;
    const assignedIds = typeof user === 'object' ? user.assigned_restaurant_ids || [] : [];
    const scopeSql = user?.role_code === 'AC_LD'
      ? assignedIds.length ? ` AND restaurant_id IN (${assignedIds.map(() => '?').join(', ')})` : ' AND 1 = 0'
      : '';
    return queryOne(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0${scopeSql}`,
      [userId, ...assignedIds.filter(() => user?.role_code === 'AC_LD')]
    ).count;
  }

  static markRead(notificationId, user) {
    const userId = typeof user === 'object' ? user.id : user;
    const assignedIds = typeof user === 'object' ? user.assigned_restaurant_ids || [] : [];
    const existing = queryOne(
      'SELECT restaurant_id FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    if (!existing || (user?.role_code === 'AC_LD' && !assignedIds.includes(existing.restaurant_id))) return null;
    executeSql(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [notificationId, userId]
    );
    const notification = queryOne(
      `SELECT id, restaurant_id, title, message, type, data, is_read, created_at
       FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    return notification ? {
      ...notification,
      data: notification.data ? this.parseData(notification.data) : null,
      status: notification.is_read ? 'READ' : 'UNREAD'
    } : null;
  }

  static markAllRead(user) {
    const userId = typeof user === 'object' ? user.id : user;
    const assignedIds = typeof user === 'object' ? user.assigned_restaurant_ids || [] : [];
    if (user?.role_code === 'AC_LD') {
      if (!assignedIds.length) return;
      executeSql(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND restaurant_id IN (${assignedIds.map(() => '?').join(', ')})`, [userId, ...assignedIds]);
      return;
    }
    executeSql('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  }

  static parseData(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}