import crypto from 'node:crypto';
import { executeSql, queryOne } from '../database/db.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class SessionModel {
  static async create(token, userId) {
    await executeSql(
      'INSERT INTO user_sessions (token_hash, user_id, created_at) VALUES (?, ?, ?)',
      [hashToken(token), userId, new Date().toISOString()]
    );
  }

  static async getUserId(token) {
    if (!token) return null;
    const session = await queryOne(
      'SELECT user_id FROM user_sessions WHERE token_hash = ?',
      [hashToken(token)]
    );
    return session?.user_id || null;
  }

  static async delete(token) {
    if (!token) return;
    await executeSql('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
  }
}
