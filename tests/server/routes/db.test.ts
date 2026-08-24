import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { initDB, readStore, resetDatabase, writeStore } from '../../../server/modules/db';
import { router as dbRouter } from '../../../server/routes/db';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/settings/database', () => {
  const app = createTestApp(dbRouter, '/api/settings/database');

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
  });

  it('should list database namespaces for admin', async () => {
    writeStore('ns1', 1, { a: 1 });
    const adminCookie = createSessionCookie(1);

    const res = await request(app)
      .get('/api/settings/database')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.namespaces).toBeDefined();
  });

  it('should read store entry by userId and namespace', async () => {
    writeStore('config_test', 1, { enabled: true });
    const adminCookie = createSessionCookie(1);

    const res = await request(app)
      .get('/api/settings/database/1/config_test')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
  });

  it('should return 404 when reading non-existing entry', async () => {
    const adminCookie = createSessionCookie(1);

    const res = await request(app)
      .get('/api/settings/database/1/non_existing')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
  });

  it('should update store entry by userId and namespace', async () => {
    const adminCookie = createSessionCookie(1);

    const res = await request(app)
      .put('/api/settings/database/1/test_ns')
      .set('Cookie', adminCookie)
      .send({ value: JSON.stringify({ updated: true, version: 2 }) });

    expect(res.status).toBe(200);
    expect(readStore('test_ns', 1)).toEqual({ updated: true, version: 2 });
  });
});

