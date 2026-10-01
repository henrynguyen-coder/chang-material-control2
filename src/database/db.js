import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.CHANG_MATERIAL_DB_PATH || path.join(__dirname, '../../chang_material_control.db');
export const databasePath = dbPath;

export const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

export function initDbSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      restaurant_code TEXT UNIQUE NOT NULL,
      restaurant_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id TEXT NOT NULL,
      restaurant_id TEXT,
      email TEXT,
      phone TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_restaurant_assignments (
      user_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, restaurant_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      material_code TEXT UNIQUE NOT NULL,
      material_name TEXT NOT NULL,
      department TEXT CHECK(department IN ('FOH', 'BOH')) DEFAULT 'BOH',
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      is_mandatory INTEGER DEFAULT 1,
      photo_required INTEGER DEFAULT 0,
      storage_type TEXT,
      min_temp REAL,
      max_temp REAL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY,
      checklist_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      requirement_text TEXT,
      is_mandatory INTEGER DEFAULT 1,
      target_temp REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS material_assessments (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL,
      checklist_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      shift_date TEXT NOT NULL,
      shift_type TEXT NOT NULL,
      status TEXT DEFAULT 'SUBMITTED',
      overall_allowed_to_serve TEXT CHECK(overall_allowed_to_serve IN ('YES', 'NO')) DEFAULT 'YES',
      is_late INTEGER DEFAULT 0,
      score REAL DEFAULT 100.0,
      notes TEXT,
      submitted_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY (checklist_id) REFERENCES checklists(id),
      FOREIGN KEY (inspector_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assessment_details (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL,
      checklist_item_id TEXT NOT NULL,
      material_id TEXT NOT NULL,
      department TEXT CHECK(department IN ('FOH', 'BOH')) DEFAULT 'BOH',
      color_result TEXT CHECK(color_result IN ('PASS', 'FAIL', 'N/A')) DEFAULT 'PASS',
      smell_result TEXT CHECK(smell_result IN ('PASS', 'FAIL', 'N/A')) DEFAULT 'PASS',
      taste_result TEXT CHECK(taste_result IN ('PASS', 'FAIL', 'N/A')) DEFAULT 'PASS',
      quality_result TEXT CHECK(quality_result IN ('PASS', 'FAIL', 'N/A')) DEFAULT 'PASS',
      overall_result TEXT CHECK(overall_result IN ('PASS', 'FAIL')) DEFAULT 'PASS',
      allowed_to_serve TEXT CHECK(allowed_to_serve IN ('YES', 'NO')) DEFAULT 'YES',
      remark TEXT,
      photo_url TEXT,
      material_name_snapshot TEXT,
      material_code_snapshot TEXT,
      FOREIGN KEY (assessment_id) REFERENCES material_assessments(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );

    CREATE TABLE IF NOT EXISTS shift_configs (
      id TEXT PRIMARY KEY,
      shift_code TEXT UNIQUE NOT NULL,
      shift_name TEXT NOT NULL,
      deadline_time TEXT NOT NULL, -- Format HH:MM (e.g., "10:30", "17:30")
      reminder_minutes_before INTEGER DEFAULT 30,
      is_required INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      restaurant_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      restaurant_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

}

// Helper wrapper functions
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

export function executeSql(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}
