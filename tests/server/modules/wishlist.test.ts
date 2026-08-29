import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initDB, writeStore } from '../../../server/modules/db';
import * as tmdbModule from '../../../server/modules/tmdb';
import {
  addToWishlist,
  consumeWishlistItemForDownload,
  deleteWishlist,
  deleteWishlistItems,
  getWishlist,
} from '../../../server/modules/wishlist';
import { readStore } from '../../../server/modules/db';

// Mock TMDB proxy to avoid real network calls
vi.mock('../../../server/modules/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof tmdbModule>();
  return {
    ...actual,
    proxyTmdb: vi.fn(),
  };
});

describe('wishlist module', () => {
  const mockedProxyTmdb = vi.mocked(tmdbModule.proxyTmdb);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    db.prepare("DELETE FROM kv_store WHERE namespace IN ('wishlist', 'whishlist')").run();
    vi.clearAllMocks();
  });

  describe('addToWishlist', () => {
    describe('Error handling', () => {
      it('should throw an error if TMDB returns null or empty response', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(null);

        await expect(addToWishlist(1, 999999, 'movie')).rejects.toThrow('Item not found in TMDB');
      });

      it('should throw an error if TMDB returns an object without an id', async () => {
        mockedProxyTmdb.mockResolvedValueOnce({} as any);

        await expect(addToWishlist(1, 999999, 'movie')).rejects.toThrow('Item not found in TMDB');
      });
    });

    describe('Adding movies to wishlist', () => {
      const sampleMovie = {
        id: 550,
        title: 'Fight Club',
        original_title: 'Fight Club',
        release_date: '1999-10-15',
        genres: [{ id: 18, name: 'Drama' }],
        vote_average: 8.433,
        poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      };

      it('should successfully add a new movie to an empty wishlist', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);

        await addToWishlist(1, 550, 'movie');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);

        const item = wishlist[0];
        expect(item.tmdb).toBe(550);
        expect(item.type).toBe('movie');
        expect(item.title).toBe('Fight Club');
        expect(item.original_title).toBe('Fight Club');
        expect(item.releaseDate).toBe('1999-10-15');
        expect(item.genre).toBe('Drama');
        expect(item.rating).toBe(8.433);
        expect(item.poster_path).toBe('/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg');
        expect(item.all_seasons).toBe(false);
        expect(item.seasons).toEqual({});
        expect(new Date(item.addedAt).getTime()).not.toBeNaN();
      });

      it('should handle movie with no genres gracefully', async () => {
        mockedProxyTmdb.mockResolvedValueOnce({
          ...sampleMovie,
          id: 551,
          title: 'No Genre Movie',
          original_title: 'No Genre Movie',
          genres: [],
        });

        await addToWishlist(1, 551, 'movie');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].genre).toBe('');
      });

      it('should append additional movies without removing existing ones', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
        await addToWishlist(1, 550, 'movie');

        mockedProxyTmdb.mockResolvedValueOnce({
          id: 680,
          title: 'Pulp Fiction',
          original_title: 'Pulp Fiction',
          release_date: '1994-09-10',
          genres: [{ id: 80, name: 'Crime' }],
          vote_average: 8.489,
          poster_path: '/vQWb51YQfnnh5C7TnFTdBdaAc9e.jpg',
        });
        await addToWishlist(1, 680, 'movie');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(2);
        expect(wishlist.map((i) => i.tmdb)).toEqual([550, 680]);
      });

      it('should not duplicate movie if added again', async () => {
        mockedProxyTmdb.mockResolvedValue(sampleMovie);

        await addToWishlist(1, 550, 'movie');
        await addToWishlist(1, 550, 'movie');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].tmdb).toBe(550);
      });
    });

    describe('Adding series to wishlist (New item)', () => {
      const sampleSeries = {
        id: 1399,
        name: 'Game of Thrones',
        original_name: 'Game of Thrones',
        first_air_date: '2011-04-17',
        genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
        vote_average: 8.455,
        poster_path: '/1XS1oqL89opfnbLl8WnZY1kv4Kd.jpg',
      };

      it('should add a series with all seasons when no season/episode is specified', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

        await addToWishlist(1, 1399, 'series');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);

        const item = wishlist[0];
        expect(item.tmdb).toBe(1399);
        expect(item.type).toBe('series');
        expect(item.title).toBe('Game of Thrones');
        expect(item.original_title).toBe('Game of Thrones');
        expect(item.releaseDate).toBe('2011-04-17');
        expect(item.all_seasons).toBe(true);
        expect(item.seasons).toEqual({});
      });

      it('should add a series with a specific full season', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

        await addToWishlist(1, 1399, 'series', 1);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);

        const item = wishlist[0];
        expect(item.all_seasons).toBe(false);
        expect(item.seasons).toEqual({
          1: {
            season_number: 1,
            all_episodes: true,
            episodes: [],
          },
        });
      });

      it('should add a series with a specific single episode', async () => {
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

        await addToWishlist(1, 1399, 'series', 1, 3);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);

        const item = wishlist[0];
        expect(item.all_seasons).toBe(false);
        expect(item.seasons).toEqual({
          1: {
            season_number: 1,
            all_episodes: false,
            episodes: [3],
          },
        });
      });
    });

    describe('Updating existing series in wishlist', () => {
      const sampleSeries = {
        id: 1399,
        name: 'Game of Thrones',
        original_name: 'Game of Thrones',
        first_air_date: '2011-04-17',
        genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
        vote_average: 8.455,
        poster_path: '/1XS1oqL89opfnbLl8WnZY1kv4Kd.jpg',
      };

      it('should upgrade existing series to all_seasons = true when added with no season parameter', async () => {
        // First add specific episode S1E1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 1);

        // Now add the entire series
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series');

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].all_seasons).toBe(true);
        expect(wishlist[0].seasons).toEqual({});
      });

      it('should add additional episodes to an existing season and avoid duplicates', async () => {
        // Add S1E1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 1);

        // Add S1E2
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 2);

        // Add duplicate S1E1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 1);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].seasons[1]).toEqual({
          season_number: 1,
          all_episodes: false,
          episodes: [1, 2],
        });
      });

      it('should upgrade an episode-level season to all_episodes = true when adding the whole season', async () => {
        // Add S1E1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 1);

        // Add entire S1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].seasons[1]).toEqual({
          season_number: 1,
          all_episodes: true,
          episodes: [],
        });
      });

      it('should add a new season to an existing series with other seasons', async () => {
        // Add S1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1);

        // Add S2 full season
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 2);

        // Add S3 episode 5
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 3, 5);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].seasons).toEqual({
          1: { season_number: 1, all_episodes: true, episodes: [] },
          2: { season_number: 2, all_episodes: true, episodes: [] },
          3: { season_number: 3, all_episodes: false, episodes: [5] },
        });
      });

      it('should not add individual episode if season is already marked with all_episodes = true', async () => {
        // Add full season 1
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1);

        // Try adding S1E3
        mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
        await addToWishlist(1, 1399, 'series', 1, 3);

        const wishlist = await getWishlist(1);
        expect(wishlist).toHaveLength(1);
        expect(wishlist[0].seasons[1]).toEqual({
          season_number: 1,
          all_episodes: true,
          episodes: [],
        });
      });
    });

    describe('User isolation', () => {
      it('should keep wishlists isolated between different user IDs', async () => {
        // User 1 adds movie
        mockedProxyTmdb.mockResolvedValueOnce({
          id: 550,
          title: 'Fight Club',
          original_title: 'Fight Club',
          release_date: '1999-10-15',
          genres: [{ id: 18, name: 'Drama' }],
          vote_average: 8.433,
          poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
        });
        await addToWishlist(1, 550, 'movie');

        // User 2 adds series
        mockedProxyTmdb.mockResolvedValueOnce({
          id: 1399,
          name: 'Game of Thrones',
          original_name: 'Game of Thrones',
          first_air_date: '2011-04-17',
          genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
          vote_average: 8.455,
          poster_path: '/1XS1oqL89opfnbLl8WnZY1kv4Kd.jpg',
        });
        await addToWishlist(2, 1399, 'series');

        const user1Wishlist = await getWishlist(1);
        const user2Wishlist = await getWishlist(2);

        expect(user1Wishlist).toHaveLength(1);
        expect(user1Wishlist[0].tmdb).toBe(550);
        expect(user1Wishlist[0].type).toBe('movie');

        expect(user2Wishlist).toHaveLength(1);
        expect(user2Wishlist[0].tmdb).toBe(1399);
        expect(user2Wishlist[0].type).toBe('series');
      });
    });
  });

  describe('getWishlist parser resilience', () => {
    it('should return an empty array if kv_store has no entry or non-array value', async () => {
      expect(await getWishlist(99)).toEqual([]);

      writeStore('whishlist', 99, { invalid: 'object' } as any);
      expect(await getWishlist(99)).toEqual([]);
    });

    it('should filter out invalid items from raw storage', async () => {
      const rawData = [
        null,
        undefined,
        'not an object',
        { tmdb: 'NaN', type: 'movie' }, // invalid tmdb
        { tmdb: 100, type: 'invalid_type' }, // invalid type
        {
          tmdb: 200,
          type: 'movie',
          title: 'Valid Movie',
          original_title: 'Valid Movie',
          releaseDate: '2023-01-01',
          addedAt: '2023-01-01T00:00:00.000Z',
          poster_path: null,
          rating: 7.5,
          genre: 'Action',
          all_seasons: false,
          seasons: {
            invalidSeasonKey: { all_episodes: true },
            1: { all_episodes: false, episodes: ['1', 'invalid', 2] },
          },
        },
      ];
      writeStore('whishlist', 1, rawData as any);

      const list = await getWishlist(1);
      expect(list).toHaveLength(1);
      expect(list[0].tmdb).toBe(200);
      expect(list[0].seasons[1]).toEqual({
        season_number: 1,
        all_episodes: false,
        episodes: [1, 2],
      });
    });

    it('should read from legacy whishlist namespace if wishlist is empty', async () => {
      writeStore('whishlist', 1, [
        {
          tmdb: 300,
          type: 'movie',
          title: 'Legacy Movie',
          original_title: 'Legacy Movie',
          releaseDate: '2020-01-01',
          addedAt: '2020-01-01T00:00:00.000Z',
        },
      ]);

      const list = await getWishlist(1);
      expect(list).toHaveLength(1);
      expect(list[0].tmdb).toBe(300);
      expect(list[0].title).toBe('Legacy Movie');
    });
  });

  describe('deleteWishlist', () => {
    const sampleSeries = {
      id: 1399,
      name: 'Game of Thrones',
      original_name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
      vote_average: 8.455,
      poster_path: '/1XS1oqL89opfnbLl8WnZY1kv4Kd.jpg',
    };

    it('should delete an entire item when no season is specified', async () => {
      mockedProxyTmdb.mockResolvedValue(sampleSeries);
      await addToWishlist(1, 1399, 'series');

      expect(await getWishlist(1)).toHaveLength(1);

      await deleteWishlist(1, 1399);
      expect(await getWishlist(1)).toHaveLength(0);
    });

    it('should delete an individual episode and remove season/item when empty', async () => {
      mockedProxyTmdb.mockResolvedValue(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1, 1);
      await addToWishlist(1, 1399, 'series', 1, 2);

      // Delete episode 1
      await deleteWishlist(1, 1399, 'series', 1, 1);
      let wishlist = await getWishlist(1);
      expect(wishlist[0].seasons[1].episodes).toEqual([2]);

      // Delete episode 2 - season 1 becomes empty, item has no more seasons, item is removed
      await deleteWishlist(1, 1399, 'series', 1, 2);
      wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(0);
    });

    it('should delete an entire season from a series with multiple seasons', async () => {
      mockedProxyTmdb.mockResolvedValue(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1);
      await addToWishlist(1, 1399, 'series', 2);

      await deleteWishlist(1, 1399, 'series', 1);
      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      expect(Object.keys(wishlist[0].seasons)).toEqual(['2']);
    });
  });

  describe('deleteWishlistItems', () => {
    const sampleMovie = {
      id: 550,
      title: 'Fight Club',
      original_title: 'Fight Club',
      release_date: '1999-10-15',
      genres: [{ id: 18, name: 'Drama' }],
      vote_average: 8.433,
      poster_path: '/poster.jpg',
    };

    const sampleSeries = {
      id: 1399,
      name: 'Game of Thrones',
      original_name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
      vote_average: 8.455,
      poster_path: '/poster2.jpg',
    };

    it('should batch delete multiple items in a single transaction', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
      await addToWishlist(1, 550, 'movie');

      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series');

      expect(await getWishlist(1)).toHaveLength(2);

      await deleteWishlistItems(1, [
        { tmdbId: 550, type: 'movie' },
        { tmdbId: 1399, type: 'series' },
      ]);

      expect(await getWishlist(1)).toHaveLength(0);
    });

    it('should handle empty or null items array gracefully', async () => {
      await deleteWishlistItems(1, []);
      expect(await getWishlist(1)).toEqual([]);
    });

    it('should reset indexer results and blacklist when an item is deleted', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
      await addToWishlist(1, 550, 'movie');

      writeStore('indexer-movie-result', 1, [
        { tmdbId: '550', guid: 'guid-550', title: 'Fight Club 1080p', link: 'http://' } as any,
      ]);
      writeStore('indexer-blacklist', 1, ['movie:550:guid-550', 'movie:999:guid-999']);

      await deleteWishlist(1, 550, 'movie');

      expect(await getWishlist(1)).toHaveLength(0);
      const remainingResults = readStore('indexer-movie-result', 1) as any[];
      expect(remainingResults).toHaveLength(0);
      const remainingBlacklist = readStore('indexer-blacklist', 1) as string[];
      expect(remainingBlacklist).toEqual(['movie:999:guid-999']);
    });
  });

  describe('consumeWishlistItemForDownload', () => {
    const sampleMovie = {
      id: 550,
      title: 'Fight Club',
      original_title: 'Fight Club',
      release_date: '1999-10-15',
      genres: [{ id: 18, name: 'Drama' }],
      vote_average: 8.433,
      poster_path: '/poster.jpg',
    };

    const sampleSeries = {
      id: 1399,
      name: 'Game of Thrones',
      original_name: 'Game of Thrones',
      first_air_date: '2011-04-17',
      genres: [{ id: 10765, name: 'Sci-Fi & Fantasy' }],
      vote_average: 8.455,
      poster_path: '/poster2.jpg',
      seasons: [
        { season_number: 1, episode_count: 10 },
        { season_number: 2, episode_count: 10 },
      ],
    };

    it('should consume a movie from wishlist and purge indexer results when downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleMovie);
      await addToWishlist(1, 550, 'movie');

      writeStore('indexer-movie-result', 1, [
        { tmdbId: '550', guid: 'guid-movie-1', title: 'Fight Club 1080p', link: 'http://' } as any,
      ]);

      await consumeWishlistItemForDownload(1, 'guid-movie-1', 'movie');

      expect(await getWishlist(1)).toHaveLength(0);
      const remainingResults = readStore('indexer-movie-result', 1) as any[];
      expect(remainingResults).toHaveLength(0);
      const blacklist = readStore('indexer-blacklist', 1) as string[];
      expect(blacklist).toContain('movie:550:guid-movie-1');
    });

    it('should explode an all_seasons series into remaining episodes when a single episode is downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series');

      // Mock for TMDB details query inside consumeWishlistItemForDownload
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

      writeStore('indexer-series-result', 1, [
        {
          tmdbId: '1399',
          guid: 'guid-s01e01',
          title: 'Game of Thrones S01E01',
          seasonNumber: 1,
          episodeNumber: 1,
          link: 'http://',
        } as any,
      ]);

      await consumeWishlistItemForDownload(1, 'guid-s01e01', 'series');

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      const item = wishlist[0];
      expect(item.all_seasons).toBe(false);
      expect(item.seasons[1].all_episodes).toBe(false);
      expect(item.seasons[1].episodes).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(item.seasons[2].all_episodes).toBe(true);
    });

    it('should remove a downloaded episode from a specific episode list in wishlist', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1, 1);
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1, 2);

      await consumeWishlistItemForDownload(1, 'guid-s01e01', 'series', {
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      expect(wishlist[0].seasons[1].episodes).toEqual([2]);
    });

    it('should remove entire series when the last remaining episode is downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1, 1);

      await consumeWishlistItemForDownload(1, 'guid-s01e01', 'series', {
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(0);
    });

    it('should remove full season from wishlist when a season pack is downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1);
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 2);

      await consumeWishlistItemForDownload(1, 'guid-s01-pack', 'series', {
        tmdbId: 1399,
        seasonNumber: 1,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      expect(Object.keys(wishlist[0].seasons)).toEqual(['2']);
    });

    it('should split all_seasons series into remaining seasons when a season pack is downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series');

      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

      await consumeWishlistItemForDownload(1, 'guid-s01-pack', 'series', {
        tmdbId: 1399,
        seasonNumber: 1,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      expect(wishlist[0].all_seasons).toBe(false);
      expect(Object.keys(wishlist[0].seasons)).toEqual(['2']);
      expect(wishlist[0].seasons[2].all_episodes).toBe(true);
    });

    it('should remove entire series when full series download is consumed without season/episode', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series');

      await consumeWishlistItemForDownload(1, 'guid-full-series', 'series', {
        tmdbId: 1399,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(0);
    });

    it('should split single season with all_episodes into remaining episode list when single episode downloaded', async () => {
      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);
      await addToWishlist(1, 1399, 'series', 1);

      mockedProxyTmdb.mockResolvedValueOnce(sampleSeries);

      await consumeWishlistItemForDownload(1, 'guid-s01e01', 'series', {
        tmdbId: 1399,
        seasonNumber: 1,
        episodeNumber: 1,
      });

      const wishlist = await getWishlist(1);
      expect(wishlist).toHaveLength(1);
      expect(wishlist[0].seasons[1].all_episodes).toBe(false);
      expect(wishlist[0].seasons[1].episodes).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it('should purge indexer results when guid is given without matching tmdbId', async () => {
      writeStore('indexer-movie-result', 1, [
        { tmdbId: '999', guid: 'guid-unknown', title: 'Unknown Movie' } as any,
      ]);

      await consumeWishlistItemForDownload(1, 'guid-unknown', 'movie');

      const movies = readStore('indexer-movie-result', 1) as any[];
      expect(movies.find((m) => m.guid === 'guid-unknown')).toBeUndefined();
    });
  });
});

