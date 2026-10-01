import { db, executeSql, queryAll, queryOne } from '../database/db.js';
import crypto from 'node:crypto';

export class ChecklistModel {
  static getAll() {
    return queryAll('SELECT * FROM checklists WHERE is_active = 1 ORDER BY shift_type ASC');
  }

  static getItems(checklistId) {
    return queryAll(
      `SELECT ci.*, m.material_code, m.material_name, m.category, m.unit, m.min_temp, m.max_temp,
              m.department, m.is_active as material_is_active
       FROM checklist_items ci
       JOIN materials m ON ci.material_id = m.id
       WHERE ci.checklist_id = ? AND ci.is_active = 1 AND m.is_active = 1
       ORDER BY ci.display_order ASC`,
      [checklistId]
    );
  }

  static getAssignments(checklistId, { department } = {}) {
    let sql = `
      SELECT ci.*, m.material_code, m.material_name, m.department, m.category, m.unit,
             m.is_active as material_is_active
      FROM checklist_items ci
      JOIN materials m ON ci.material_id = m.id
      WHERE ci.checklist_id = ?
    `;
    const params = [checklistId];
    if (department) {
      sql += ' AND m.department = ?';
      params.push(department);
    }
    sql += ' ORDER BY ci.display_order ASC, m.material_name ASC';
    return queryAll(sql, params);
  }

  static getAssignmentsForItem(itemId) {
    return queryOne(
      `SELECT ci.*, m.material_code, m.material_name, m.department
       FROM checklist_items ci
       JOIN materials m ON m.id = ci.material_id
       WHERE ci.id = ?`,
      [itemId]
    );
  }

  static addItem(checklistId, { material_id, display_order, requirement_text = '', is_mandatory, target_temp = null } = {}) {
    if (!queryOne('SELECT id FROM checklists WHERE id = ? AND is_active = 1', [checklistId])) {
      throw new Error('Checklist không tồn tại hoặc đã inactive');
    }
    const material = queryOne('SELECT id, is_active FROM materials WHERE id = ?', [material_id]);
    if (!material || !material.is_active) throw new Error('Chỉ Material đang active mới được gán vào Checklist');
    if (![0, 1, true, false, '0', '1'].includes(is_mandatory)) throw new Error('Cần chọn mandatory status cho ChecklistItem');

    const existing = queryAll(
      'SELECT id, is_active FROM checklist_items WHERE checklist_id = ? AND material_id = ?',
      [checklistId, material_id]
    );
    if (existing.length > 1) throw new Error('Checklist đã có nhiều membership trùng Material; cần kiểm tra thủ công trước khi sửa');

    const order = Number.isInteger(Number(display_order)) && Number(display_order) > 0
      ? Number(display_order)
      : (queryOne('SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM checklist_items WHERE checklist_id = ?', [checklistId]).next_order);
    if (existing.length === 1) {
      executeSql(
        `UPDATE checklist_items SET display_order = ?, requirement_text = ?, is_mandatory = ?, target_temp = ?, is_active = 1 WHERE id = ?`,
        [order, requirement_text, Number(is_mandatory === true || Number(is_mandatory) === 1), target_temp, existing[0].id]
      );
      return queryOne('SELECT * FROM checklist_items WHERE id = ?', [existing[0].id]);
    }

    const id = `ci-${crypto.randomBytes(6).toString('hex')}`;
    executeSql(
      `INSERT INTO checklist_items (id, checklist_id, material_id, display_order, requirement_text, is_mandatory, target_temp, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [id, checklistId, material_id, order, requirement_text, Number(is_mandatory === true || Number(is_mandatory) === 1), target_temp]
    );
    return queryOne('SELECT * FROM checklist_items WHERE id = ?', [id]);
  }

  static updateItem(id, { display_order, requirement_text, is_mandatory, target_temp } = {}) {
    const current = queryOne('SELECT * FROM checklist_items WHERE id = ?', [id]);
    if (!current) throw new Error('ChecklistItem không tồn tại');
    const nextOrder = display_order === undefined ? current.display_order : Number(display_order);
    if (!Number.isInteger(nextOrder) || nextOrder < 1) throw new Error('Display order phải là số nguyên dương');
    const nextMandatory = is_mandatory === undefined
      ? current.is_mandatory
      : Number(is_mandatory === true || Number(is_mandatory) === 1);
    executeSql(
      `UPDATE checklist_items SET display_order = ?, requirement_text = ?, is_mandatory = ?, target_temp = ? WHERE id = ?`,
      [nextOrder, requirement_text === undefined ? current.requirement_text : String(requirement_text), nextMandatory,
        target_temp === undefined ? current.target_temp : target_temp, id]
    );
    return queryOne('SELECT * FROM checklist_items WHERE id = ?', [id]);
  }

  static setItemActive(id, isActive) {
    const current = queryOne('SELECT * FROM checklist_items WHERE id = ?', [id]);
    if (!current) throw new Error('ChecklistItem không tồn tại');
    if (![0, 1, true, false, '0', '1'].includes(isActive)) throw new Error('Trạng thái membership không hợp lệ');
    const active = Number(isActive === true || Number(isActive) === 1);
    executeSql('UPDATE checklist_items SET is_active = ? WHERE id = ?', [active, id]);
    return queryOne('SELECT * FROM checklist_items WHERE id = ?', [id]);
  }

  static reorderItems(checklistId, orders = []) {
    if (!Array.isArray(orders) || !orders.length) throw new Error('Cần danh sách thứ tự ChecklistItem');
    const currentItems = queryAll('SELECT id, display_order FROM checklist_items WHERE checklist_id = ? ORDER BY display_order ASC, id ASC', [checklistId]);
    const currentIds = new Set(currentItems.map(item => item.id));
    const seen = new Set();
    const requestedPositions = new Set();
    for (const item of orders) {
      const position = Number(item.display_order);
      if (!currentIds.has(item.id) || seen.has(item.id) || requestedPositions.has(position) || !Number.isInteger(position) || position < 1) {
        throw new Error('Danh sách thứ tự ChecklistItem không hợp lệ');
      }
      seen.add(item.id);
      requestedPositions.add(position);
    }

    const changes = new Map(orders.map(item => [item.id, Number(item.display_order)]));
    const reordered = currentItems.map((item, index) => ({
      ...item,
      currentIndex: index,
      requestedPosition: changes.has(item.id) ? changes.get(item.id) : item.display_order
    })).sort((left, right) => left.requestedPosition - right.requestedPosition || left.currentIndex - right.currentIndex);

    db.exec('BEGIN');
    try {
      reordered.forEach((item, index) => executeSql(
        'UPDATE checklist_items SET display_order = ? WHERE id = ? AND checklist_id = ?',
        [index + 1, item.id, checklistId]
      ));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return this.getAssignments(checklistId);
  }
}
