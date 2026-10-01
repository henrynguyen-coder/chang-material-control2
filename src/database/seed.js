import { initDbSchema, executeSql, queryAll, queryOne } from './db.js';
import { runMigrations } from './migrations/runner.js';
import { hashPassword } from '../utils/crypto.js';

export function runSeed() {
  const productionMode = process.env.NODE_ENV === 'production';
  const initialAdminPassword = process.env.CHANG_MATERIAL_INITIAL_ADMIN_PASSWORD;
  if (productionMode && !initialAdminPassword) {
    throw new Error('Set CHANG_MATERIAL_INITIAL_ADMIN_PASSWORD before seeding a production database.');
  }

  const existingTables = new Set(queryAll("SELECT name FROM sqlite_master WHERE type = 'table'").map(table => table.name));
  const businessTables = ['roles', 'restaurants', 'users', 'materials', 'checklists', 'checklist_items'];
  const hasBusinessRows = businessTables.some(table => existingTables.has(table)
    && queryOne(`SELECT EXISTS(SELECT 1 FROM ${table}) as has_rows`).has_rows);
  if (hasBusinessRows) {
    console.warn('Bootstrap skipped: existing business data detected. Use Admin UI for business changes.');
    return false;
  }

  console.log('Initializing database schema...');
  initDbSchema();
  runMigrations();

  console.log('Seeding Roles...');
  const roles = [
    { id: 'role-admin', code: 'ADMIN', name: 'System Administrator', description: 'Full access to master data, users, and configuration' },
    { id: 'role-ac-ld', code: 'AC_LD', name: 'Area Controller & L&D', description: 'Access to dashboards, checklists, material issues, and reports across outlets' },
    { id: 'role-restaurant', code: 'RESTAURANT', name: 'Restaurant Staff & Manager', description: 'Access restricted strictly to assigned restaurant operational data' }
  ];

  for (const r of roles) {
    const existing = queryOne('SELECT id FROM roles WHERE code = ?', [r.code]);
    if (!existing) {
      executeSql(
        'INSERT INTO roles (id, code, name, description) VALUES (?, ?, ?, ?)',
        [r.id, r.code, r.name, r.description]
      );
    }
  }

  console.log('Seeding 15 Exact Restaurants with Updated Short Codes...');
  const restaurantsData = [
    { code: 'CT-NDC', name: 'CT - Nguyễn Đức Cảnh' },
    { code: 'CT-PXL', name: 'CT - Phan Xích Long' },
    { code: 'CT-CT', name: 'CT - Cao Thắng' },
    { code: 'CT-VHM', name: 'CT - Vạn Hạnh Mall' },
    { code: 'CT-VVN', name: 'CT - Võ Văn Ngân' },
    { code: 'CT-HHT', name: 'CT - Hoàng Hoa Thám' },
    { code: 'CT-CK', name: 'CT - Central Kitchen' },
    { code: 'CT-DS7', name: 'CT - DS7' },
    { code: 'CT-NTD', name: 'CT - Nguyễn Thị Định' },
    { code: 'CT-CVI', name: 'CT - Cảnh Viên' },
    { code: 'CT-LGV', name: 'CT - Lotte Gò Vấp' },
    { code: 'CT-PVD', name: 'CT - Sense Phạm Văn Đồng' },
    { code: 'CT-LVS', name: 'CT - Lê Văn Sỹ' },
    { code: 'CT-XL', name: 'CT - Xuân La' },
    { code: 'CT-LDH', name: 'CT - Lê Đại Hành' }
  ];

  const restaurantMap = {};

  restaurantsData.forEach((item, index) => {
    // Check by name or code
    const existingByName = queryOne('SELECT id FROM restaurants WHERE restaurant_name = ?', [item.name]);
    const existingByCode = queryOne('SELECT id FROM restaurants WHERE restaurant_code = ?', [item.code]);
    
    let id;
    if (existingByName) {
      id = existingByName.id;
    } else if (existingByCode) {
      id = existingByCode.id;
    } else {
      id = `rest-${(index + 1).toString().padStart(2, '0')}`;
      executeSql(
        `INSERT INTO restaurants (id, restaurant_code, restaurant_name, status) VALUES (?, ?, ?, 'ACTIVE')`,
        [id, item.code, item.name]
      );
    }
    restaurantMap[index + 1] = id;
  });

  console.log('Seeding Demo Users with Hashed Passwords...');
  const adminRoleId = queryOne("SELECT id FROM roles WHERE code = 'ADMIN'").id;
  const acLdRoleId = queryOne("SELECT id FROM roles WHERE code = 'AC_LD'").id;
  const restRoleId = queryOne("SELECT id FROM roles WHERE code = 'RESTAURANT'").id;

  const usersToSeed = [
    {
      id: 'usr-admin',
      username: 'admin',
      password: productionMode ? initialAdminPassword : 'Admin@123',
      full_name: 'System Admin',
      role_id: adminRoleId,
      restaurant_id: null,
      email: 'admin@chang.vn'
    }
  ];

  if (!productionMode) {
    usersToSeed.push(
      {
        id: 'usr-ac-demo',
        username: 'ac.demo',
        password: 'AC@123',
        full_name: 'Nguyen Van AC (Area Controller)',
        role_id: acLdRoleId,
        restaurant_id: null,
        email: 'ac.demo@chang.vn'
      },
      {
        id: 'usr-ld-demo',
        username: 'ld.demo',
        password: 'LD@123',
        full_name: 'Tran Thi LD (Training Manager)',
        role_id: acLdRoleId,
        restaurant_id: null,
        email: 'ld.demo@chang.vn'
      }
    );

    for (let i = 1; i <= 15; i++) {
      const numStr = i.toString().padStart(2, '0');
      usersToSeed.push({
        id: `usr-rest-${numStr}`,
        username: `restaurant_${numStr}`,
        password: 'Restaurant@123',
        full_name: `Quản Lý ${restaurantsData[i - 1].name}`,
        role_id: restRoleId,
        restaurant_id: restaurantMap[i],
        email: `store${numStr}@chang.vn`
      });
    }
  }

  for (const u of usersToSeed) {
    const existing = queryOne('SELECT id FROM users WHERE username = ?', [u.username]);
    if (!existing) {
      const hash = hashPassword(u.password);
      executeSql(
        `INSERT INTO users (id, username, password_hash, full_name, role_id, restaurant_id, email, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [u.id, u.username, hash, u.full_name, u.role_id, u.restaurant_id, u.email]
      );
    }
  }

  for (const u of usersToSeed.filter(user => user.role_id === acLdRoleId)) {
    const hasAssignments = queryOne(
      'SELECT COUNT(*) as count FROM user_restaurant_assignments WHERE user_id = ?',
      [u.id]
    ).count;
    if (!hasAssignments) {
      for (const restaurantId of Object.values(restaurantMap)) {
        executeSql(
          'INSERT OR IGNORE INTO user_restaurant_assignments (user_id, restaurant_id) VALUES (?, ?)',
          [u.id, restaurantId]
        );
      }
    }
  }

  console.log('Seeding FOH & BOH Materials (Phase 5)...');
  const sampleMaterials = [
    // FOH Materials
    { id: 'mat-foh-01', code: 'MAT-FOH-01', name: 'Trà Thái Đỏ Ủ Sẵn (Bar)', department: 'FOH', category: 'Beverages', unit: 'Lít', mandatory: 1, photo: 0, min_temp: 1, max_temp: 4 },
    { id: 'mat-foh-02', code: 'MAT-FOH-02', name: 'Đá Viên Sạch Kháng Khuẩn', department: 'FOH', category: 'Ice & Cold', unit: 'Kg', mandatory: 1, photo: 1, min_temp: -5, max_temp: 0 },
    { id: 'mat-foh-03', code: 'MAT-FOH-03', name: 'Dừa Tươi Bến Tre Nhập Kho', department: 'FOH', category: 'Beverages', unit: 'Quả', mandatory: 0, photo: 0, min_temp: 5, max_temp: 15 },
    
    // BOH Materials
    { id: 'mat-boh-01', code: 'MAT-BOH-01', name: 'Nước Cốt Tom Yum Special', department: 'BOH', category: 'Sauces & Soup', unit: 'Lít', mandatory: 1, photo: 1, min_temp: 1, max_temp: 4 },
    { id: 'mat-boh-02', code: 'MAT-BOH-02', name: 'Thịt Heo Ba Chỉ Nhập Khẩu', department: 'BOH', category: 'Meat', unit: 'Kg', mandatory: 1, photo: 1, min_temp: -18, max_temp: -12 },
    { id: 'mat-boh-03', code: 'MAT-BOH-03', name: 'Tôm Sú Tươi Sống', department: 'BOH', category: 'Seafood', unit: 'Kg', mandatory: 1, photo: 0, min_temp: 0, max_temp: 2 },
    { id: 'mat-boh-04', code: 'MAT-BOH-04', name: 'Rau Quế & Ngò Gai Thái Fresh', department: 'BOH', category: 'Vegetables', unit: 'Kg', mandatory: 0, photo: 0, min_temp: 4, max_temp: 10 }
  ];

  for (const m of sampleMaterials) {
    const existing = queryOne('SELECT id FROM materials WHERE material_code = ?', [m.code]);
    if (!existing) {
      executeSql(
        `INSERT INTO materials (id, material_code, material_name, department, category, unit, is_mandatory, photo_required, min_temp, max_temp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.id, m.code, m.name, m.department, m.category, m.unit, m.mandatory, m.photo, m.min_temp, m.max_temp]
      );
    }
  }

  // Seed Checklist and Checklist Items
  const checklistExist = queryOne("SELECT id FROM checklists WHERE checklist_code = 'CHK-MORN-01'");
  if (!checklistExist) {
    executeSql(
      `INSERT INTO checklists (id, checklist_code, title, shift_type, version) VALUES ('chk-morn-01', 'CHK-MORN-01', 'Kiểm Tra Nguyên Vật Liệu Đầu Ca (FOH & BOH)', 'MORNING', 1)`
    );
  }

  const chkItems = [
    { id: 'item-f01', material_id: 'mat-foh-01', display_order: 1, req: 'Trà đậm vị, không chua, độ lạnh 1°C - 4°C', target: 3 },
    { id: 'item-f02', material_id: 'mat-foh-02', display_order: 2, req: 'Đá trong suốt, không mùi lạ, chụp ảnh hộc đá', target: -2 },
    { id: 'item-f03', material_id: 'mat-foh-03', display_order: 3, req: 'Vỏ xanh, nước ngọt tự nhiên', target: 10 },
    { id: 'item-b01', material_id: 'mat-boh-01', display_order: 4, req: 'Nước cốt Tom Yum sánh mịn, đúng chuẩn vị Thái, chụp ảnh mẫu', target: 3 },
    { id: 'item-b02', material_id: 'mat-boh-02', display_order: 5, req: 'Đông lạnh chuẩn (≤ -12°C), thịt đỏ tươi, chụp ảnh tem hạn dùng', target: -15 },
    { id: 'item-b03', material_id: 'mat-boh-03', display_order: 6, req: 'Tôm tươi sống bơi khỏe / ướp đá vẩy (0°C - 2°C)', target: 1 },
    { id: 'item-b04', material_id: 'mat-boh-04', display_order: 7, req: 'Rau tươi xanh không dập nát', target: 5 }
  ];

  for (const item of chkItems) {
    const existing = queryOne('SELECT id FROM checklist_items WHERE id = ?', [item.id]);
    if (!existing) {
      executeSql(
        `INSERT INTO checklist_items (id, checklist_id, material_id, display_order, requirement_text, target_temp) VALUES (?, 'chk-morn-01', ?, ?, ?, ?)`,
        [item.id, item.material_id, item.display_order, item.req, item.target]
      );
    }
  }

  console.log('Database Seed Completed Successfully!');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed();
}
