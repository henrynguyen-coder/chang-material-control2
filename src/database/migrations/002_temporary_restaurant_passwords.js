export const version = 2;
export const name = 'temporary-restaurant-passwords';

export async function up(db) {
  await db.executeSql(
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password INTEGER NOT NULL DEFAULT 0'
  );
}
