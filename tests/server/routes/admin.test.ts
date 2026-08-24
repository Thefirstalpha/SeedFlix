import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import { router as adminRouter } from '../../../server/routes/admin';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/admin', () => {
  const app = createTestApp(adminRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app).get('/api/admin/logs');
    expect(res.status).toBe(401);
  });

  it('should return 403 when authenticated as non-admin user', async () => {
    const { user } = createUser('normalUser');
    const cookie = createSessionCookie(user.id);

    const res = await request(app).get('/api/admin/logs').set('Cookie', cookie);
    expect(res.status).toBe(403);
  });

  it('should return logs for admin user (id = 1)', async () => {
    const adminCookie = createSessionCookie(1);

    const res = await request(app).get('/api/admin/logs').set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.logs).toBeDefined();
    expect(Array.isArray(res.body.logs)).toBe(true);
  });
});

