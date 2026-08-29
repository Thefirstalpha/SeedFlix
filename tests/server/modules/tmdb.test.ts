import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import * as tmdbModule from '../../../server/modules/tmdb';
import {
  buildCollectionRequest,
  buildDetailsRequest,
  buildGenresRequest,
  buildPersonRequest,
  buildPopularRequest,
  buildRecommendationsRequest,
  buildSearchRequest,
  buildSeasonRequest,
  buildVideosRequest,
  configureTmdbApiKey,
  getTmdbDetails,
  proxyTmdb,
  transformTmdbDetails,
  TmdbType,
} from '../../../server/modules/tmdb';
import { readGlobalConfig, updateGlobalConfig } from '../../../server/modules/setting';

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

    it('should build search requests for movie, series, and multi', () => {
      const searchMovie = buildSearchRequest(TmdbType.movie, { query: 'Inception', page: 2 });
      expect(searchMovie.path).toBe('/search/movie');
      expect(searchMovie.query.query).toBe('Inception');
      expect(searchMovie.query.page).toBe(2);

      const searchSeries = buildSearchRequest(TmdbType.series, { query: 'Breaking Bad' });
      expect(searchSeries.path).toBe('/search/tv');
      expect(searchSeries.query.query).toBe('Breaking Bad');

      const searchMulti = buildSearchRequest('multi', { query: 'Batman', page: 1, language: 'fr-FR' });
      expect(searchMulti.path).toBe('/search/multi');
      expect(searchMulti.query.query).toBe('Batman');
      expect(searchMulti.query.language).toBe('fr-FR');
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

    it('should build recommendations request', () => {
      const { buildRecommendationsRequest } = tmdbModule;
      const recMovie = buildRecommendationsRequest(TmdbType.movie, 550, { page: 2, language: 'en-US' });
      expect(recMovie.path).toBe('/movie/550/recommendations');
      expect(recMovie.query.page).toBe(2);
      expect(recMovie.query.language).toBe('en-US');

      const recDefault = buildRecommendationsRequest(TmdbType.series, 1399, {});
      expect(recDefault.path).toBe('/tv/1399/recommendations');
      expect(recDefault.query.page).toBe(1);
      expect(recDefault.query.language).toBe('fr-FR');
    });

    it('should build collection and person requests', () => {
      const { buildCollectionRequest, buildPersonRequest } = tmdbModule;
      const colReq = buildCollectionRequest(10, { language: 'fr-FR' });
      expect(colReq.path).toBe('/collection/10');
      expect(colReq.query.language).toBe('fr-FR');

      const personReq = buildPersonRequest(287, {});
      expect(personReq.path).toBe('/person/287');
      expect(personReq.query.language).toBe('fr-FR');
      expect(personReq.query.append_to_response).toBe('combined_credits');
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
      expect(readGlobalConfig().tmdbApiKey).toBe('valid-api-key-123');
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

    it('should get and normalize TMDB details with getTmdbDetails', async () => {
      updateGlobalConfig({ tmdbApiKey: 'mock-key' });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 550,
          title: 'Fight Club',
          original_title: 'Fight Club',
          overview: 'An insomniac office worker...',
          release_date: '1999-10-15',
          vote_average: 8.433,
          vote_count: 26000,
          genres: [{ id: 18, name: 'Drama' }, { id: 53, name: 'Thriller' }],
          poster_path: '/poster.jpg',
          backdrop_path: '/backdrop.jpg',
          runtime: 139,
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const details = await getTmdbDetails(550, 'movie');
      expect(details.id).toBe(550);
      expect(details.type).toBe('movie');
      expect(details.title).toBe('Fight Club');
      expect(details.year).toBe(1999);
      expect(details.rating).toBe(8.4);
      expect(details.genres).toEqual(['Drama', 'Thriller']);
      expect(details.runtime).toBe(139);
      expect(details.posterPath).toBe('/poster.jpg');
    });

    it('should get and normalize series TMDB details with getTmdbDetails', async () => {
      updateGlobalConfig({ tmdbApiKey: 'mock-key' });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1399,
          name: 'Game of Thrones',
          original_name: 'Game of Thrones',
          overview: 'Seven noble families fight for control...',
          first_air_date: '2011-04-17',
          vote_average: 8.4,
          vote_count: 21000,
          genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
          poster_path: '/got.jpg',
          backdrop_path: '/got-bg.jpg',
          original_language: 'en',
          number_of_seasons: 8,
          number_of_episodes: 73,
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const details = await getTmdbDetails(1399, 'series', 'en-US');
      expect(details.id).toBe(1399);
      expect(details.type).toBe('series');
      expect(details.title).toBe('Game of Thrones');
      expect(details.year).toBe(2011);
      expect(details.numberOfSeasons).toBe(8);
      expect(details.numberOfEpisodes).toBe(73);
      expect(details.originalLanguage).toBe('en');
    });

    it('should handle missing dates, genres and ratings gracefully in transformTmdbDetails', () => {
      const { transformTmdbDetails } = tmdbModule;
      const normalized = transformTmdbDetails(
        {
          id: 100,
          title: 'Movie Without Meta',
          genres: null,
          vote_average: 'invalid',
        },
        'movie',
      );

      expect(normalized.year).toBe(0);
      expect(normalized.rating).toBe(0);
      expect(normalized.genres).toEqual([]);
      expect(normalized.posterPath).toBeNull();
      expect(normalized.backdropPath).toBeNull();
    });

    it('should throw error when getTmdbDetails receives item without id', async () => {
      updateGlobalConfig({ tmdbApiKey: 'mock-key' });

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(getTmdbDetails(999999, 'movie')).rejects.toThrow('Item not found in TMDB');
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
