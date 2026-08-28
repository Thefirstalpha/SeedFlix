import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import * as tmdbModule from '../../../server/modules/tmdb';
import { router as tmdbRouter } from '../../../server/routes/tmdb';
import { updateGlobalConfig } from '../../../server/modules/setting';
import { createSessionCookie, createTestApp } from './testApp';

vi.mock('../../../server/modules/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof tmdbModule>();
  return {
    ...actual,
    proxyTmdb: vi.fn(),
    configureTmdbApiKey: vi.fn(),
  };
});

describe('Route: /api/tmdb', () => {
  const app = createTestApp(tmdbRouter);
  const mockedProxyTmdb = vi.mocked(tmdbModule.proxyTmdb);
  const mockedConfigureApiKey = vi.mocked(tmdbModule.configureTmdbApiKey);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  describe('TMDB Configuration', () => {
    it('should check if TMDB API key is configured', async () => {
      const adminCookie = createSessionCookie(1);

      const res = await request(app).get('/api/tmdb/configure').set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(false);

      updateGlobalConfig({ tmdbApiKey: 'configured-key' });
      const resConfigured = await request(app)
        .get('/api/tmdb/configure')
        .set('Cookie', adminCookie);
      expect(resConfigured.body.ok).toBe(true);
    });

    it('should configure TMDB API key', async () => {
      mockedConfigureApiKey.mockResolvedValueOnce(undefined);
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post('/api/tmdb/configure')
        .set('Cookie', adminCookie)
        .send({ apiKey: 'new-key-123' });

      expect(res.status).toBe(200);
      expect(mockedConfigureApiKey).toHaveBeenCalledWith('new-key-123');
    });
  });

  describe('TMDB Proxied Endpoints', () => {
    it('should fetch popular movies via /api/tmdb/movie/popular', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ page: 1, results: [{ id: 1, title: 'Movie 1' }] });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/movie/popular')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
    });

    it('should search movies via /api/tmdb/movie/search', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ page: 1, results: [{ id: 2, title: 'Search Movie' }] });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/movie/search?query=Search')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.results[0].title).toBe('Search Movie');
    });

    it('should search multi via /api/tmdb/multi/search', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({
        page: 1,
        results: [
          { id: 1, media_type: 'movie', title: 'Batman Movie' },
          { id: 2, media_type: 'tv', name: 'Batman Series' },
        ],
      });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/multi/search?query=Batman')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].title).toBe('Batman Movie');
      expect(res.body.results[1].name).toBe('Batman Series');
    });

    it('should fetch genres via /api/tmdb/movie/genres', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ genres: [{ id: 28, name: 'Action' }] });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/movie/genres')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.genres[0].name).toBe('Action');
    });

    it('should fetch movie details via /api/tmdb/movie/details/:id', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ id: 550, title: 'Fight Club' });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/movie/details/550')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Fight Club');
    });

    it('should fetch videos via /api/tmdb/movie/videos/:id', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ id: 550, results: [{ key: 'trailerKey' }] });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/movie/videos/550')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.results[0].key).toBe('trailerKey');
    });

    it('should fetch season details via /api/tmdb/series/details/:id/seasons/:seasonNumber', async () => {
      mockedProxyTmdb.mockResolvedValueOnce({ id: 1399, season_number: 1, episodes: [] });
      const userCookie = createSessionCookie(1);

      const res = await request(app)
        .get('/api/tmdb/series/details/1399/seasons/1')
        .set('Cookie', userCookie);

      expect(res.status).toBe(200);
      expect(res.body.season_number).toBe(1);
    });
  });
});

