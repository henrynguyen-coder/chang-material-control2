import { queryAll, queryOne, executeSql } from '../database/db.js';
import crypto from 'node:crypto';

export class RestaurantModel {
  static getAll({ status, search } = {}) {
    let sql = 'SELECT * FROM restaurants WHERE 1=1';
    const params = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (restaurant_code LIKE ? OR restaurant_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY restaurant_code ASC';
    return queryAll(sql, params);
  }

  static getById(id) {
    return queryOne('SELECT * FROM restaurants WHERE id = ?', [id]);
  }

  static getByCode(code) {
    return queryOne('SELECT * FROM restaurants WHERE UPPER(restaurant_code) = UPPER(?)', [code]);
  }

  static create({ restaurant_code, restaurant_name, status = 'ACTIVE' }) {
    if (!restaurant_code || !restaurant_code.trim()) {
      throw new Error('Mã nhà hàng (restaurant_code) là bắt buộc');
    }
    if (!restaurant_name || !restaurant_name.trim()) {
      throw new Error('Tên nhà hàng (restaurant_name) là bắt buộc');
    }

    const trimmedCode = restaurant_code.trim().toUpperCase();
    const existing = this.getByCode(trimmedCode);
    if (existing) {
      throw new Error(`Mã nhà hàng "${trimmedCode}" đã tồn tại trên hệ thống`);
    }

    const id = `rest-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date().toISOString();

    executeSql(
      `INSERT INTO restaurants (id, restaurant_code, restaurant_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, trimmedCode, restaurant_name.trim(), status, now, now]
    );

    return this.getById(id);
  }

  static update(id, { restaurant_code, restaurant_name, status }) {
    const restaurant = this.getById(id);
    if (!restaurant) {
      throw new Error('Nhà hàng không tồn tại');
    }

    let trimmedCode = restaurant.restaurant_code;
    if (restaurant_code && restaurant_code.trim()) {
      trimmedCode = restaurant_code.trim().toUpperCase();
      if (trimmedCode !== restaurant.restaurant_code) {
        const existing = this.getByCode(trimmedCode);
        if (existing && existing.id !== id) {
          throw new Error(`Mã nhà hàng "${trimmedCode}" đã tồn tại trên hệ thống`);
        }
      }
    }

    const updatedName = restaurant_name ? restaurant_name.trim() : restaurant.restaurant_name;
    const updatedStatus = status || restaurant.status;
    const now = new Date().toISOString();

    executeSql(
      `UPDATE restaurants 
       SET restaurant_code = ?, restaurant_name = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [trimmedCode, updatedName, updatedStatus, now, id]
    );

    return this.getById(id);
  }

  static toggleStatus(id, newStatus) {
    const restaurant = this.getById(id);
    if (!restaurant) {
      throw new Error('Nhà hàng không tồn tại');
    }
    const statusToSet = newStatus || (restaurant.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
    const now = new Date().toISOString();

    executeSql(
      `UPDATE restaurants SET status = ?, updated_at = ? WHERE id = ?`,
      [statusToSet, now, id]
    );

    return this.getById(id);
  }
}
