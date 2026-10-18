import { queryAll } from '../database/db.js';

export class RoleModel {
  static async getAll() {
    return queryAll('SELECT * FROM roles ORDER BY code ASC');
  }
}
