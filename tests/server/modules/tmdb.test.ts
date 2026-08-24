import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import {
  buildDetailsRequest,
  buildGenresRequest,
  buildPopularRequest,
  buildSeasonRequest,
  buildVideosRequest,
  configureTmdbApiKey,
  proxyTmdb,
  TmdbType,
} from '../../../server/modules/tmdb';
import { updateGlobalConfig } from '../../../server/modules/setting';

describe('tmdb module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  describe('Request Builders', () => {
    it('should build details request for movie and series', () => {
      const movieReq = buildDetailsRequest(TmdbType.movie, 550, { language: 'fr-FR' });
      expect(movieReq.path).toBe('/movie/550');
      expect(movieReq.query.language).toBe('fr-FR');
      expect(movieReq.query.append_to_response).toContain('credits');

      const tvReq = buildDetailsRequest(TmdbType.series, 1399, {});
      expect(tvReq.path).toBe('/tv/1399');
    });

    it('should build genres and videos requests', () => {
      const genresReq = buildGenresRequest(TmdbType.movie, { language: 'fr-FR' });
      expect(genresReq.path).toBe('/genre/movie/list');

      const videosReq = buildVideosRequest(TmdbType.movie, 550);
      expect(videosReq.path).toBe('/movie/550/videos');
    });

    it('should build season request', () => {
      const seasonReq = buildSeasonRequest(1399, 2, { language: 'en-US' });
      expect(seasonReq.path).toBe('/tv/1399/season/2');
      expect(seasonReq.query.language).toBe('en-US');
    });

    it('should route popular vs discover depending on active filters in buildPopularRequest', () => {
      const popularReq = buildPopularRequest(TmdbType.movie, {
        language: 'fr-FR',
        page: 1,
      });
      expect(popularReq.path).toBe('/movie/popular');

      const discoverReq = buildPopularRequest(TmdbType.movie, {
        with_genres: 28,
        language: 'fr-FR',
      });
      expect(discoverReq.path).toBe('/discover/movie');
      expect(discoverReq.query.with_genres).toBe(28);
    });
  });

  describe('API Key Configuration & Proxying', () => {
    it('should configure TMDB API key after successful authentication check', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await configureTmdbApiKey('valid-api-key-123');
    });

    it('should proxy request to TMDB API via fetch with Bearer token', async () => {
      updateGlobalConfig({ tmdbApiKey: 'mock-key' });

      const mockResponse = { id: 550, title: 'Fight Club' };
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const result = await proxyTmdb('/movie/550', { language: 'en-US' });

      expect(fetchSpy).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when TMDB returns non-OK status', async () => {
      updateGlobalConfig({ tmdbApiKey: 'mock-key' });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(proxyTmdb('/movie/9999999', {})).rejects.toThrow();
    });
  });
});

