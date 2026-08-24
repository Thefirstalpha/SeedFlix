import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
import {
  authentication,
  createAuth,
  getUsers,
  hashPassword,
  resetAuth,
  resetPassword,
  withAdmin,
} from '../../../server/modules/auth';
import { createUser, getUser } from '../../../server/modules/user';
import { scryptSync } from 'node:crypto';

describe('auth module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  function mockReqRes(cookies: Record<string, string> = {}) {
    const req: any = {
      cookies,
      user: undefined,
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();
    return { req, res, next };
  }

  describe('Password Hashing & Credentials', () => {
    it('should hash password with scrypt and unique salt', () => {
      const { hash, salt } = hashPassword('MySecretPass123!');
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      const verifyHash = scryptSync('MySecretPass123!', salt, 64).toString('hex');
      expect(verifyHash).toBe(hash);
    });

    it('should create auth record and return generated ID and password', () => {
      const { id, password } = createAuth('testUserAuth', 'testPass');
      expect(id).toBeDefined();
      expect(password).toBe('testPass');

      const userRow = db.prepare('SELECT * FROM auth_users WHERE user_id = ?').get(id) as any;
      expect(userRow.username).toBe('testUserAuth');
    });

    it('should throw error when creating auth with duplicate username', () => {
      createAuth('duplicateUser', 'pass1');
      expect(() => createAuth('duplicateUser', 'pass2')).toThrow();
    });

    it('should reset password for user', () => {
      const { user } = createUser('testerReset');
      resetPassword(user.id, 'NewPassword123');

      const userRow = db.prepare('SELECT * FROM auth_users WHERE user_id = ?').get(user.id) as any;
      const computedHash = scryptSync('NewPassword123', userRow.salt, 64).toString('hex');
      expect(computedHash).toBe(userRow.hash);
    });

    it('should reset auth for user and set mustUpdatePassword flag', () => {
      const { user } = createUser('userResetAuth');
      const newPassword = resetAuth(user.id);
      expect(newPassword).toBeDefined();

      const updated = getUser(user.id);
      expect(updated?.flags.mustUpdatePassword).toBe(true);
    });
  });

  describe('User Listing', () => {
    it('should list all registered users with their IDs and usernames', () => {
      createUser('userA');
      createUser('userB');

      const users = getUsers();
      const usernames = users.map((u) => u.username);
      expect(usernames).toContain('admin');
      expect(usernames).toContain('userA');
      expect(usernames).toContain('userB');
    });
  });

  describe('Authentication Middleware', () => {
    it('should reject request without session cookie', () => {
      const { req, res, next } = mockReqRes({});

      authentication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid session token', () => {
      const { req, res, next } = mockReqRes({ session: 'invalid-token-xyz' });

      authentication(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach user to req and call next when session is valid', () => {
      const { user: testUser } = createUser('validSessionUser', 'password');
      db.prepare(
        "INSERT INTO auth_sessions (id, user_id, token, created_at) VALUES (?, ?, ?, datetime('now'))",
      ).run('session-valid', testUser.id, 'valid-token-123');

      const { req, res, next } = mockReqRes({ session: 'valid-token-123' });

      authentication(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
      expect(req.user.username).toBe('validSessionUser');
    });
  });

  describe('withAdmin Middleware', () => {
    it('should allow admin user (id = 1)', () => {
      const req: any = { user: { id: 1, username: 'admin' } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      withAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject non-admin user with 403', () => {
      const req: any = { user: { id: 2, username: 'normal_user' } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      withAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

