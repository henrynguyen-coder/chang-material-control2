import { UserModel } from '../models/UserModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { generateToken } from '../utils/crypto.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { SessionModel } from '../models/SessionModel.js';

export class AuthController {
  static async login(req, body, res) {
    const { username, password } = body || {};
    if (!username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' }));
      return;
    }

    const user = await UserModel.authenticate(username, password);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' }));
      return;
    }

    if (user.error) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: user.error }));
      return;
    }

    const token = generateToken();
    await SessionModel.create(token, user.id);

    await AuditLogModel.log({
      user_id: user.id,
      restaurant_id: user.restaurant_id,
      action: 'LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      new_values: { username: user.username, role: user.role_code, full_name: user.full_name }
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Đăng nhập thành công',
      token,
      user
    }));
  }

  static async logout(req, res) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const userId = await SessionModel.getUserId(token);
    if (userId) {
      await SessionModel.delete(token);

      await AuditLogModel.log({
        user_id: userId,
        restaurant_id: (await UserModel.getById(userId))?.restaurant_id,
        action: 'LOGOUT',
        entity_type: 'USER',
        entity_id: userId
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Đã đăng xuất thành công' }));
  }

  static async me(req, res) {
    const user = await authenticateToken(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Chưa đăng nhập' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user }));
  }
}
