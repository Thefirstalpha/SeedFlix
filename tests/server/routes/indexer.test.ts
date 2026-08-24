import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import * as indexerModule from '../../../server/modules/indexer';
import { router as indexerRouter } from '../../../server/routes/indexer';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

vi.mock('../../../server/modules/indexer', async (importOriginal) => {
  const actual = await importOriginal<typeof indexerModule>();
  return {
    ...actual,
    configureIndexer: vi.fn(),
    getIndexerSettings: vi.fn(),
    searchMovieIndexer: vi.fn(),
    searchSeriesIndexer: vi.fn(),
    getMoviesIndexerResult: vi.fn(),
    getSeriesIndexerResult: vi.fn(),
    rejectIndexerResultByGuid: vi.fn(),
    rejectAllIndexerResultsByGuids: vi.fn(),
  };
});

describe('Route: /api/indexer', () => {
  const app = createTestApp(indexerRouter);
  const mockedGetSettings = vi.mocked(indexerModule.getIndexerSettings);
  const mockedConfigure = vi.mocked(indexerModule.configureIndexer);
  const mockedSearchMovie = vi.mocked(indexerModule.searchMovieIndexer);
  const mockedSearchSeries = vi.mocked(indexerModule.searchSeriesIndexer);
  const mockedGetMoviesResult = vi.mocked(indexerModule.getMoviesIndexerResult);
  const mockedGetSeriesResult = vi.mocked(indexerModule.getSeriesIndexerResult);
  const mockedReject = vi.mocked(indexerModule.rejectIndexerResultByGuid);
  const mockedRejectAll = vi.mocked(indexerModule.rejectAllIndexerResultsByGuids);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('should get indexer configuration without token', async () => {
    const { user } = createUser('indexerUser1');
    const cookie = createSessionCookie(user.id);
    mockedGetSettings.mockReturnValueOnce({
      url: 'https://indexer.example.com',
      token: 'secret-token',
      qualities: ['1080p'],
      languages: ['MULTI'],
    } as any);

    const res = await request(app).get('/api/indexer/configure').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://indexer.example.com');
    expect(res.body.token).toBeUndefined();
  });

  it('should configure indexer via POST /api/indexer/configure', async () => {
    const { user } = createUser('indexerUser2');
    const cookie = createSessionCookie(user.id);
    mockedConfigure.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/indexer/configure')
      .set('Cookie', cookie)
      .send({
        url: 'https://indexer.example.com',
        token: 'new-token',
        qualities: ['1080p'],
        languages: ['MULTI'],
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('configured successfully');
  });

  it('should search movie releases via GET /api/indexer/search/movies/:id', async () => {
    const { user } = createUser('indexerUser3');
    const cookie = createSessionCookie(user.id);
    mockedSearchMovie.mockResolvedValueOnce([{ title: 'Movie Release 1080p' } as any]);

    const res = await request(app)
      .get('/api/indexer/search/movies/550')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it('should search series releases via GET /api/indexer/search/series/:id', async () => {
    const { user } = createUser('indexerUser4');
    const cookie = createSessionCookie(user.id);
    mockedSearchSeries.mockResolvedValueOnce([{ title: 'Series S01E01 1080p' } as any]);

    const res = await request(app)
      .get('/api/indexer/search/series/1399?season=1')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it('should get cached results for movies and series', async () => {
    const { user } = createUser('indexerUser5');
    const cookie = createSessionCookie(user.id);
    mockedGetMoviesResult.mockResolvedValueOnce([{ title: 'Cached Movie' } as any]);
    mockedGetSeriesResult.mockResolvedValueOnce([{ title: 'Cached Series' } as any]);

    const resMovies = await request(app).get('/api/indexer/results/movies').set('Cookie', cookie);
    expect(resMovies.status).toBe(200);
    expect(resMovies.body.items).toHaveLength(1);

    const resSeries = await request(app).get('/api/indexer/results/series').set('Cookie', cookie);
    expect(resSeries.status).toBe(200);
    expect(resSeries.body.items).toHaveLength(1);
  });

  it('should reject indexer result via POST /api/indexer/results/reject', async () => {
    const { user } = createUser('indexerUser6');
    const cookie = createSessionCookie(user.id);
    mockedReject.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/indexer/results/reject')
      .set('Cookie', cookie)
      .send({ guid: 'guid-123' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should batch reject indexer results via POST /api/indexer/results/reject-all', async () => {
    const { user } = createUser('indexerUser7');
    const cookie = createSessionCookie(user.id);
    mockedRejectAll.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/indexer/results/reject-all')
      .set('Cookie', cookie)
      .send({ guids: ['g1', 'g2'] });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

