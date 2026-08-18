import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config";
import { createUser, getUser } from "./user";

mkdirSync(config.dataDir, { recursive: true });
export let db: DatabaseSync;

export const initDB = () => {
  db = new DatabaseSync(config.databasePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(`CREATE TABLE IF NOT EXISTS kv_store (
    namespace TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(namespace, user_id)
)
`);
  db.exec(`CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)`);
  db.exec(`
CREATE TABLE IF NOT EXISTS auth_users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
)
`);
  const adminUser = getUser(1);
  if (!adminUser) {
    const { password } = createUser('admin', 'admin');
    console.info(`Admin user created with password: ${password}`);
  }

};


export const readStore = (namespace: string, userId: number): Record<string, any> | null => {
  const row = db.prepare('SELECT value FROM kv_store WHERE namespace = ? AND user_id = ?').get(namespace, userId);
  return row ? JSON.parse(String(row.value)) : null;
}
export const readStores = (namespace: string): Record<string, any>[] => {
  const rows = db.prepare('SELECT value FROM kv_store WHERE namespace = ?').all(namespace);
  return rows.map((row: any) => JSON.parse(String(row.value)));
}

export const writeStore = (namespace: string, userId: number, value: Record<string, any>) => {
  db.prepare(`
    INSERT INTO kv_store(namespace, user_id, value, updated_at)
    VALUES(?, ?, ?, datetime('now'))
    ON CONFLICT(namespace, user_id)
    DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(namespace, userId, JSON.stringify(value));
}


export function runInTransaction(callback: (db: { writeStore: typeof writeStore }) => any) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback({
      writeStore: writeStore
    });
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback failure and rethrow original error.
    }
    throw error;
  }
}

export function listNamespaces(): { namespace: string, updated_at: string }[] {
  const rows = db.prepare('SELECT DISTINCT namespace, updated_at FROM kv_store').all();
  return rows.map((row: any) => ({ namespace: row.namespace, updated_at: row.updated_at }));
}

export function resetDatabase() {
  db.exec('DELETE FROM kv_store');
  db.exec('DELETE FROM auth_sessions');
  db.exec('DELETE FROM auth_users');
  const { password } = createUser('admin', 'admin');
  console.info(`Admin user created with password: ${password}`);
}