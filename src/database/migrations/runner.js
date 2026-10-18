import { fileURLToPath } from 'node:url';
import { databasePath, initDbSchema, queryOne, withTransaction, closeDb } from '../db.js';
import * as checklistMembershipHistory from './001_checklist_membership_history.js';
import * as temporaryRestaurantPasswords from './002_temporary_restaurant_passwords.js';

const migrations = [checklistMembershipHistory, temporaryRestaurantPasswords];

export async function runMigrations() {
  await initDbSchema();

  for (const migration of migrations) {
    const applied = await queryOne(
      'SELECT version FROM schema_migrations WHERE version = ?',
      [migration.version]
    );
    if (applied) continue;

    await withTransaction(async tx => {
      await migration.up(tx);
      await tx.executeSql(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()]
      );
    });
  }
}

export async function assertMigrationsApplied() {
  const current = await queryOne('SELECT MAX(version) AS version FROM schema_migrations');
  const required = migrations.at(-1)?.version || 0;
  if (Number(current?.version || 0) < required) {
    throw new Error(`Database schema is behind the required version. Run "npm run migrate". Database: ${databasePath}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.env.CHANG_MATERIAL_MIGRATION_CONFIRM !== 'YES') {
      throw new Error('Set CHANG_MATERIAL_MIGRATION_CONFIRM=YES to apply schema migrations.');
    }
    await runMigrations();
    console.log(`Database schema ready (${databasePath}).`);
  } finally {
    await closeDb();
  }
}
