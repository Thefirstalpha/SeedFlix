import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
import { router as authRouter } from '../../../server/routes/auth';
import { createUser, getUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/auth', () => {
  const app = createTestApp(authRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return current user when authenticated', async () => {
      const { user } = createUser('alice');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('alice');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 when username or password is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({ username: 'alice' });
      expect(res.status).toBe(400);
    });

    it('should return 401 on invalid credentials', async () => {
      createUser('bob', 'secretPass123!');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'bob', password: 'wrongPassword' });
      expect(res.status).toBe(401);
    });

    it('should return 200 and set session cookie on valid login', async () => {
      createUser('charlie', 'Secret123!');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'charlie', password: 'Secret123!' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.user.username).toBe('charlie');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reject weak passwords with 400', async () => {
      const { user } = createUser('david', 'oldPass123!');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookie)
        .send({ password: 'short' });

      expect(res.status).toBe(400);
    });

    it('should accept strong password and clear mustUpdatePassword flag', async () => {
      const { user } = createUser('eve', 'oldPass123!');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .set('Cookie', cookie)
        .send({ password: 'StrongPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = getUser(user.id);
      expect(updated?.flags.mustUpdatePassword).toBe(false);
      expect(updated?.flags.initialPassword).toBe(false);
    });
  });

  describe('POST /api/auth/accept-legal', () => {
    it('should set legalAccepted flag to true', async () => {
      const { user } = createUser('frank');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).post('/api/auth/accept-legal').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const updated = getUser(user.id);
      expect(updated?.flags.legalAccepted).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should delete session from DB and clear session cookie', async () => {
      const { user } = createUser('grace');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logout successful');
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });
});

