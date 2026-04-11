import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataDir } from "./config.js";

const databaseFilePath = path.join(dataDir, "seedflix.db");
let db;
let selectStmt;
let upsertStmt;
let listNamespacesStmt;

function getDb() {
  if (db) {
    return db;
  }

  mkdirSync(dataDir, { recursive: true });
  db = new DatabaseSync(databaseFilePath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      namespace TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  selectStmt = db.prepare("SELECT value FROM kv_store WHERE namespace = ?");
  listNamespacesStmt = db.prepare(`
    SELECT namespace, updated_at
    FROM kv_store
    ORDER BY namespace ASC
  `);
  upsertStmt = db.prepare(`
    INSERT INTO kv_store(namespace, value, updated_at)
    VALUES(?, ?, datetime('now'))
    ON CONFLICT(namespace)
    DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  return db;
}

function parseJson(rawValue, fallback) {
  try {
    const parsed = JSON.parse(rawValue);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function initializeDatabase() {
  getDb();
}

export function readJsonStore(namespace, fallback) {
  getDb();
  const row = selectStmt.get(String(namespace || ""));

  if (!row || typeof row.value !== "string") {
    writeJsonStore(namespace, fallback);
    return structuredClone(fallback);
  }

  return parseJson(row.value, structuredClone(fallback));
}

export function writeJsonStore(namespace, value) {
  getDb();
  upsertStmt.run(String(namespace || ""), JSON.stringify(value));
}

export function listJsonStores() {
  getDb();
  return listNamespacesStmt.all().map((row) => ({
    namespace: String(row.namespace || ""),
    updatedAt: String(row.updated_at || ""),
  }));
}

export function readRawJsonStore(namespace) {
  getDb();
  const safeNamespace = String(namespace || "");
  const row = db
    .prepare("SELECT namespace, value, updated_at FROM kv_store WHERE namespace = ?")
    .get(safeNamespace);

  if (!row || typeof row.value !== "string") {
    return null;
  }

  return {
    namespace: String(row.namespace || safeNamespace),
    value: row.value,
    updatedAt: String(row.updated_at || ""),
  };
}

export function writeRawJsonStore(namespace, rawValue) {
  JSON.parse(String(rawValue || ""));
  getDb();
  upsertStmt.run(String(namespace || ""), String(rawValue || ""));
  return readRawJsonStore(namespace);
}

export function runInTransaction(callback) {
  const database = getDb();
  database.exec("BEGIN IMMEDIATE");
  try {
    const txApi = {
      readJson(namespace, fallback) {
        const row = selectStmt.get(String(namespace || ""));
        if (!row || typeof row.value !== "string") {
          return structuredClone(fallback);
        }
        return parseJson(row.value, structuredClone(fallback));
      },
      writeJson(namespace, value) {
        upsertStmt.run(String(namespace || ""), JSON.stringify(value));
      },
    };

    const result = callback(txApi);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Ignore rollback failure and rethrow original error.
    }
    throw error;
  }
}

export function mutateJsonStore(namespace, fallback, mutator) {
  return runInTransaction((tx) => {
    const current = tx.readJson(namespace, fallback);
    const nextValue = mutator(structuredClone(current));
    const safeNextValue = nextValue === undefined ? current : nextValue;
    tx.writeJson(namespace, safeNextValue);
    return safeNextValue;
  });
}
