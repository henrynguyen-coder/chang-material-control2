import { executeSql, queryAll, queryOne } from '../database/db.js';
import crypto from 'node:crypto';

export class MaterialModel {
  static getAll({ includeInactive = false } = {}) {
    return queryAll(
      `SELECT * FROM materials ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY category ASC, material_name ASC`
    );
  }

  static getById(id) {
    return queryOne('SELECT * FROM materials WHERE id = ?', [id]);
  }

  static update(id, { material_code, material_name, department, category, unit, is_mandatory, photo_required } = {}) {
    const current = this.getById(id);
    if (!current) throw new Error('Vật tư không tồn tại');

    const updatedCode = typeof material_code === 'string' ? material_code.trim().toUpperCase() : current.material_code;
    const updated = {
      material_code: updatedCode,
      material_name: typeof material_name === 'string' ? material_name.trim() : current.material_name,
      department: department || current.department,
      category: typeof category === 'string' ? category.trim() : current.category,
      unit: typeof unit === 'string' ? unit.trim() : current.unit,
      is_mandatory: is_mandatory === undefined ? current.is_mandatory : Number(is_mandatory === true || Number(is_mandatory) === 1),
      photo_required: photo_required === undefined ? current.photo_required : Number(photo_required === true || Number(photo_required) === 1)
    };

    if (!updated.material_code || !updated.material_name || !updated.category || !updated.unit) {
      throw new Error('Mã, tên, phân loại và đơn vị vật tư không được để trống');
    }
    if (!['FOH', 'BOH'].includes(updated.department)) {
      throw new Error('Bộ phận chỉ có thể là FOH hoặc BOH');
    }
    const existingCode = queryOne('SELECT id FROM materials WHERE material_code = ? AND id <> ?', [updated.material_code, id]);
    if (existingCode) throw new Error(`Mã vật tư "${updated.material_code}" đã tồn tại`);

    executeSql(
      `UPDATE materials
       SET material_code = ?, material_name = ?, department = ?, category = ?, unit = ?, is_mandatory = ?, photo_required = ?, updated_at = ?
       WHERE id = ?`,
      [updated.material_code, updated.material_name, updated.department, updated.category, updated.unit, updated.is_mandatory, updated.photo_required, new Date().toISOString(), id]
    );
    return this.getById(id);
  }

  static create({ material_code, material_name, department, category, unit, is_mandatory = 1, photo_required = 0 } = {}) {
    const code = String(material_code || '').trim().toUpperCase();
    const name = String(material_name || '').trim();
    const materialCategory = String(category || '').trim();
    const materialUnit = String(unit || '').trim();
    if (!code || !name || !materialCategory || !materialUnit) {
      throw new Error('Mã, tên, phân loại và đơn vị vật tư là bắt buộc');
    }
    if (!['FOH', 'BOH'].includes(department)) throw new Error('Bộ phận chỉ có thể là FOH hoặc BOH');
    if (this.getAll({ includeInactive: true }).some(material => material.material_code === code)) {
      throw new Error(`Mã vật tư "${code}" đã tồn tại`);
    }

    const id = `mat-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();
    executeSql(
      `INSERT INTO materials (id, material_code, material_name, department, category, unit, is_mandatory, photo_required, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, code, name, department, materialCategory, materialUnit,
        Number(is_mandatory === true || Number(is_mandatory) === 1),
        Number(photo_required === true || Number(photo_required) === 1), now, now]
    );
    return this.getById(id);
  }

  static setActive(id, isActive) {
    const current = this.getById(id);
    if (!current) throw new Error('Vật tư không tồn tại');
    if (![true, false, 0, 1, '0', '1'].includes(isActive)) throw new Error('Trạng thái vật tư không hợp lệ');
    executeSql('UPDATE materials SET is_active = ?, updated_at = ? WHERE id = ?', [
      Number(isActive === true || Number(isActive) === 1), new Date().toISOString(), id
    ]);
    return this.getById(id);
  }
}
