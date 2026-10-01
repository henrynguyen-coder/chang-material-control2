export const version = 1;
export const name = 'checklist-membership-history-snapshots';

function hasColumn(db, tableName, columnName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().some(column => column.name === columnName);
}

export function up({ db }) {
  const additions = [
    ['notifications', 'data', 'TEXT'],
    ['audit_logs', 'restaurant_id', 'TEXT'],
    ['shift_configs', 'reminder_minutes_before', 'INTEGER DEFAULT 30'],
    ['checklist_items', 'is_active', 'INTEGER NOT NULL DEFAULT 1'],
    ['assessment_details', 'material_name_snapshot', 'TEXT'],
    ['assessment_details', 'material_code_snapshot', 'TEXT']
  ];

  for (const [tableName, columnName, columnDefinition] of additions) {
    if (!hasColumn(db, tableName, columnName)) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    }
  }

  db.prepare(`
    UPDATE assessment_details
    SET material_name_snapshot = COALESCE(
          material_name_snapshot,
          (SELECT material_name FROM materials WHERE materials.id = assessment_details.material_id)
        ),
        material_code_snapshot = COALESCE(
          material_code_snapshot,
          (SELECT material_code FROM materials WHERE materials.id = assessment_details.material_id)
        )
    WHERE material_name_snapshot IS NULL OR material_code_snapshot IS NULL
  `).run();
}
