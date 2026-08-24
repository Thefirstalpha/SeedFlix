import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
import { router as userRouter } from '../../../server/routes/user';
import { createUser, getUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/user & /api/users', () => {
  const app = createTestApp(userRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  describe('POST /api/user/accept-legal', () => {
    it('should set legalAccepted flag', async () => {
      const { user } = createUser('user1');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).post('/api/user/accept-legal').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(getUser(user.id)?.flags.legalAccepted).toBe(true);
    });
  });

  describe('Admin Users Management', () => {
    it('should return 403 when non-admin accesses /api/users', async () => {
      const { user } = createUser('regularUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).get('/api/users').set('Cookie', cookie);
      expect(res.status).toBe(403);
    });

    it('should return list of users for admin', async () => {
      createUser('u1');
      createUser('u2');
      const adminCookie = createSessionCookie(1);

      const res = await request(app).get('/api/users').set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const usernames = res.body.map((u: any) => u.username);
      expect(usernames).toContain('u1');
      expect(usernames).toContain('u2');
    });

    it('should create new user via POST /api/users', async () => {
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post('/api/users')
        .set('Cookie', adminCookie)
        .send({ username: 'newUser' });

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('newUser');
      expect(res.body.password).toBeDefined();
    });

    it('should return 400 when creating user with empty username', async () => {
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post('/api/users')
        .set('Cookie', adminCookie)
        .send({ username: '   ' });

      expect(res.status).toBe(400);
    });

    it('should delete user via DELETE /api/users/:id', async () => {
      const { user } = createUser('toDelete');
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .delete(`/api/users/${user.id}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(getUser(user.id)).toBeNull();
    });

    it('should reject password reset for admin user (id = 1)', async () => {
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post('/api/users/1/reset-password')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(400);
    });

    it('should reset password for regular user', async () => {
      const { user } = createUser('userToReset');
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post(`/api/users/${user.id}/reset-password`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.password).toBeDefined();
    });
  });

  describe('GET /api/user (Status Bar)', () => {
    it('should return user status bar metrics', async () => {
      const { user } = createUser('statusUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).get('/api/user').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.downloads).toBeDefined();
      expect(res.body.wishlist).toBeDefined();
      expect(res.body.notifications).toBeDefined();
    });
  });
});

