import crypto from 'node:crypto';
import { executeSql, queryAll, queryOne } from '../database/db.js';

function scope(user) {
  const ids = user?.role_code === 'AC_LD' ? (user.assigned_restaurant_ids || []) : [];
  return { ids, sql: user?.role_code === 'AC_LD' ? (ids.length ? ` AND restaurant_id IN (${ids.map((_, i) => `$${i + 2}`).join(', ')})` : ' AND 1 = 0') : '' };
}

export class NotificationModel {
  static async createForAssessment(assessment, db = null) {
    const all = db?.queryAll || queryAll;
    const execute = db?.executeSql || executeSql;
    const recipients = await all(`SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1 AND (r.code = 'ADMIN' OR (r.code = 'AC_LD' AND EXISTS
      (SELECT 1 FROM user_restaurant_assignments ura WHERE ura.user_id = u.id AND ura.restaurant_id = $1)))`, [assessment.restaurant_id]);
    const details = assessment.details || [];
    const completedAt = new Date(assessment.submitted_at || assessment.created_at).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false });
    const notifications = [{ title: 'CHECKLIST COMPLETED', type: 'CHECKLIST_COMPLETED', message: `${assessment.restaurant_name}\n${assessment.shift_type}\nCompleted at ${completedAt}\n${details.filter(x => x.overall_result === 'PASS').length} PASS\n${details.filter(x => x.overall_result === 'FAIL').length} FAIL`, data: { type: 'CHECKLIST_COMPLETED' } }, ...details.filter(x => x.overall_result === 'FAIL').map(item => ({ title: 'MATERIAL ISSUE', type: 'MATERIAL_ISSUE', message: `${assessment.restaurant_name}\n${item.material_name}\n${item.department} · FAIL`, data: { material_id: item.material_id, material_name: item.material_name, department: item.department, allowed_to_serve: item.allowed_to_serve } }))];
    for (const recipient of recipients) for (const item of notifications) {
      await execute(`INSERT INTO notifications (id,user_id,restaurant_id,title,message,type,data,is_read,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8)`, [
        `ntf-${crypto.randomBytes(6).toString('hex')}`, recipient.id, assessment.restaurant_id, item.title, item.message, item.type,
        JSON.stringify({ ...item.data, restaurant_id: assessment.restaurant_id, restaurant_name: assessment.restaurant_name, assessment_id: assessment.id, shift_date: assessment.shift_date, shift_type: assessment.shift_type, completed_at: completedAt }), assessment.submitted_at || new Date().toISOString()
      ]);
    }
    return recipients.length * notifications.length;
  }

  static async getForUser(user, { limit = 50 } = {}) {
    const userId = typeof user === 'object' ? user.id : user;
    const { ids, sql } = scope(user);
    const params = [userId, ...ids, Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 100))];
    const rows = await queryAll(`SELECT id,restaurant_id,title,message,type,data,is_read,created_at FROM notifications WHERE user_id = $1${sql} ORDER BY created_at DESC LIMIT $${params.length}`, params);
    return rows.map(row => ({ ...row, data: this.parseData(row.data), status: row.is_read ? 'READ' : 'UNREAD' }));
  }

  static async getUnreadCount(user) {
    const userId = typeof user === 'object' ? user.id : user;
    const { ids, sql } = scope(user);
    const row = await queryOne(`SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = 0${sql}`, [userId, ...ids]);
    return row?.count || 0;
  }

  static async markRead(id, user) {
    const userId = typeof user === 'object' ? user.id : user;
    const { ids, sql } = scope(user);
    const row = await queryOne(`UPDATE notifications SET is_read=1 WHERE id=$1 AND user_id=$2${sql} RETURNING id,restaurant_id,title,message,type,data,is_read,created_at`, [id, userId, ...ids]);
    return row ? { ...row, data: this.parseData(row.data), status: 'READ' } : null;
  }

  static async markAllRead(user) {
    const userId = typeof user === 'object' ? user.id : user;
    const { ids, sql } = scope(user);
    await executeSql(`UPDATE notifications SET is_read=1 WHERE user_id=$1 AND is_read=0${sql}`, [userId, ...ids]);
  }

  static parseData(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return null; }
  }
}
