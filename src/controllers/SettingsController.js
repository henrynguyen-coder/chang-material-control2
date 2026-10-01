import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { SettingsModel } from '../models/SettingsModel.js';

export class SettingsController {
  static getAll(req, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole(['ADMIN', 'AC_LD'])(user, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ settings: SettingsModel.getAll() }));
  }

  static update(req, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldValues = SettingsModel.getMap();
      const settings = SettingsModel.update(body, user.id);
      AuditLogModel.log({
        user_id: user.id,
        action: 'ADMIN UPDATE',
        entity_type: 'SYSTEM_SETTINGS',
        old_values: oldValues,
        new_values: SettingsModel.getMap()
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã lưu cấu hình hệ thống', settings }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}