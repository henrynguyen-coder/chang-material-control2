import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured.');
}

export const databasePath = 'PostgreSQL DATABASE_URL';
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

function convertPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function queryAll(sql, params = []) {
  const result = await pool.query(convertPlaceholders(sql), params);
  return result.rows;
}

export async function queryOne(sql, params = []) {
  const result = await pool.query(convertPlaceholders(sql), params);
  return result.rows[0] || null;
}

export async function executeSql(sql, params = []) {
  return pool.query(convertPlaceholders(sql), params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  const transaction = {
    query: (sql, params = []) => client.query(convertPlaceholders(sql), params),
    queryAll: async (sql, params = []) => (await client.query(convertPlaceholders(sql), params)).rows,
    queryOne: async (sql, params = []) => (await client.query(convertPlaceholders(sql), params)).rows[0] || null,
    executeSql: (sql, params = []) => client.query(convertPlaceholders(sql), params),
  };

  try {
    await client.query('BEGIN');
    const result = await callback(transaction);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function initDbSchema() {
  const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

export async function closeDb() {
  await pool.end();
}
