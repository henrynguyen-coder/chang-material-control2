import { RestaurantModel } from '../models/RestaurantModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class RestaurantController {
  static getAll(req, urlParams, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    // RESTAURANT role only gets their assigned restaurant or filtered list
    if (user.role_code === 'RESTAURANT') {
      const rest = RestaurantModel.getById(user.restaurant_id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ restaurants: rest ? [rest] : [] }));
      return;
    }

    if (user.role_code === 'AC_LD') {
      const assignedIds = user.assigned_restaurant_ids || [];
      const assignedRestaurants = RestaurantModel.getAll({ status: urlParams.get('status') || null })
        .filter(restaurant => assignedIds.includes(restaurant.id));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ restaurants: assignedRestaurants }));
      return;
    }

    const status = urlParams.get('status') || null;
    const search = urlParams.get('search') || null;
    const restaurants = RestaurantModel.getAll({ status, search });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ restaurants }));
  }

  static getById(req, id, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    if (user.role_code === 'RESTAURANT' && user.restaurant_id !== id) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Truy cập bị từ chối: Không có quyền xem nhà hàng khác' }));
      return;
    }

    if (user.role_code === 'AC_LD' && !user.assigned_restaurant_ids?.includes(id)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Truy cập bị từ chối: Nhà hàng chưa được gán cho tài khoản AC/L&D' }));
      return;
    }

    const restaurant = RestaurantModel.getById(id);
    if (!restaurant) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Không tìm thấy nhà hàng' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ restaurant }));
  }

  static create(req, body, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const checkRole = requireRole('ADMIN');
    if (!checkRole(user, res)) return;

    try {
      const newRestaurant = RestaurantModel.create(body || {});

      AuditLogModel.log({
        user_id: user.id,
        restaurant_id: newRestaurant.id,
        action: 'CREATE_RESTAURANT',
        entity_type: 'RESTAURANT',
        entity_id: newRestaurant.id,
        new_values: newRestaurant
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Thêm nhà hàng thành công',
        restaurant: newRestaurant
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static update(req, id, body, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const checkRole = requireRole('ADMIN');
    if (!checkRole(user, res)) return;

    try {
      const oldVal = RestaurantModel.getById(id);
      const updatedRestaurant = RestaurantModel.update(id, body || {});

      AuditLogModel.log({
        user_id: user.id,
        restaurant_id: id,
        action: 'ADMIN UPDATE',
        entity_type: 'RESTAURANT',
        entity_id: id,
        old_values: oldVal,
        new_values: updatedRestaurant
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Cập nhật thông tin nhà hàng thành công',
        restaurant: updatedRestaurant
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  static toggleStatus(req, id, body, res) {
    const user = requireAuth(req, res);
    if (!user) return;

    const checkRole = requireRole('ADMIN');
    if (!checkRole(user, res)) return;

    try {
      const oldVal = RestaurantModel.getById(id);
      const updatedRestaurant = RestaurantModel.toggleStatus(id, body?.status);

      AuditLogModel.log({
        user_id: user.id,
        restaurant_id: id,
        action: 'ADMIN UPDATE',
        entity_type: 'RESTAURANT',
        entity_id: id,
        old_values: { status: oldVal.status },
        new_values: { status: updatedRestaurant.status }
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: `Đã ${updatedRestaurant.status === 'ACTIVE' ? 'kích hoạt' : 'vô hiệu hóa'} nhà hàng`,
        restaurant: updatedRestaurant
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}
