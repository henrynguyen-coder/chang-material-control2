CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id TEXT PRIMARY KEY,
  restaurant_code TEXT UNIQUE NOT NULL,
  restaurant_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  restaurant_id TEXT REFERENCES restaurants(id) ON DELETE SET NULL,
  email TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_restaurant_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  material_code TEXT UNIQUE NOT NULL,
  material_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT 'BOH' CHECK (department IN ('FOH', 'BOH')),
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  is_mandatory INTEGER NOT NULL DEFAULT 1,
  photo_required INTEGER NOT NULL DEFAULT 0,
  storage_type TEXT,
  min_temp REAL,
  max_temp REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  checklist_code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id),
  display_order INTEGER NOT NULL DEFAULT 0,
  requirement_text TEXT,
  is_mandatory INTEGER NOT NULL DEFAULT 1,
  target_temp REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS material_assessments (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  checklist_id TEXT NOT NULL REFERENCES checklists(id),
  inspector_id TEXT NOT NULL REFERENCES users(id),
  shift_date TEXT NOT NULL,
  shift_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  overall_allowed_to_serve TEXT NOT NULL DEFAULT 'YES' CHECK (overall_allowed_to_serve IN ('YES', 'NO')),
  is_late INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 100.0,
  notes TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_details (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL REFERENCES material_assessments(id) ON DELETE CASCADE,
  checklist_item_id TEXT NOT NULL REFERENCES checklist_items(id),
  material_id TEXT NOT NULL REFERENCES materials(id),
  department TEXT NOT NULL DEFAULT 'BOH' CHECK (department IN ('FOH', 'BOH')),
  color_result TEXT NOT NULL DEFAULT 'PASS' CHECK (color_result IN ('PASS', 'FAIL', 'N/A')),
  smell_result TEXT NOT NULL DEFAULT 'PASS' CHECK (smell_result IN ('PASS', 'FAIL', 'N/A')),
  taste_result TEXT NOT NULL DEFAULT 'PASS' CHECK (taste_result IN ('PASS', 'FAIL', 'N/A')),
  quality_result TEXT NOT NULL DEFAULT 'PASS' CHECK (quality_result IN ('PASS', 'FAIL', 'N/A')),
  overall_result TEXT NOT NULL DEFAULT 'PASS' CHECK (overall_result IN ('PASS', 'FAIL')),
  allowed_to_serve TEXT NOT NULL DEFAULT 'YES' CHECK (allowed_to_serve IN ('YES', 'NO')),
  remark TEXT,
  photo_url TEXT,
  material_name_snapshot TEXT,
  material_code_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS shift_configs (
  id TEXT PRIMARY KEY,
  shift_code TEXT UNIQUE NOT NULL,
  shift_name TEXT NOT NULL,
  deadline_time TEXT NOT NULL,
  reminder_minutes_before INTEGER NOT NULL DEFAULT 30,
  is_required INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  restaurant_id TEXT REFERENCES restaurants(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'INFO',
  data TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  restaurant_id TEXT REFERENCES restaurants(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_restaurant_date ON material_assessments(restaurant_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_assessments_inspector ON material_assessments(inspector_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_assessment_details_assessment ON assessment_details(assessment_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_date ON audit_logs(restaurant_id, created_at);
