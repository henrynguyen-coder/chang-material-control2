import { queryAll, executeSql } from '../database/db.js';
import crypto from 'node:crypto';

export class AuditLogModel {
  static log({ user_id, restaurant_id, action, entity_type, entity_id, old_values, new_values, ip_address }) {
    const id = `audit-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    executeSql(
      `INSERT INTO audit_logs (id, user_id, restaurant_id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        user_id || null,
        restaurant_id || null,
        action,
        entity_type,
        entity_id || null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ip_address || '127.0.0.1',
        now
      ]
    );
  }

  static getAll({ limit = 50 } = {}) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 500));
    return queryAll(
      `SELECT al.*, u.username, u.full_name, r.restaurant_code, r.restaurant_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN restaurants r ON al.restaurant_id = r.id
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [safeLimit]
    );
  }
}
