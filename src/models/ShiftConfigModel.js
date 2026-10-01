import { queryAll, queryOne, executeSql } from '../database/db.js';

export class ShiftConfigModel {
  static initDefaults() {
    const defaultShifts = [
      { id: 'shift-morn', code: 'MORNING', name: 'CA SÁNG', deadline: '10:30', reminder: 30, is_required: 1 },
      { id: 'shift-mid', code: 'MID_SHIFT', name: 'CA GIỮA (OPTIONAL)', deadline: '14:00', reminder: 15, is_required: 0 },
      { id: 'shift-eve', code: 'EVENING', name: 'CA CHIỀU / TỐI', deadline: '17:30', reminder: 30, is_required: 1 }
    ];

    for (const s of defaultShifts) {
      const existing = queryOne('SELECT id FROM shift_configs WHERE shift_code = ?', [s.code]);
      if (!existing) {
        executeSql(
          `INSERT INTO shift_configs (id, shift_code, shift_name, deadline_time, reminder_minutes_before, is_required) VALUES (?, ?, ?, ?, ?, ?)`,
          [s.id, s.code, s.name, s.deadline, s.reminder, s.is_required]
        );
      }
    }
  }

  static getAll() {
    this.initDefaults();
    return queryAll('SELECT * FROM shift_configs ORDER BY id ASC');
  }

  static getByCode(code) {
    this.initDefaults();
    return queryOne('SELECT * FROM shift_configs WHERE shift_code = ?', [code]);
  }

  static update(code, { deadline_time, is_required, reminder_minutes_before }) {
    const existing = this.getByCode(code);
    if (!existing) {
      throw new Error(`Shift configuration "${code}" không tồn tại`);
    }

    const updatedDeadline = deadline_time ? deadline_time.trim() : existing.deadline_time;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(updatedDeadline)) throw new Error('Deadline phải theo định dạng HH:MM');
    const updatedRequired = is_required !== undefined ? Number(is_required === true || Number(is_required) === 1) : existing.is_required;
    const reminder = reminder_minutes_before === undefined ? existing.reminder_minutes_before : Number(reminder_minutes_before);
    if (!Number.isInteger(reminder) || reminder < 0 || reminder > 1440) throw new Error('Reminder phải từ 0 đến 1440 phút');
    const now = new Date().toISOString();

    executeSql(
      `UPDATE shift_configs SET deadline_time = ?, reminder_minutes_before = ?, is_required = ?, updated_at = ? WHERE shift_code = ?`,
      [updatedDeadline, reminder, updatedRequired, now, code]
    );

    return this.getByCode(code);
  }
}
