import { UserModel } from '../models/UserModel.js';
import { SessionModel } from '../models/SessionModel.js';

export async function authenticateToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) return null;
  const userId = await SessionModel.getUserId(token);
  if (!userId) return null;
  const user = await UserModel.getById(userId);
  if (!user?.is_active) {
    await SessionModel.delete(token);
    return null;
  }
  return user;
}

export async function requireAuth(req, res) {
  const user = await authenticateToken(req);
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn' }));
    return null;
  }
  return user;
}

export function requireRole(allowedRoles) {
  return (user, res) => {
    if (!user) return false;

    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!rolesArray.includes(user.role_code)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Truy cập bị từ chối: Quyền ${user.role_code} không được phép thực hiện thao tác này`
      }));
      return false;
    }
    return true;
  };
}

export function enforceRestaurantIsolation(user, targetRestaurantId, res) {
  if (user.role_code === 'RESTAURANT') {
    if (user.restaurant_id !== targetRestaurantId) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Truy cập bị từ chối: Tài khoản nhà hàng chỉ được quyền xem/sửa dữ liệu của nhà hàng được phân công'
      }));
      return false;
    }
  }
  return true;
}
