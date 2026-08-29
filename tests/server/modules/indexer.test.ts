import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initDB, resetDatabase, writeStore } from '../../../server/modules/db';
import {
  configureIndexer,
  extractEpisodeNumber,
  extractLanguage,
  extractQuality,
  extractSeasonNumber,
  extractSource,
  getIndexerSettings,
  getMoviesIndexerResult,
  getSeriesIndexerResult,
  processWishlistIndexer,
  rejectAllIndexerResultsByGuids,
  rejectIndexerResultByGuid,
  searchMovieIndexer,
  searchSeriesIndexer,
  updateIndexerProcess,
} from '../../../server/modules/indexer';
import * as torznabModule from '../../../server/modules/torznab';
import * as tmdbModule from '../../../server/modules/tmdb';
import { createUser, updateUser } from '../../../server/modules/user';
import { IndexerSettings } from '../../../common/settings';
import { updateGlobalConfig } from '../../../server/modules/setting';
import { getNotifications } from '../../../server/modules/notification';

// Mock torznab and tmdb
vi.mock('../../../server/modules/torznab', async (importOriginal) => {
  const actual = await importOriginal<typeof torznabModule>();
  return {
    ...actual,
    checkTorznabConnection: vi.fn(),
    searchTorznab: vi.fn(),
    rssTorznab: vi.fn(),
  };
});

vi.mock('../../../server/modules/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof tmdbModule>();
  return {
    ...actual,
    proxyTmdb: vi.fn(),
  };
});

vi.mock('../../../server/modules/transmission', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/modules/transmission')>();
  return {
    ...actual,
    startDownload: vi.fn().mockResolvedValue(undefined),
  };
});

