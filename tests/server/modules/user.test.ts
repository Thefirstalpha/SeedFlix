import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
import {
  createUser,
  deleteUser,
  getUser,
  updateUser,
} from '../../../server/modules/user';

describe('user module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should create a new user with default settings', () => {
    const { user, password } = createUser('alice', 'alice123');

    expect(user.id).toBeDefined();
    expect(user.username).toBe('alice');
    expect(password).toBe('alice123');
    expect(user.settings).toBeDefined();
    expect(user.notifications).toBeDefined();
  });

  it('should retrieve existing user by id', () => {
    const { user: created } = createUser('bob');
    const retrieved = getUser(created.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.username).toBe('bob');
  });

  it('should update user profile and settings', () => {
    const { user: created } = createUser('charlie');
    created.settings.language = 'fr';
    created.settings.spoilerMode = true;

    updateUser(created);

    const updated = getUser(created.id);
    expect(updated?.settings.language).toBe('fr');
    expect(updated?.settings.spoilerMode).toBe(true);
  });

  it('should encrypt sensitive settings (token and passwords) in kv_store at rest', () => {
    const { user: created } = createUser('dave');
    created.settings.indexer = {
      url: 'https://indexer.example.com',
      token: 'secret-indexer-token-999',
      qualities: ['2160p'],
      languages: ['VFF'],
      autoDownload: true,
    };
    created.settings.transmission = {
      host: 'http://localhost',
      port: 9091,
      authRequired: true,
      username: 'admin',
      password: 'secret-transmission-password-888',
      moviesFolder: '/movies',
      seriesFolder: '/series',
    };
    created.settings.ftp = {
      host: 'ftp.example.com',
      port: 21,
      secure: false,
      authRequired: true,
      username: 'ftpuser',
      password: 'secret-ftp-password-777',
      rootFolder: '/',
      storageLimit: null,
    };

    updateUser(created);

    // Verify raw SQLite row in kv_store contains encrypted string (starts with enc:v1:) and NOT plaintext
    const rawRow = db
      .prepare('SELECT value FROM kv_store WHERE namespace = ? AND user_id = ?')
      .get('user', created.id) as any;
    const rawData = JSON.parse(rawRow.value);

    expect(rawData.settings.indexer.token).toMatch(/^enc:v1:/);
    expect(rawData.settings.indexer.token).not.toContain('secret-indexer-token-999');

    expect(rawData.settings.transmission.password).toMatch(/^enc:v1:/);
    expect(rawData.settings.transmission.password).not.toContain('secret-transmission-password-888');

    expect(rawData.settings.ftp.password).toMatch(/^enc:v1:/);
    expect(rawData.settings.ftp.password).not.toContain('secret-ftp-password-777');

    // Verify getUser decrypts them seamlessly
    const loaded = getUser(created.id);
    expect(loaded?.settings.indexer?.token).toBe('secret-indexer-token-999');
    expect(loaded?.settings.transmission?.password).toBe('secret-transmission-password-888');
    expect(loaded?.settings.ftp?.password).toBe('secret-ftp-password-777');
  });

  it('should delete a user and remove associated auth and settings', () => {
    const { user: created } = createUser('eve');
    deleteUser(created.id);

    expect(getUser(created.id)).toBeNull();
    const auth = db
      .prepare('SELECT user_id FROM auth_users WHERE user_id = ?')
      .get(created.id);
    expect(auth).toBeUndefined();
  });
});

