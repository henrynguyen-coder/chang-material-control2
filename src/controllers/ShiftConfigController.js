import { ShiftConfigModel } from '../models/ShiftConfigModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class ShiftConfigController {
  static getAll(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const shifts = ShiftConfigModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ shifts }));
  }

  static update(req, code, body, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const checkRole = requireRole('ADMIN');
    if (!checkRole(user, res)) return;

    try {
      const oldVal = ShiftConfigModel.getByCode(code);
      const updatedShift = ShiftConfigModel.update(code, body || {});

      AuditLogModel.log({
        user_id: user.id,
        action: 'ADMIN UPDATE',
        entity_type: 'SHIFT_CONFIG',
        entity_id: code,
        old_values: oldVal,
        new_values: updatedShift
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: `Cập nhật deadline cho ${updatedShift.shift_name} thành công (${updatedShift.deadline_time})`,
        shift: updatedShift
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}
