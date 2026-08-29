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
    getTurtleMode: vi.fn(),
    setTurtleMode: vi.fn(),
    getTorrentFiles: vi.fn(),
    setTorrentFilesWanted: vi.fn(),
    moveTorrentQueue: vi.fn(),
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
  const mockedStartDownload = vi.mocked(transmissionModule.startDownload);
  const mockedGetTurtleMode = vi.mocked(transmissionModule.getTurtleMode);
  const mockedSetTurtleMode = vi.mocked(transmissionModule.setTurtleMode);
  const mockedGetTorrentFiles = vi.mocked(transmissionModule.getTorrentFiles);
  const mockedSetTorrentFilesWanted = vi.mocked(transmissionModule.setTorrentFilesWanted);
  const mockedMoveTorrentQueue = vi.mocked(transmissionModule.moveTorrentQueue);

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
    expect(res.body.hasPassword).toBe(true);
  });

  it('should preserve existing password when authRequired is true and password is empty or placeholder', async () => {
    const { user } = createUser('transUserPreserve');
    const cookie = createSessionCookie(user.id);
    mockedGetSettings.mockReturnValueOnce({
      host: 'http://transmission.local',
      port: 9091,
      authRequired: true,
      username: 'admin',
      password: 'existingSecretPassword',
      moviesFolder: '/movies',
      seriesFolder: '/series',
    } as any);
    mockedConfigure.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/transmission/configure')
      .set('Cookie', cookie)
      .send({
        host: 'http://transmission.local',
        port: 9091,
        authRequired: true,
        username: 'admin',
        password: '',
        moviesFolder: '/new-movies',
        seriesFolder: '/new-series',
      });

    expect(res.status).toBe(200);
    expect(mockedConfigure).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({
        password: 'existingSecretPassword',
        moviesFolder: '/new-movies',
      }),
    );
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

  it('should get turtle mode via GET /api/transmission/turtle', async () => {
    const { user } = createUser('transTurtleUser');
    const cookie = createSessionCookie(user.id);
    mockedGetTurtleMode.mockResolvedValueOnce({
      altSpeedEnabled: true,
      altSpeedDown: 50,
      altSpeedUp: 10,
      speedLimitDownEnabled: false,
      speedLimitDown: 0,
      speedLimitUpEnabled: false,
      speedLimitUp: 0,
    });

    const res = await request(app).get('/api/transmission/turtle').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.altSpeedEnabled).toBe(true);
    expect(mockedGetTurtleMode).toHaveBeenCalledWith(user.id);
  });

  it('should set turtle mode via POST /api/transmission/turtle', async () => {
    const { user } = createUser('transTurtleUser2');
    const cookie = createSessionCookie(user.id);
    mockedSetTurtleMode.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/transmission/turtle')
      .set('Cookie', cookie)
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.altSpeedEnabled).toBe(true);
    expect(mockedSetTurtleMode).toHaveBeenCalledWith(user.id, true);
  });

  it('should get torrent files via GET /api/transmission/torrent/:id/files', async () => {
    const { user } = createUser('transFilesUser');
    const cookie = createSessionCookie(user.id);
    mockedGetTorrentFiles.mockResolvedValueOnce([
      {
        index: 0,
        name: 'video.mkv',
        bytesCompleted: 100,
        length: 200,
        wanted: true,
        priority: 0,
      },
    ]);

    const res = await request(app)
      .get('/api/transmission/torrent/42/files')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(mockedGetTorrentFiles).toHaveBeenCalledWith(user.id, 42);
  });

  it('should set torrent files wanted/unwanted via POST /api/transmission/torrent/:id/files', async () => {
    const { user } = createUser('transFilesUser2');
    const cookie = createSessionCookie(user.id);
    mockedSetTorrentFilesWanted.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/transmission/torrent/42/files')
      .set('Cookie', cookie)
      .send({ wanted: [0, 1], unwanted: [2] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockedSetTorrentFilesWanted).toHaveBeenCalledWith(user.id, 42, [0, 1], [2]);
  });

  it('should move torrent queue via POST /api/transmission/torrent/:id/queue', async () => {
    const { user } = createUser('transQueueUser');
    const cookie = createSessionCookie(user.id);
    mockedMoveTorrentQueue.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/transmission/torrent/42/queue')
      .set('Cookie', cookie)
      .send({ action: 'top' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockedMoveTorrentQueue).toHaveBeenCalledWith(user.id, 42, 'top');
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

  it('should add torrent with tmdb and season/episode options via POST /api/transmission/add', async () => {
    const { user } = createUser('transAddUser');
    const cookie = createSessionCookie(user.id);
    mockedStartDownload.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/transmission/add')
      .set('Cookie', cookie)
      .send({
        mediaType: 'series',
        guid: 'guid-s01e01',
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(mockedStartDownload).toHaveBeenCalledWith(user.id, 'guid-s01e01', 'series', {
      tmdbId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
    });
  });
});

