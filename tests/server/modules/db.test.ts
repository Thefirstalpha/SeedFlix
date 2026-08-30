import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  db,
  initDB,
  listNamespaces,
  readStore,
  readStores,
  resetDatabase,
  runInTransaction,
  writeStore,
} from '../../../server/modules/db';

describe('db module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should write and read values from KV store', () => {
    writeStore('test-namespace', 1, { foo: 'bar', count: 42 });
    const result = readStore('test-namespace', 1);
    expect(result).toEqual({ foo: 'bar', count: 42 });
  });

  it('should return null when reading non-existing key', () => {
    const result = readStore('non-existing-namespace', 999);
    expect(result).toBeNull();
  });

  it('should execute operations atomically in runInTransaction', () => {
    runInTransaction(({ writeStore }) => {
      writeStore('tx-test', 1, { step: 1 });
      writeStore('tx-test', 2, { step: 2 });
    });

    expect(readStore('tx-test', 1)).toEqual({ step: 1 });
    expect(readStore('tx-test', 2)).toEqual({ step: 2 });
  });

  it('should rollback transaction on thrown error', () => {
    expect(() => {
      runInTransaction(({ writeStore }) => {
        writeStore('rollback-test', 1, { status: 'should-rollback' });
        throw new Error('Transaction failed intentional');
      });
    }).toThrow('Transaction failed intentional');

    expect(readStore('rollback-test', 1)).toBeNull();
  });

  it('should list distinct namespaces', () => {
    writeStore('ns1', 1, { a: 1 });
    writeStore('ns2', 1, { b: 2 });

    const namespaces = listNamespaces();
    const names = namespaces.map((n) => n.namespace);
    expect(names).toContain('ns1');
    expect(names).toContain('ns2');
  });

  it('should read multiple stores by namespace via readStores', () => {
    writeStore('multi-store-ns', 1, { user: 1 });
    writeStore('multi-store-ns', 2, { user: 2 });

    const allInNs = readStores('multi-store-ns');
    expect(allInNs).toHaveLength(2);
    expect(allInNs).toEqual(expect.arrayContaining([{ user: 1 }, { user: 2 }]));
  });

  it('should reset database and create default admin user', () => {
    writeStore('dummy', 1, { data: 'test' });
    resetDatabase();

    expect(readStore('dummy', 1)).toBeNull();
    const user = db.prepare('SELECT username FROM auth_users WHERE username = ?').get('admin') as any;
    expect(user?.username).toBe('admin');
  });

  it('should initialize DB tables and ensure admin user in initDB', () => {
    db.prepare("DELETE FROM auth_users WHERE username = 'admin'").run();
    db.prepare("DELETE FROM kv_store WHERE namespace = 'user' AND user_id = 1").run();
    initDB();

    const user = db.prepare('SELECT username FROM auth_users WHERE username = ?').get('admin') as any;
    expect(user?.username).toBe('admin');
  });
});

