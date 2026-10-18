import { MaterialModel } from '../models/MaterialModel.js';
import { ChecklistModel } from '../models/ChecklistModel.js';
import { RoleModel } from '../models/RoleModel.js';
import { UserModel } from '../models/UserModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class MasterDataController {
  static async getMaterials(req, res, searchParams) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const includeInactive = searchParams?.get('include_inactive') === 'true';
    if (includeInactive && !requireRole('ADMIN')(user, res)) return;
    const materials = await MaterialModel.getAll({ includeInactive });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ materials }));
  }

  static async createMaterial(req, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const material = await MaterialModel.create(body || {});
      await AuditLogModel.log({ user_id: user.id, action: 'MATERIAL UPDATE', entity_type: 'MATERIAL', entity_id: material.id, new_values: material });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Tạo vật tư thành công', material }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async updateMaterial(req, id, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;

    try {
      const oldMaterial = await MaterialModel.getById(id);
      const material = await MaterialModel.update(id, body || {});
      await AuditLogModel.log({
        user_id: user.id,
        action: 'MATERIAL UPDATE',
        entity_type: 'MATERIAL',
        entity_id: id,
        old_values: oldMaterial,
        new_values: material
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Cập nhật vật tư thành công', material }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async setMaterialStatus(req, id, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldMaterial = await MaterialModel.getById(id);
      const material = await MaterialModel.setActive(id, body?.is_active);
      await AuditLogModel.log({
        user_id: user.id,
        action: 'MATERIAL UPDATE',
        entity_type: 'MATERIAL',
        entity_id: id,
        old_values: oldMaterial,
        new_values: material
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: material.is_active ? 'Đã kích hoạt vật tư' : 'Đã vô hiệu hóa vật tư', material }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async getChecklists(req, res) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const checklists = await ChecklistModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checklists }));
  }

  static async getChecklistItems(req, checklistId, searchParams, res) {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (user.role_code === 'ADMIN') {
      const assignments = await ChecklistModel.getAssignments(checklistId, {
        department: searchParams?.get('department') || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assignments }));
      return;
    }
    const items = await ChecklistModel.getItems(checklistId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items }));
  }

  static async getChecklistAssignments(req, checklistId, searchParams, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const assignments = await ChecklistModel.getAssignments(checklistId, {
        department: searchParams.get('department') || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assignments }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async addChecklistItem(req, checklistId, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const item = await ChecklistModel.addItem(checklistId, body || {});
      await AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, new_values: item });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã gán Material vào Checklist', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async updateChecklistItem(req, itemId, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldItem = await ChecklistModel.getAssignmentsForItem(itemId);
      const item = await ChecklistModel.updateItem(itemId, body || {});
      await AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, old_values: oldItem, new_values: item });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã cập nhật ChecklistItem', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async setChecklistItemStatus(req, itemId, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldItem = await ChecklistModel.getAssignmentsForItem(itemId);
      const item = await ChecklistModel.setItemActive(itemId, body?.is_active);
      await AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, old_values: oldItem, new_values: item });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: item.is_active ? 'Đã kích hoạt membership' : 'Đã deactivate membership', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async reorderChecklistItems(req, checklistId, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const items = await ChecklistModel.reorderItems(checklistId, body?.items);
      await AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST', entity_id: checklistId, new_values: { items } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã cập nhật thứ tự Checklist', items }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async getRoles(req, res) {
    const user = await requireAuth(req, res);
    if (!user) return;
    const roles = await RoleModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roles }));
  }

  static async getUsers(req, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    const users = await UserModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users }));
  }

  static async updateUser(req, id, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;

    try {
      const oldUser = await UserModel.getById(id);
      const updatedUser = await UserModel.update(id, body || {});
      await AuditLogModel.log({
        user_id: user.id,
        restaurant_id: updatedUser.restaurant_id,
        action: 'USER UPDATE',
        entity_type: 'USER',
        entity_id: id,
        old_values: oldUser,
        new_values: updatedUser
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Cập nhật tài khoản thành công', user: updatedUser }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async createUser(req, body, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const newUser = await UserModel.create(body || {});
      await AuditLogModel.log({
        user_id: user.id,
        restaurant_id: newUser.restaurant_id,
        action: 'USER UPDATE',
        entity_type: 'USER',
        entity_id: newUser.id,
        new_values: newUser
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Tạo tài khoản thành công', user: newUser }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static async getAuditLogs(req, res) {
    const user = await requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    const logs = await AuditLogModel.getAll({ limit: 100 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs }));
  }
}
