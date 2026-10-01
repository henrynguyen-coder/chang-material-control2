import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class AuditLogController {
  static recordChecklistEvent(req, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('RESTAURANT')(user, res)) return;

    const { action, shift_type, shift_date, item_count } = body || {};
    if (!['CHECKLIST START', 'CHECKLIST SAVE'].includes(action)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Audit action không hợp lệ' }));
      return;
    }

    AuditLogModel.log({
      user_id: user.id,
      restaurant_id: user.restaurant_id,
      action,
      entity_type: 'CHECKLIST',
      entity_id: 'chk-morn-01',
      new_values: {
        shift_type: typeof shift_type === 'string' ? shift_type : null,
        shift_date: typeof shift_date === 'string' ? shift_date : null,
        item_count: Number.isInteger(item_count) ? item_count : null
      },
      ip_address: req.socket.remoteAddress
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Đã ghi audit event' }));
  }
}