describe('indexer module', () => {
  let userId: number;
  const sampleSettings: IndexerSettings = {
    url: 'https://indexer.example.com',
    token: 'tok-123',
    qualities: ['1080p', '2160p'],
    languages: ['VFF', 'MULTI'],
  };

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.clearAllMocks();
    const { user } = createUser('indexerUser');
    userId = user.id;
  });

  describe('Title Metadata Extraction', () => {
    it('should extract quality from release title', () => {
      expect(extractQuality('Movie.Name.2024.1080p.mkv')).toBe('1080p');
      expect(extractQuality('Movie.Name.2024.2160p.mkv')).toBe('2160p');
      expect(extractQuality('Movie.Name.2024.720p.mkv')).toBe('720p');
      expect(extractQuality('Movie.Name.2024.SD.mkv')).toBe('480p');
      expect(extractQuality('Movie Name 2024 1080p WEB-DL')).toBe('1080p');
      expect(extractQuality('Movie Name (2024) [4K UHD]')).toBe('2160p');
      expect(extractQuality('Movie Name 1080i HDTV')).toBe('1080p');
      expect(extractQuality('Movie_Name_720p_x265')).toBe('720p');
      expect(extractQuality('Movie.Name.576p.DVDRip')).toBe('480p');
      expect(extractQuality('Movie.Name.NoQuality')).toBeNull();
    });

    it('should extract source from release title', () => {
      expect(extractSource('Movie.Name.2024.1080p.web-dl.x264')).toBe('WEB');
      expect(extractSource('Movie.Name.2024.1080p.bluray.x264')).toBe('BluRay');
      expect(extractSource('Movie.Name.2024.1080p.webrip.x264')).toBe('WEBRip');
      expect(extractSource('Movie.Name.2024.hdtv.x264')).toBe('HDTV');
      expect(extractSource('Movie Name 2024 REMUX 1080p')).toBe('BluRay');
      expect(extractSource('Movie Name 2024 BDRip x264')).toBe('BDRip');
      expect(extractSource('Movie.NoSource')).toBeNull();
    });

    it('should extract language from release title', () => {
      expect(extractLanguage('Movie.Name.2024.multi.1080p')).toBe('MULTI');
      expect(extractLanguage('Movie.Name.2024.vff.1080p')).toBe('VFF');
      expect(extractLanguage('Movie.Name.2024.truefrench.1080p')).toBe('VFF');
      expect(extractLanguage('Movie.Name.2024.vostfr.1080p')).toBe('VOSTFR');
      expect(extractLanguage('Movie Name 2024 TRUEFRENCH 1080p')).toBe('VFF');
      expect(extractLanguage('Movie Name 2024 VFQ 1080p')).toBe('VFQ');
      expect(extractLanguage('Movie Name 2024 SUBFRENCH 720p')).toBe('VOSTFR');
      expect(extractLanguage('Movie Name 2024 FRENCH 1080p')).toBe('VF');
      expect(extractLanguage('Movie Name 2024 VO 1080p')).toBe('VO');
      expect(extractLanguage('Movie.NoLanguage')).toBeNull();
    });

    it('should extract season number from release title', () => {
      expect(extractSeasonNumber('Series.Name.S02.1080p')).toBe(2);
      expect(extractSeasonNumber('Series.Name.S01E05.1080p')).toBe(1);
      expect(extractSeasonNumber('Series.Name.S10.MULTI')).toBe(10);
      expect(extractSeasonNumber('Series.Name.Saison.1.FRENCH.1080p')).toBe(1);
      expect(extractSeasonNumber('Series.Name.Season.03.Complete')).toBe(3);
      expect(extractSeasonNumber('Series.Name.2x04.HDTV')).toBe(2);
      expect(extractSeasonNumber('Movie.Name.2024')).toBeNull();
    });

    it('should extract episode number from release title', () => {
      expect(extractEpisodeNumber('Series.Name.S01E08.1080p')).toBe(8);
      expect(extractEpisodeNumber('Series.Name.E12.720p')).toBe(12);
      expect(extractEpisodeNumber('Series.Name.Saison.1.Episode.05.FRENCH')).toBe(5);
      expect(extractEpisodeNumber('Series.Name.Ep.03.720p')).toBe(3);
      expect(extractEpisodeNumber('Series.Name.1x07.HDTV')).toBe(7);
      expect(extractEpisodeNumber('Series.Name.S02.Complete')).toBeNull();
    });
  });

  describe('Configuration & Settings', () => {
    it('should return null when indexer is not configured', () => {
      expect(getIndexerSettings(userId)).toBeNull();
    });

    it('should configure indexer settings on successful connection test', async () => {
      vi.mocked(torznabModule.checkTorznabConnection).mockResolvedValueOnce({} as any);

      await configureIndexer(userId, sampleSettings);

      const saved = getIndexerSettings(userId);
      expect(saved?.url).toBe(sampleSettings.url);
      expect(saved?.token).toBe(sampleSettings.token);
    });

    it('should throw error when indexer connection check fails', async () => {
      vi.mocked(torznabModule.checkTorznabConnection).mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      await expect(configureIndexer(userId, sampleSettings)).rejects.toThrow(
        'Failed to connect to Indexer',
      );
    });
  });

  describe('Search Releases (Movies & Series)', () => {
    beforeEach(() => {
      const user = createUser('userSearch').user;
      userId = user.id;
      user.settings.indexer = sampleSettings;
      updateUser(user);
    });

    it('should search movies on Torznab and format results with metadata', async () => {
      vi.mocked(tmdbModule.proxyTmdb).mockResolvedValueOnce({
        id: 550,
        title: 'Fight Club',
      });

      vi.mocked(torznabModule.searchTorznab).mockResolvedValueOnce({
        rss: {
          channel: {
            item: [
              {
                title: 'Fight.Club.1999.1080p.MULTI.BluRay.x264',
                link: 'https://indexer.example.com/download/1',
                guid: 'guid-1',
                pubDate: '2024-01-01',
                'torznab:attr': [
                  { name: 'tmdbid', value: '550' },
                  { name: 'size', value: '1073741824' },
                  { name: 'seeders', value: '50' },
                  { name: 'leechers', value: '10' },
                ],
              },
            ],
          },
        },
      });

      const results = await searchMovieIndexer(userId, 550, 100, 0);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fight.Club.1999.1080p.MULTI.BluRay.x264');
      expect(results[0].quality).toBe('1080p');
      expect(results[0].language).toBe('MULTI');
    });

    it('should search series on Torznab and extract season/episode info', async () => {
      vi.mocked(tmdbModule.proxyTmdb).mockResolvedValueOnce({
        id: 1399,
        name: 'Game of Thrones',
      });

      vi.mocked(torznabModule.searchTorznab).mockResolvedValueOnce({
        rss: {
          channel: {
            item: [
              {
                title: 'Game.of.Thrones.S01E03.1080p.VFF.WEB-DL',
                link: 'https://indexer.example.com/download/2',
                guid: 'guid-2',
                pubDate: '2024-01-01',
                'torznab:attr': [
                  { name: 'tmdbid', value: '1399' },
                  { name: 'size', value: '2000000000' },
                  { name: 'seeders', value: '30' },
                  { name: 'leechers', value: '5' },
                ],
              },
            ],
          },
        },
      });

      const results = await searchSeriesIndexer(userId, 1399, 100, 0, 1);
      expect(results).toHaveLength(1);
      expect(results[0].seasonNumber).toBe(1);
      expect(results[0].episodeNumber).toBe(3);
      expect(results[0].quality).toBe('1080p');
    });
  });

  describe('Stored Results & Rejections', () => {
    beforeEach(() => {
      const user = createUser('userRejections').user;
      userId = user.id;
      user.settings.indexer = sampleSettings;
      updateUser(user);
    });

    it('should retrieve stored movie and series results', async () => {
      writeStore('indexer-movie-result', userId, [
        {
          title: 'Stored Movie',
          link: 'l1',
          guid: 'g1',
        },
      ]);
      writeStore('indexer-series-result', userId, [
        {
          title: 'Stored Series',
          link: 'l2',
          guid: 'g2',
        },
      ]);

      const movies = await getMoviesIndexerResult(userId);
      const series = await getSeriesIndexerResult(userId);

      expect(movies).toHaveLength(1);
      expect(movies[0].title).toBe('Stored Movie');
      expect(series).toHaveLength(1);
      expect(series[0].title).toBe('Stored Series');
    });

    it('should reject a result by GUID (movie, series, or unknown) and add to blacklist', async () => {
      writeStore('indexer-movie-result', userId, [
        { tmdbId: 550, title: 'Movie 1', link: 'l1', guid: 'guid-keep' },
        { tmdbId: 550, title: 'Movie 2', link: 'l2', guid: 'guid-remove' },
      ]);
      writeStore('indexer-series-result', userId, [
        { tmdbId: 1399, title: 'Series 1', link: 'l3', guid: 'guid-series-remove' },
      ]);

      await rejectIndexerResultByGuid(userId, 'guid-remove');
      await rejectIndexerResultByGuid(userId, 'guid-series-remove');
      await rejectIndexerResultByGuid(userId, 'unknown-guid');

      const movies = await getMoviesIndexerResult(userId);
      expect(movies).toHaveLength(1);
      expect(movies[0].guid).toBe('guid-keep');
    });

    it('should reject multiple results by GUIDs in batch', async () => {
      writeStore('indexer-movie-result', userId, [
        { tmdbId: 550, title: '1', link: 'l1', guid: 'g1' },
        { tmdbId: 550, title: '2', link: 'l2', guid: 'g2' },
        { tmdbId: 550, title: '3', link: 'l3', guid: 'g3' },
      ]);

      await rejectAllIndexerResultsByGuids(userId, ['g1', 'g2']);

      const movies = await getMoviesIndexerResult(userId);
      expect(movies).toHaveLength(1);
      expect(movies[0].guid).toBe('g3');
    });
  });

  describe('Wishlist Processing & Indexer Cron', () => {
    it('should process wishlist items, match RSS results and create notifications', async () => {
      const { user } = createUser('userWishlistProcessing');
      user.settings.indexer = sampleSettings;
      updateUser(user);

      // Add movie and series to wishlist with all required fields
      writeStore('whishlist', user.id, [
        {
          tmdb: 550,
          type: 'movie',
          title: 'Fight Club',
          original_title: 'Fight Club',
          releaseDate: '1999-10-15',
          addedAt: '2024-01-01',
        },
        {
          tmdb: 1399,
          type: 'series',
          title: 'Game of Thrones',
          original_title: 'Game of Thrones',
          releaseDate: '2011-04-17',
          addedAt: '2024-01-01',
          all_seasons: true,
        },
      ]);

      // Mock rssTorznab returning matching movie and series
      vi.mocked(torznabModule.rssTorznab).mockImplementation(async (settings, type) => {
        if (type === 'movie') {
          return {
            rss: {
              channel: {
                item: [
                  {
                    title: 'Fight.Club.1999.1080p.MULTI',
                    link: 'https://link1',
                    guid: 'guid-fc-1',
                    'torznab:attr': [{ name: 'tmdbid', value: '550' }, { name: 'size', value: '1000' }],
                  },
                ],
              },
            },
          } as any;
        } else {
          return {
            rss: {
              channel: {
                item: [
                  {
                    title: 'Game.of.Thrones.S01E01.1080p.MULTI',
                    link: 'https://link2',
                    guid: 'guid-got-1',
                    'torznab:attr': [{ name: 'tmdbid', value: '1399' }, { name: 'size', value: '2000' }],
                  },
                ],
              },
            },
          } as any;
        }
      });

      await processWishlistIndexer();

      const notifs = getNotifications(user.id);
      expect(notifs.notifications.length).toBeGreaterThanOrEqual(1);
    });

    it('should automatically start download when autoDownload is enabled for user', async () => {
      const user = createUser('userAutoDl').user;
      user.settings.indexer = { ...sampleSettings, autoDownload: true };
      updateUser(user);

      writeStore('wishlist', user.id, [
        {
          tmdb: 550,
          type: 'movie',
          title: 'Fight Club',
          original_title: 'Fight Club',
          releaseDate: '1999-10-15',
          addedAt: '2024-01-01',
        },
      ]);

      vi.mocked(torznabModule.rssTorznab).mockResolvedValue({
        rss: {
          channel: {
            item: [
              {
                title: 'Fight.Club.1999.1080p.MULTI',
                link: 'https://link-fc',
                guid: 'guid-fc-auto',
                'torznab:attr': [{ name: 'tmdbid', value: '550' }, { name: 'size', value: '1000' }],
              },
            ],
          },
        },
      } as any);

      const transmissionModule = await import('../../../server/modules/transmission');

      await processWishlistIndexer();

      expect(transmissionModule.startDownload).toHaveBeenCalledWith(
        user.id,
        'guid-fc-auto',
        'movie',
      );

      const notifs = getNotifications(user.id);
      expect(notifs.notifications.some((n) => n.title.includes('automatique'))).toBe(true);
    });

    it('should handle multiple releases and auto-download failures in processWishlistIndexer', async () => {
      const user = createUser('userMultiReleases').user;
      user.settings.indexer = { ...sampleSettings, autoDownload: true };
      updateUser(user);

      writeStore('wishlist', user.id, [
        { tmdb: 550, type: 'movie', title: 'Fight Club', original_title: 'Fight Club', releaseDate: '1999', addedAt: '2024-01-01' },
        { tmdb: 680, type: 'movie', title: 'Pulp Fiction', original_title: 'Pulp Fiction', releaseDate: '1994', addedAt: '2024-01-01' },
        { tmdb: 1399, type: 'series', title: 'Game of Thrones', original_title: 'Game of Thrones', releaseDate: '2011', addedAt: '2024-01-01', all_seasons: true },
      ]);

      vi.mocked(torznabModule.rssTorznab).mockImplementation(async (settings, type) => {
        if (type === 'movie') {
          return {
            rss: {
              channel: {
                item: [
                  { title: 'Fight.Club.1999.1080p.MULTI', link: 'l1', guid: 'g-fc', 'torznab:attr': [{ name: 'tmdbid', value: '550' }, { name: 'size', value: '100' }] },
                  { title: 'Pulp.Fiction.1994.1080p.MULTI', link: 'l2', guid: 'g-pf', 'torznab:attr': [{ name: 'tmdbid', value: '680' }, { name: 'size', value: '100' }] },
                ],
              },
            },
          } as any;
        } else {
          return {
            rss: {
              channel: {
                item: [
                  { title: 'Game.of.Thrones.S01E01.1080p.MULTI', link: 'l3', guid: 'g-got-1', 'torznab:attr': [{ name: 'tmdbid', value: '1399' }, { name: 'size', value: '100' }] },
                  { title: 'Game.of.Thrones.S01E02.1080p.MULTI', link: 'l4', guid: 'g-got-2', 'torznab:attr': [{ name: 'tmdbid', value: '1399' }, { name: 'size', value: '100' }] },
                ],
              },
            },
          } as any;
        }
      });

      const transmissionModule = await import('../../../server/modules/transmission');
      vi.mocked(transmissionModule.startDownload).mockRejectedValueOnce(new Error('Transmission disk full'));

      await processWishlistIndexer();

      const notifs = getNotifications(user.id);
      expect(notifs.notifications.length).toBeGreaterThanOrEqual(2);
    });

    it('should update indexer process when pullAuto setting changes', () => {
      updateGlobalConfig({ pullAuto: true });
      expect(() => updateIndexerProcess()).not.toThrow();

      updateGlobalConfig({ pullAuto: false });
      expect(() => updateIndexerProcess()).not.toThrow();
    });
  });

  describe('purgeIndexerResultsForMedia & resetIndexerStateForMedia', () => {
    it('should purge results and add to blacklist for movie and series', async () => {
      const { purgeIndexerResultsForMedia } = await import('../../../server/modules/indexer');

      writeStore('indexer-movie-result', userId, [
        { tmdbId: '550', guid: 'g-movie', title: 'Fight Club' } as any,
      ]);
      writeStore('indexer-series-result', userId, [
        { tmdbId: '1399', guid: 'g-series-s1e1', title: 'GoT S1E1', seasonNumber: 1, episodeNumber: 1 } as any,
        { tmdbId: '1399', guid: 'g-series-s2e1', title: 'GoT S2E1', seasonNumber: 2, episodeNumber: 1 } as any,
      ]);

      purgeIndexerResultsForMedia(userId, 550, 'movie', undefined, undefined, 'g-movie');
      purgeIndexerResultsForMedia(userId, 1399, 'series', 1, 1, 'g-series-s1e1');

      const remainingMovies = await getMoviesIndexerResult(userId);
      const remainingSeries = await getSeriesIndexerResult(userId);

      expect(remainingMovies).toHaveLength(0);
      expect(remainingSeries).toHaveLength(1);
      expect(remainingSeries[0].seasonNumber).toBe(2);
    });

    it('should reset indexer state and clean blacklist entries with resetIndexerStateForMedia', async () => {
      const { resetIndexerStateForMedia } = await import('../../../server/modules/indexer');

      writeStore('indexer-movie-result', userId, [
        { tmdbId: '550', guid: 'g1', title: 'Fight Club' } as any,
        { tmdbId: '680', guid: 'g2', title: 'Pulp Fiction' } as any,
      ]);
      writeStore('indexer-series-result', userId, [
        { tmdbId: '1399', guid: 'g3', title: 'GoT S1E1', seasonNumber: 1, episodeNumber: 1 } as any,
        { tmdbId: '1399', guid: 'g4', title: 'GoT S2E1', seasonNumber: 2, episodeNumber: 1 } as any,
      ]);
      writeStore('indexer-blacklist', userId, [
        'movie:550:g1',
        'movie:680:g2',
        'series:1399:g3',
        'series:1399:g4',
      ]);

      // Reset movie 550
      resetIndexerStateForMedia(userId, 550, 'movie');
      let movies = await getMoviesIndexerResult(userId);
      expect(movies.find((m) => Number(m.tmdbId) === 550)).toBeUndefined();
      expect(movies.find((m) => Number(m.tmdbId) === 680)).toBeDefined();

      // Reset series 1399 season 1
      resetIndexerStateForMedia(userId, 1399, 'series', 1, 1);
      let series = await getSeriesIndexerResult(userId);
      expect(series.find((s) => s.seasonNumber === 1)).toBeUndefined();
      expect(series.find((s) => s.seasonNumber === 2)).toBeDefined();

      // Reset without type
      resetIndexerStateForMedia(userId, 680);
      movies = await getMoviesIndexerResult(userId);
      expect(movies).toHaveLength(0);
    });
  });
});
