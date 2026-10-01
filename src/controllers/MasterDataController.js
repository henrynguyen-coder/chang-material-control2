import { MaterialModel } from '../models/MaterialModel.js';
import { ChecklistModel } from '../models/ChecklistModel.js';
import { RoleModel } from '../models/RoleModel.js';
import { UserModel } from '../models/UserModel.js';
import { AuditLogModel } from '../models/AuditLogModel.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

export class MasterDataController {
  static getMaterials(req, res, searchParams) {
    const user = requireAuth(req, res);
    if (!user) return;
    const includeInactive = searchParams?.get('include_inactive') === 'true';
    if (includeInactive && !requireRole('ADMIN')(user, res)) return;
    const materials = MaterialModel.getAll({ includeInactive });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ materials }));
  }

  static createMaterial(req, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const material = MaterialModel.create(body || {});
      AuditLogModel.log({ user_id: user.id, action: 'MATERIAL UPDATE', entity_type: 'MATERIAL', entity_id: material.id, new_values: material });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Tạo vật tư thành công', material }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static updateMaterial(req, id, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;

    try {
      const oldMaterial = MaterialModel.getById(id);
      const material = MaterialModel.update(id, body || {});
      AuditLogModel.log({
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

  static setMaterialStatus(req, id, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldMaterial = MaterialModel.getById(id);
      const material = MaterialModel.setActive(id, body?.is_active);
      AuditLogModel.log({
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

  static getChecklists(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;
    const checklists = ChecklistModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ checklists }));
  }

  static getChecklistItems(req, checklistId, searchParams, res) {
    const user = requireAuth(req, res);
    if (!user) return;
    if (user.role_code === 'ADMIN') {
      const assignments = ChecklistModel.getAssignments(checklistId, {
        department: searchParams?.get('department') || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assignments }));
      return;
    }
    const items = ChecklistModel.getItems(checklistId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ items }));
  }

  static getChecklistAssignments(req, checklistId, searchParams, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const assignments = ChecklistModel.getAssignments(checklistId, {
        department: searchParams.get('department') || null
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ assignments }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static addChecklistItem(req, checklistId, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const item = ChecklistModel.addItem(checklistId, body || {});
      AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, new_values: item });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã gán Material vào Checklist', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static updateChecklistItem(req, itemId, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldItem = ChecklistModel.getAssignmentsForItem(itemId);
      const item = ChecklistModel.updateItem(itemId, body || {});
      AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, old_values: oldItem, new_values: item });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã cập nhật ChecklistItem', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static setChecklistItemStatus(req, itemId, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const oldItem = ChecklistModel.getAssignmentsForItem(itemId);
      const item = ChecklistModel.setItemActive(itemId, body?.is_active);
      AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST_ITEM', entity_id: item.id, old_values: oldItem, new_values: item });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: item.is_active ? 'Đã kích hoạt membership' : 'Đã deactivate membership', item }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static reorderChecklistItems(req, checklistId, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const items = ChecklistModel.reorderItems(checklistId, body?.items);
      AuditLogModel.log({ user_id: user.id, action: 'ADMIN UPDATE', entity_type: 'CHECKLIST', entity_id: checklistId, new_values: { items } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Đã cập nhật thứ tự Checklist', items }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  static getRoles(req, res) {
    const user = requireAuth(req, res);
    if (!user) return;
    const roles = RoleModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roles }));
  }

  static getUsers(req, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    const users = UserModel.getAll();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ users }));
  }

  static updateUser(req, id, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;

    try {
      const oldUser = UserModel.getById(id);
      const updatedUser = UserModel.update(id, body || {});
      AuditLogModel.log({
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

  static createUser(req, body, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    try {
      const newUser = UserModel.create(body || {});
      AuditLogModel.log({
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

  static getAuditLogs(req, res) {
    const user = requireAuth(req, res);
    if (!user || !requireRole('ADMIN')(user, res)) return;
    const logs = AuditLogModel.getAll({ limit: 100 });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ logs }));
  }
}
