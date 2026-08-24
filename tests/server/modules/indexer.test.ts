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
  rejectAllIndexerResultsByGuids,
  rejectIndexerResultByGuid,
  searchMovieIndexer,
  searchSeriesIndexer,
} from '../../../server/modules/indexer';
import * as torznabModule from '../../../server/modules/torznab';
import * as tmdbModule from '../../../server/modules/tmdb';
import { createUser, updateUser } from '../../../server/modules/user';
import { IndexerSettings } from '../../../common/settings';

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
      expect(extractQuality('Movie.Name.NoQuality')).toBeNull();
    });

    it('should extract source from release title', () => {
      expect(extractSource('Movie.Name.2024.1080p.web-dl.x264')).toBe('WEB');
      expect(extractSource('Movie.Name.2024.1080p.bluray.x264')).toBe('BluRay');
      expect(extractSource('Movie.Name.2024.1080p.webrip.x264')).toBe('WEBRip');
      expect(extractSource('Movie.Name.2024.hdtv.x264')).toBe('HDTV');
      expect(extractSource('Movie.NoSource')).toBeNull();
    });

    it('should extract language from release title', () => {
      expect(extractLanguage('Movie.Name.2024.multi.1080p')).toBe('MULTI');
      expect(extractLanguage('Movie.Name.2024.vff.1080p')).toBe('VFF');
      expect(extractLanguage('Movie.Name.2024.truefrench.1080p')).toBe('VFF');
      expect(extractLanguage('Movie.Name.2024.vostfr.1080p')).toBe('VOSTFR');
      expect(extractLanguage('Movie.NoLanguage')).toBeNull();
    });

    it('should extract season number from release title', () => {
      expect(extractSeasonNumber('Series.Name.S02.1080p')).toBe(2);
      expect(extractSeasonNumber('Series.Name.S01E05.1080p')).toBe(1);
      expect(extractSeasonNumber('Series.Name.S10.MULTI')).toBe(10);
      expect(extractSeasonNumber('Movie.Name.2024')).toBeNull();
    });

    it('should extract episode number from release title', () => {
      expect(extractEpisodeNumber('Series.Name.S01E08.1080p')).toBe(8);
      expect(extractEpisodeNumber('Series.Name.E12.720p')).toBe(12);
      expect(extractEpisodeNumber('Series.Name.S02.Complete')).toBeNull();
    });
  });

  describe('Indexer Configuration & Retrieval', () => {
    it('should return null when indexer is not configured', () => {
      expect(getIndexerSettings(userId)).toBeNull();
    });

    it('should configure indexer after validating connection via checkTorznabConnection', async () => {
      vi.mocked(torznabModule.checkTorznabConnection).mockResolvedValueOnce({
        rss: { channel: { title: 'Indexer OK' } },
      });

      await configureIndexer(userId, sampleSettings);

      const saved = getIndexerSettings(userId);
      expect(saved).toEqual(sampleSettings);
    });
  });

  describe('Search Releases via Indexer', () => {
    beforeEach(() => {
      const user = createUser('userSearch').user;
      userId = user.id;
      user.settings.indexer = sampleSettings;
      updateUser(user);
    });

    it('should search for movie releases matching TMDB details', async () => {
      vi.mocked(tmdbModule.proxyTmdb).mockResolvedValueOnce({
        id: 550,
        title: 'Fight Club',
        original_title: 'Fight Club',
        release_date: '1999-10-15',
      });

      vi.mocked(torznabModule.searchTorznab).mockResolvedValueOnce({
        rss: {
          channel: {
            item: [
              {
                title: 'Fight.Club.1999.multi.1080p.bluray.x264',
                link: 'https://indexer/get/1',
                guid: 'guid-1',
                pubDate: '2024-01-01',
                'torznab:attr': [
                  { name: 'size', value: '8000000000' },
                  { name: 'seeders', value: '50' },
                  { name: 'leechers', value: '10' },
                ],
              },
            ],
          },
        },
      });

      const results = await searchMovieIndexer(userId, 550);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Fight.Club.1999.multi.1080p.bluray.x264');
      expect(results[0].quality).toBe('1080p');
      expect(results[0].language).toBe('MULTI');
      expect(results[0].seeders).toBe(50);
    });

    it('should search for series releases matching TMDB details', async () => {
      vi.mocked(tmdbModule.proxyTmdb).mockResolvedValueOnce({
        id: 1399,
        name: 'Game of Thrones',
        original_name: 'Game of Thrones',
        first_air_date: '2011-04-17',
      });

      vi.mocked(torznabModule.searchTorznab).mockResolvedValueOnce({
        rss: {
          channel: {
            item: [
              {
                title: 'Game.of.Thrones.S01E03.multi.1080p.web-dl.x264',
                link: 'https://indexer/get/3',
                guid: 'guid-3',
                pubDate: '2024-01-01',
                'torznab:attr': [
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

    it('should reject a result by GUID and add to blacklist', async () => {
      writeStore('indexer-movie-result', userId, [
        { tmdbId: 550, title: 'Movie 1', link: 'l1', guid: 'guid-keep' },
        { tmdbId: 550, title: 'Movie 2', link: 'l2', guid: 'guid-remove' },
      ]);

      await rejectIndexerResultByGuid(userId, 'guid-remove');

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
});
