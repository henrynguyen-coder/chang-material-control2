import { ShiftConfigModel } from '../models/ShiftConfigModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class ShiftConfigController {
  static async getAll(req, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    const shifts = await ShiftConfigModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shifts }));
  }

  static async update(req, code, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldValue = await ShiftConfigModel.getByCode(code);
      const shift = await ShiftConfigModel.update(code, body || {});
      await AuditLogModel.log({
        user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'SHIFT_CONFIG',
        entity_id: code, old_values: oldValue, new_values: shift
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ shift }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }
}
