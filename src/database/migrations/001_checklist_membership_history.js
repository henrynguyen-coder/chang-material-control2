export const version = 1;
export const name = 'checklist-membership-history-snapshots';

export async function up(db) {
  const additions = [
    ['notifications', 'data', 'TEXT'],
    ['audit_logs', 'restaurant_id', 'TEXT'],
    ['shift_configs', 'reminder_minutes_before', 'INTEGER NOT NULL DEFAULT 30'],
    ['checklist_items', 'is_active', 'INTEGER NOT NULL DEFAULT 1'],
    ['assessment_details', 'material_name_snapshot', 'TEXT'],
    ['assessment_details', 'material_code_snapshot', 'TEXT'],
  ];

  for (const [tableName, columnName, columnDefinition] of additions) {
    await db.executeSql(
      `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinition}`
    );
  }

  await db.executeSql(`
    UPDATE assessment_details AS detail
    SET material_name_snapshot = COALESCE(detail.material_name_snapshot, material.material_name),
        material_code_snapshot = COALESCE(detail.material_code_snapshot, material.material_code)
    FROM materials AS material
    WHERE material.id = detail.material_id
      AND (detail.material_name_snapshot IS NULL OR detail.material_code_snapshot IS NULL)
  `);
}
