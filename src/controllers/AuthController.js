import { UserModel } from '../models/UserModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { generateToken, hashPassword } from '../utils/crypto.js';
import { sessionStore, authenticateToken } from '../middleware/authMiddleware.js';

export class AuthController {
  static login(req, body, res) {
    const { username, password } = body || {};
    if (!username || !password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Tên đăng nhập và mật khẩu là bắt buộc' }));
      return;
    }

    const user = UserModel.authenticate(username, password);
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
    sessionStore.set(token, user.id);

    AuditLogModel.log({
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

  static logout(req, res) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (token && sessionStore.has(token)) {
      const userId = sessionStore.get(token);
      sessionStore.delete(token);

      AuditLogModel.log({
        user_id: userId,
        restaurant_id: UserModel.getById(userId)?.restaurant_id,
        action: 'LOGOUT',
        entity_type: 'USER',
        entity_id: userId
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Đã đăng xuất thành công' }));
  }

  static me(req, res) {
    const user = authenticateToken(req);
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Chưa đăng nhập' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user }));
  }
}
