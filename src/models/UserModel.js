import { db, executeSql, queryAll, queryOne } from '../database/db.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import crypto from 'node:crypto';

export class UserModel {
  static getByUsername(username) {
    return this.withAssignments(queryOne(
      `SELECT u.*, r.code as role_code, r.name as role_name, res.restaurant_name, res.restaurant_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN restaurants res ON u.restaurant_id = res.id
       WHERE u.username = ?`,
      [username]
    ));
  }

  static getById(id) {
    return this.withAssignments(queryOne(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.is_active, u.role_id, u.restaurant_id,
              r.code as role_code, r.name as role_name, res.restaurant_name, res.restaurant_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN restaurants res ON u.restaurant_id = res.id
       WHERE u.id = ?`,
      [id]
    ));
  }

  static authenticate(username, password) {
    const user = this.getByUsername(username);
    if (!user) return null;
    if (!user.is_active) return { error: 'Tài khoản hiện đang bị vô hiệu hóa' };

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) return null;

    // Omit sensitive password_hash before returning
    const { password_hash, ...userPayload } = user;
    return userPayload;
  }

  static getAll() {
    return queryAll(
      `SELECT u.id, u.username, u.full_name, u.email, u.is_active, u.created_at, u.restaurant_id,
              r.code as role_code, r.name as role_name, res.restaurant_name, res.restaurant_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN restaurants res ON u.restaurant_id = res.id
       ORDER BY u.created_at DESC`
    ).map(user => this.withAssignments(user));
  }

  static getAssignedRestaurantIds(userId) {
    return queryAll('SELECT restaurant_id FROM user_restaurant_assignments WHERE user_id = ? ORDER BY restaurant_id', [userId])
      .map(row => row.restaurant_id);
  }

  static getAssignedRestaurants(userId) {
    return queryAll(
      `SELECT r.id, r.restaurant_code, r.restaurant_name
       FROM user_restaurant_assignments ura
       JOIN restaurants r ON r.id = ura.restaurant_id
       WHERE ura.user_id = ?
       ORDER BY r.restaurant_code`,
      [userId]
    );
  }

  static withAssignments(user) {
    if (!user) return null;
    return {
      ...user,
      assigned_restaurant_ids: this.getAssignedRestaurantIds(user.id),
      assigned_restaurants: this.getAssignedRestaurants(user.id)
    };
  }

  static validateAssignments(roleCode, restaurantId, assignedRestaurantIds) {
    const assignedIds = [...new Set((assignedRestaurantIds || []).filter(Boolean))];
    if (roleCode === 'RESTAURANT') {
      if (!restaurantId) throw new Error('Tài khoản nhà hàng phải được gán một nhà hàng');
      if (!queryOne('SELECT id FROM restaurants WHERE id = ?', [restaurantId])) throw new Error('Nhà hàng được gán không tồn tại');
      return [];
    }
    if (restaurantId) throw new Error('Chỉ tài khoản nhà hàng mới dùng gán một nhà hàng trực tiếp');
    if (roleCode === 'AC_LD' && !assignedIds.length) throw new Error('Tài khoản AC/L&D phải được gán ít nhất một nhà hàng');
    if (roleCode !== 'AC_LD' && assignedIds.length) throw new Error('Chỉ tài khoản AC/L&D mới dùng gán nhiều nhà hàng');
    if (assignedIds.length) {
      const placeholders = assignedIds.map(() => '?').join(', ');
      const existing = queryAll(`SELECT id FROM restaurants WHERE id IN (${placeholders})`, assignedIds).map(row => row.id);
      if (existing.length !== assignedIds.length) throw new Error('Một hoặc nhiều nhà hàng được gán không tồn tại');
    }
    return assignedIds;
  }

  static saveAssignments(userId, assignedIds) {
    executeSql('DELETE FROM user_restaurant_assignments WHERE user_id = ?', [userId]);
    for (const restaurantId of assignedIds) {
      executeSql(
        'INSERT INTO user_restaurant_assignments (user_id, restaurant_id, assigned_at) VALUES (?, ?, ?)',
        [userId, restaurantId, new Date().toISOString()]
      );
    }
  }

  static create({ username, password, full_name, role_code, restaurant_id = null, assigned_restaurant_ids = [], email = null, phone = null } = {}) {
    const cleanUsername = String(username || '').trim();
    const cleanName = String(full_name || '').trim();
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(cleanUsername)) throw new Error('Username phải có 3-40 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới');
    if (!cleanName) throw new Error('Họ tên không được để trống');
    if (typeof password !== 'string' || password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự');
    if (queryOne('SELECT id FROM users WHERE username = ?', [cleanUsername])) throw new Error('Username đã tồn tại');

    const role = queryOne('SELECT id, code FROM roles WHERE code = ?', [role_code]);
    if (!role) throw new Error('Vai trò không tồn tại');
    const assignedIds = this.validateAssignments(role.code, restaurant_id, assigned_restaurant_ids);
    const id = `usr-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    db.exec('BEGIN');
    try {
      executeSql(
        `INSERT INTO users (id, username, password_hash, full_name, role_id, restaurant_id, email, phone, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, cleanUsername, hashPassword(password), cleanName, role.id, role.code === 'RESTAURANT' ? restaurant_id : null, email, phone, now, now]
      );
      this.saveAssignments(id, assignedIds);
      db.exec('COMMIT');
      return this.getById(id);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  static update(id, { full_name, role_code, restaurant_id, assigned_restaurant_ids, is_active, password, email, phone } = {}) {
    const current = this.getById(id);
    if (!current) throw new Error('Người dùng không tồn tại');
    const updatedName = typeof full_name === 'string' ? full_name.trim() : current.full_name;
    if (!updatedName) throw new Error('Họ tên không được để trống');

    const role = role_code ? queryOne('SELECT id, code FROM roles WHERE code = ?', [role_code]) : { id: current.role_id, code: current.role_code };
    if (!role) throw new Error('Vai trò không tồn tại');
    const restaurantId = role.code === 'RESTAURANT'
      ? (restaurant_id === undefined ? current.restaurant_id : (restaurant_id || null))
      : null;
    const assignedIds = role.code === 'AC_LD'
      ? this.validateAssignments(role.code, null, assigned_restaurant_ids === undefined ? current.assigned_restaurant_ids : assigned_restaurant_ids)
      : this.validateAssignments(role.code, restaurantId, []);
    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
      throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
    }
    if (restaurant_id && role.code !== 'RESTAURANT') throw new Error('Chỉ tài khoản nhà hàng mới dùng gán một nhà hàng trực tiếp');

    const updatedActive = is_active === undefined ? current.is_active : Number(is_active === true || Number(is_active) === 1);
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      executeSql(
        `UPDATE users SET full_name = ?, role_id = ?, restaurant_id = ?, is_active = ?, email = ?, phone = ?,
                           password_hash = COALESCE(?, password_hash), updated_at = ? WHERE id = ?`,
        [updatedName, role.id, restaurantId, updatedActive, email === undefined ? current.email : email, phone === undefined ? current.phone : phone,
          password ? hashPassword(password) : null, now, id]
      );
      this.saveAssignments(id, assignedIds);
      db.exec('COMMIT');
      return this.getById(id);
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
