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

