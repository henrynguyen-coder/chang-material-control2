import { fileURLToPath } from 'node:url';
import { databasePath, db, initDbSchema, queryOne } from '../db.js';
import * as checklistMembershipHistory from './001_checklist_membership_history.js';

const migrations = [checklistMembershipHistory];

export function runMigrations() {
  initDbSchema();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  for (const migration of migrations) {
    const applied = queryOne('SELECT version FROM schema_migrations WHERE version = ?', [migration.version]);
    if (applied) continue;

    db.exec('BEGIN IMMEDIATE');
    try {
      migration.up({ db });
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

export function assertMigrationsApplied() {
  const table = queryOne("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'");
  if (!table) throw new Error('Database migrations are not installed. After backup and review, run `npm run migrate` explicitly.');

  const current = queryOne('SELECT MAX(version) as version FROM schema_migrations')?.version || 0;
  const required = migrations.at(-1)?.version || 0;
  if (current < required) {
    throw new Error(`Database schema version ${current} is behind required version ${required}. Back up and run \`npm run migrate\` explicitly.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(`Migration target database: ${databasePath}`);
    if (process.env.CHANG_MATERIAL_MIGRATION_CONFIRM !== 'YES'
      || process.env.CHANG_MATERIAL_MIGRATION_BACKUP_VERIFIED !== 'YES') {
      throw new Error('Migration refused. Verify a database backup, then set CHANG_MATERIAL_MIGRATION_CONFIRM=YES and CHANG_MATERIAL_MIGRATION_BACKUP_VERIFIED=YES.');
    }
    runMigrations();
    console.log('Additive migrations applied successfully.');
  } finally {
    db.close();
  }
}
