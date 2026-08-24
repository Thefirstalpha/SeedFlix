import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import * as transmissionModule from '../../../server/modules/transmission';
import { router as transmissionRouter } from '../../../server/routes/transmission';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

vi.mock('../../../server/modules/transmission', async (importOriginal) => {
  const actual = await importOriginal<typeof transmissionModule>();
  return {
    ...actual,
    configureTransmission: vi.fn(),
    getTransmissionSettings: vi.fn(),
    getDownloadsTransmission: vi.fn(),
    getTransmissionStats: vi.fn(),
    performTransmissionAction: vi.fn(),
    startDownload: vi.fn(),
    unmanageTorrentForUser: vi.fn(),
  };
});

describe('Route: /api/transmission', () => {
  const app = createTestApp(transmissionRouter);
  const mockedGetSettings = vi.mocked(transmissionModule.getTransmissionSettings);
  const mockedConfigure = vi.mocked(transmissionModule.configureTransmission);
  const mockedGetDownloads = vi.mocked(transmissionModule.getDownloadsTransmission);
  const mockedGetStats = vi.mocked(transmissionModule.getTransmissionStats);
  const mockedPerformAction = vi.mocked(transmissionModule.performTransmissionAction);
  const mockedUnmanage = vi.mocked(transmissionModule.unmanageTorrentForUser);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('should get transmission configuration without password', async () => {
    const { user } = createUser('transUser');
    const cookie = createSessionCookie(user.id);
    mockedGetSettings.mockReturnValueOnce({
      host: 'http://transmission.local',
      port: 9091,
      authRequired: true,
      username: 'admin',
      password: 'secretPassword',
      moviesFolder: '/movies',
      seriesFolder: '/series',
    } as any);

    const res = await request(app).get('/api/transmission/configure').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.host).toBe('http://transmission.local');
    expect(res.body.password).toBeUndefined();
  });

  it('should save transmission settings via POST /api/transmission/configure', async () => {
    const { user } = createUser('transUser2');
    const cookie = createSessionCookie(user.id);
    mockedConfigure.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/transmission/configure')
      .set('Cookie', cookie)
      .send({
        host: 'http://transmission.local',
        port: 9091,
        username: 'admin',
        password: 'pwd',
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('configured successfully');
  });

  it('should get downloads list via GET /api/transmission/downloads', async () => {
    const { user } = createUser('transUser3');
    const cookie = createSessionCookie(user.id);
    mockedGetDownloads.mockResolvedValueOnce([
      { id: 1, name: 'Movie 1', percentDone: 1 } as any,
    ]);

    const res = await request(app).get('/api/transmission/downloads').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.torrents).toHaveLength(1);
  });

  it('should get transmission stats via GET /api/transmission/stats', async () => {
    const { user } = createUser('transUser4');
    const cookie = createSessionCookie(user.id);
    mockedGetStats.mockResolvedValueOnce({
      activeTorrentCount: 2,
      downloadSpeed: 1000,
      uploadSpeed: 500,
      torrentCount: 3,
    } as any);

    const res = await request(app).get('/api/transmission/stats').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.activeTorrentCount).toBe(2);
  });

  it('should resume torrent via POST /api/transmission/resume/:id', async () => {
    const { user } = createUser('transUser5');
    const cookie = createSessionCookie(user.id);
    mockedPerformAction.mockResolvedValueOnce(undefined as any);

    const res = await request(app).post('/api/transmission/resume/1').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(mockedPerformAction).toHaveBeenCalledWith('torrent-start', user.id, 1);
  });

  it('should pause torrent via POST /api/transmission/pause/:id', async () => {
    const { user } = createUser('transUser6');
    const cookie = createSessionCookie(user.id);
    mockedPerformAction.mockResolvedValueOnce(undefined as any);

    const res = await request(app).post('/api/transmission/pause/1').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(mockedPerformAction).toHaveBeenCalledWith('torrent-stop', user.id, 1);
  });

  it('should delete torrent via POST /api/transmission/delete/:id', async () => {
    const { user } = createUser('transUser7');
    const cookie = createSessionCookie(user.id);
    mockedPerformAction.mockResolvedValueOnce(undefined as any);

    const res = await request(app)
      .post('/api/transmission/delete/1')
      .set('Cookie', cookie)
      .send({ deleteData: true });

    expect(res.status).toBe(200);
    expect(mockedPerformAction).toHaveBeenCalledWith('torrent-remove', user.id, 1, {
      'delete-local-data': true,
    });
  });

  it('should unmanage torrent via POST /api/transmission/unmanage', async () => {
    const { user } = createUser('transUser8');
    const cookie = createSessionCookie(user.id);
    mockedUnmanage.mockReturnValueOnce(true);

    const res = await request(app)
      .post('/api/transmission/unmanage')
      .set('Cookie', cookie)
      .send({ hash: 'abc-123' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

