import { IndexerMovieResult, IndexerSeriesResult } from '../../common/indexer';
import { IndexerSettings } from '../../common/settings';
import { getUsers } from './auth';
import { readStore, runInTransaction } from './db';
import { ErrorCode } from './errors';
import { addNotification } from './notification';
import { buildDetailsRequest, proxyTmdb, TmdbType } from './tmdb';
import { checkTorznabConnection, rssTorznab, searchTorznab } from './torznab';
import { getUser } from './user';
import { getWishlist } from './wishlist';

// Enum of quality options
const QUALITY_MAP: Record<string, string> = {
  '.2160p.': '2160p',
  '.1080p.': '1080p',
  '.720p.': '720p',
  '.480p.': '480p',
  '.sd.': '480p',
};

const SOURCE_MAP: Record<string, string> = {
  '.web-dl.': 'WEB',
  '.webrip.': 'WEBRip',
  '.hdrip.': 'HDRip',
  '.bdrip.': 'BDRip',
  '.dvdrip.': 'DVDRip',
  '.hdtv.': 'HDTV',
  '.sdtv.': 'SDTV',
  '.bluray.': 'BluRay',
  '.web.': 'WEB',
};

const LANGUAGE_MAP: Record<string, string> = {
  '.vff.': 'VFF',
  '.vf2.': 'VF2',
  '.vfq.': 'VFQ',
  '.vostfr.': 'VOSTFR',
  '.truefrench.': 'VFF',
  '.multi.': 'MULTI',
};

export function extractQuality(title: string): string | null {
  const normalized = String(title || '').toLowerCase();
  for (const option in QUALITY_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return QUALITY_MAP[option];
    }
  }
  return null;
}

export function extractSource(title: string): string | null {
  const normalized = String(title || '').toLowerCase();
  for (const option in SOURCE_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return SOURCE_MAP[option];
    }
  }
  return null;
}

export function extractLanguage(title: string): string | null {
  const normalized = String(title || '').toLowerCase();
  for (const option in LANGUAGE_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return LANGUAGE_MAP[option];
    }
  }
  return null;
}

export function extractSeasonNumber(title: string): number | null {
  const normalized = String(title || '').toLowerCase();
  const seasonMatch = new RegExp(/(?:^|[^a-z0-9])s(\d{1,3})(?=e\d{1,4}|[^a-z0-9]|$)/).exec(
    normalized,
  );
  if (seasonMatch?.[1]) {
    return Number(seasonMatch[1]);
  }
  return null;
}

export function extractEpisodeNumber(title: string): number | null {
  const normalized = String(title || '').toLowerCase();
  const compactMatch = new RegExp(/(?:^|[^a-z0-9])s\d{1,3}e(\d{1,4})(?=[^a-z0-9]|$)/).exec(
    normalized,
  );
  const episodeMatch = compactMatch || normalized.match(/(?:^|[^a-z0-9])e(\d{1,4})(?=[^a-z0-9]|$)/);
  if (episodeMatch?.[1]) {
    return Number(episodeMatch[1]);
  }
  return null;
}

export function getIndexerSettings(userId: number): IndexerSettings | null {
  const raw = getUser(userId)?.settings?.indexer || null;
  if (!raw) {
    return null;
  }
  return {
    url: String(raw.url || ''),
    token: raw.token !== undefined && raw.token !== null ? String(raw.token) : null,
    qualities: Array.isArray(raw.qualities) ? raw.qualities.map(String) : [],
    languages: Array.isArray(raw.languages) ? raw.languages.map(String) : [],
  };
}

export async function configureIndexer(userId: number, settings: IndexerSettings) {
  await checkTorznabConnection(settings).catch((error) => {
    throw new ErrorCode(`Failed to connect to Indexer: ${error.message}`);
  });
  return runInTransaction(async ({ writeStore }) => {
    const user = getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    user.settings.indexer = settings;
    writeStore('user', userId, user);
  });
}

async function parseMovieIndexerResponse(xmlBody: any): Promise<IndexerMovieResult[]> {
  if (!xmlBody.rss?.channel) {
    throw new ErrorCode('Invalid Indexer response format');
  }

  const itemBlocks = xmlBody.rss?.channel?.item || [];

  let results: IndexerMovieResult[] = [];

  for (const block of itemBlocks) {
    const title = block?.title;
    const link = block?.link;
    const guidMatch = block.guid;
    const pubDateMatch = block?.pubDate;
    const attributes = block['torznab:attr'].reduce(
      (acc: Record<string, any>, item: { name: string; value: any }) => {
        acc[item.name] = item.value;
        return acc;
      },
      {},
    );

    results.push({
      title: typeof title === 'string' ? title : '',
      link: typeof link === 'string' ? link : '',
      guid: guidMatch,
      pubDate: typeof pubDateMatch === 'string' ? pubDateMatch : undefined,
      tmdbId: attributes.tmdbid || undefined,
      size: attributes.size ? Number(attributes.size) : undefined,
      sizeHuman: attributes.size ? humanFileSize(Number(attributes.size)) : undefined,
      seeders: attributes.seeders ? Number(attributes.seeders) : undefined,
      leechers: attributes.leechers ? Number(attributes.leechers) : undefined,
      quality: attributes.quality || extractQuality(title) || undefined,
      language: attributes.language || extractLanguage(title) || undefined,
      categories: attributes.categories
        ? String(attributes.categories)
            .split(',')
            .map((s) => s.trim())
        : undefined,
    });
  }

  return results;
}

async function parseSeriesIndexerResponse(xmlBody: any): Promise<IndexerSeriesResult[]> {
  if (!xmlBody.rss?.channel) {
    throw new ErrorCode('Invalid Indexer response format');
  }

  const itemBlocks = xmlBody.rss?.channel?.item || [];

  let results: IndexerSeriesResult[] = [];

  for (const block of itemBlocks) {
    const title = block?.title;
    const link = block?.link;
    const guidMatch = block.guid;
    const pubDateMatch = block?.pubDate;
    const attributes = block['torznab:attr'].reduce(
      (acc: Record<string, any>, item: { name: string; value: any }) => {
        acc[item.name] = item.value;
        return acc;
      },
      {},
    );

    results.push({
      title: typeof title === 'string' ? title : '',
      link: typeof link === 'string' ? link : '',
      guid: guidMatch,
      pubDate: typeof pubDateMatch === 'string' ? pubDateMatch : undefined,
      tmdbId: attributes.tmdbid || undefined,
      size: attributes.size ? Number(attributes.size) : undefined,
      sizeHuman: attributes.size ? humanFileSize(Number(attributes.size)) : undefined,
      seeders: attributes.seeders ? Number(attributes.seeders) : undefined,
      leechers: attributes.leechers ? Number(attributes.leechers) : undefined,
      quality: attributes.quality || extractQuality(title) || undefined,
      language: attributes.language || extractLanguage(title) || undefined,
      categories: attributes.categories
        ? String(attributes.categories)
            .split(',')
            .map((s) => s.trim())
        : undefined,
      seasonNumber: attributes.season
        ? Number(attributes.season)
        : extractSeasonNumber(title) || undefined,
      episodeNumber: attributes.episode
        ? Number(attributes.episode)
        : extractEpisodeNumber(title) || undefined,
    });
  }

  return results;
}

function humanFileSize(size: number): string {
  const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  const humanSize = Number((size / Math.pow(1024, i)).toFixed(2));
  const unit = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][i];
  return `${humanSize} ${unit}`;
}

export async function searchMovieIndexer(
  userId: number,
  movieId: number,
  limit = 100,
  offset = 0,
): Promise<IndexerMovieResult[]> {
  const settings = getIndexerSettings(userId);
  if (!settings) {
    throw new ErrorCode('Indexer settings not found');
  }

  const request = buildDetailsRequest(TmdbType.movie, movieId, {});
  const movie = await proxyTmdb(request.path, request.query);
  if (!movie?.id) {
    throw new ErrorCode('Movie not found in TMDB');
  }
  const name = movie.original_title || movie.title;
  const response = await searchTorznab(settings, name, movieId, limit, offset);
  return await parseMovieIndexerResponse(response);
}

export async function searchSeriesIndexer(
  userId: number,
  seriesId: number,
  limit = 100,
  offset = 0,
  season?: string | number,
): Promise<IndexerSeriesResult[]> {
  const settings = getIndexerSettings(userId);
  if (!settings) {
    throw new ErrorCode('Indexer settings not found');
  }

  const request = buildDetailsRequest(TmdbType.series, seriesId, {});
  const series = await proxyTmdb(request.path, request.query);
  if (!series?.id) {
    throw new ErrorCode('Series not found in TMDB');
  }
  let name = series.original_name || series.name;
  if (season !== undefined) name = name.concat(` ${String(season).padStart(2, '0')}`);
  const response = await searchTorznab(settings, name, seriesId, limit, offset);
  return await parseSeriesIndexerResponse(response);
}

export async function getLastSeries(userId: number): Promise<IndexerSeriesResult[]> {
  const settings = getIndexerSettings(userId);
  if (!settings) {
    throw new ErrorCode('Indexer settings not found');
  }

  const response = await rssTorznab(settings, 'tvsearch');
  return await parseSeriesIndexerResponse(response);
}

export async function getLastMovies(userId: number): Promise<IndexerMovieResult[]> {
  const settings = getIndexerSettings(userId);
  if (!settings) {
    throw new ErrorCode('Indexer settings not found');
  }

  const response = await rssTorznab(settings, 'movie');
  return await parseMovieIndexerResponse(response);
}

export async function getMoviesIndexerResult(userId: number): Promise<IndexerMovieResult[]> {
  const moviesResult = readStore('indexer-movie-result', userId) || [];
  return moviesResult as IndexerMovieResult[];
}
export async function getSeriesIndexerResult(userId: number): Promise<IndexerSeriesResult[]> {
  const seriesResult = readStore('indexer-series-result', userId) || [];
  return seriesResult as IndexerSeriesResult[];
}

export async function rejectIndexerResultByGuid(userId: number, guid: string): Promise<void> {
  const moviesResult: IndexerMovieResult[] = (readStore('indexer-movie-result', userId) ||
    []) as IndexerMovieResult[];
  const seriesResult: IndexerSeriesResult[] = (readStore('indexer-series-result', userId) ||
    []) as IndexerSeriesResult[];

  const rejectedMovie = moviesResult.find((m) => m.guid === guid);
  const rejectedSeries = seriesResult.find((s) => s.guid === guid);

  const filteredMovies = moviesResult.filter((m) => m.guid !== guid);
  const filteredSeries = seriesResult.filter((s) => s.guid !== guid);

  const blacklist: string[] = (readStore('indexer-blacklist', userId) || []) as string[];
  if (rejectedMovie) {
    blacklist.push(`movie:${rejectedMovie.tmdbId}:${guid}`);
  } else if (rejectedSeries) {
    blacklist.push(`series:${rejectedSeries.tmdbId}:${guid}`);
  } else {
    blacklist.push(`unknown:${guid}`);
  }

  runInTransaction(({ writeStore }) => {
    writeStore('indexer-movie-result', userId, filteredMovies);
    writeStore('indexer-series-result', userId, filteredSeries);
    writeStore('indexer-blacklist', userId, blacklist);
  });
}

export async function rejectAllIndexerResultsByGuids(
  userId: number,
  guids: string[],
): Promise<void> {
  for (const guid of guids) {
    await rejectIndexerResultByGuid(userId, guid);
  }
}

// Automated job to search wishlist items in the indexer and update their status
export async function processWishlistIndexer() {
  const users = getUsers();
  for (const user of users) {
    try {
      console.log(`Processing wishlist indexer for user ${user.username}`);
      const wishlist = await getWishlist(user.id);
      const lastMovies = await getLastMovies(user.id);
      const lastSeries = await getLastSeries(user.id);
      const moviesFounds: IndexerMovieResult[] = [];
      const seriesFounds: IndexerSeriesResult[] = [];
      for (const item of wishlist) {
        if (item.type === 'movie') {
          const founds = lastMovies.filter((m) => m.tmdbId === String(item.tmdb));
          if (founds.length > 0) {
            moviesFounds.push(...founds);
          }
        } else if (item.type === 'series') {
          const founds = lastSeries.filter(
            (s) =>
              s.tmdbId === String(item.tmdb) &&
              (item.all_seasons === true ||
                (item.seasons?.[s.seasonNumber || 1] !== undefined &&
                  (item.seasons[s.seasonNumber || 1].all_episodes === true ||
                    (s.episodeNumber !== undefined &&
                      item.seasons[s.seasonNumber || 1].episodes.includes(s.episodeNumber || 1))))),
          );
          if (founds.length > 0) {
            seriesFounds.push(...founds);
          }
        }
      }

      if (moviesFounds.length > 0 || seriesFounds.length > 0) {
        console.log(
          `User ${user.username} has ${moviesFounds.length} movies and ${seriesFounds.length} series found in indexer`,
        );

        await runInTransaction(async ({ writeStore }) => {
          // Read blacklist of movies and series already notified or blacklisted by the user to avoid duplicates
          const blacklist = readStore('indexer-blacklist', user.id) || [];

          // Read current indexer results to avoid notifying about the same release multiple times if it stays in the last results for a while
          const moviesResult = await getMoviesIndexerResult(user.id);
          const seriesResult = await getSeriesIndexerResult(user.id);

          // Create keys for found movies and series to compare with blacklist and current results
          const moviesKey = new Set(moviesResult.map((m) => `movie:${m.tmdbId}:${m.guid}`));
          const seriesKey = new Set(seriesResult.map((s) => `series:${s.tmdbId}:${s.guid}`));

          // Filter found movies and series to only keep those not in blacklist and not already in current results
          const remainingMovies: IndexerMovieResult[] = moviesFounds.filter(
            (m) =>
              !blacklist.includes(`movie:${m.tmdbId}:${m.guid}`) &&
              !moviesKey.has(`movie:${m.tmdbId}:${m.guid}`),
          );
          const remainingSeries: IndexerSeriesResult[] = seriesFounds.filter(
            (s) =>
              !blacklist.includes(`series:${s.tmdbId}:${s.guid}`) &&
              !seriesKey.has(`series:${s.tmdbId}:${s.guid}`),
          );

          if (remainingMovies.length > 0) {
            writeStore('indexer-movie-result', user.id, [...moviesResult, ...remainingMovies]);
          }
          if (remainingSeries.length > 0) {
            writeStore('indexer-series-result', user.id, [...seriesResult, ...remainingSeries]);
          }

          // Notifications pour les nouveaux résultats
          const uniqueMovieTitles = [
            ...new Set(remainingMovies.map((m) => m.title || `Film #${m.tmdbId}`)),
          ];
          const uniqueSeriesTitles = [
            ...new Set(remainingSeries.map((s) => s.title || `Série #${s.tmdbId}`)),
          ];

          if (uniqueMovieTitles.length === 1) {
            addNotification(user.id, {
              title: 'Film disponible',
              message: uniqueMovieTitles[0],
              type: 'search',
              data: { tmdbId: remainingMovies[0].tmdbId, type: 'movie' },
            });
          } else if (uniqueMovieTitles.length > 1) {
            addNotification(user.id, {
              title: `${uniqueMovieTitles.length} nouveaux films disponibles`,
              message:
                uniqueMovieTitles.slice(0, 3).join(', ') +
                (uniqueMovieTitles.length > 3 ? `… (+${uniqueMovieTitles.length - 3})` : ''),
              type: 'search',
              data: { count: uniqueMovieTitles.length, type: 'movie' },
            });
          }

          if (uniqueSeriesTitles.length === 1) {
            addNotification(user.id, {
              title: 'Épisode disponible',
              message: uniqueSeriesTitles[0],
              type: 'search',
              data: { tmdbId: remainingSeries[0].tmdbId, type: 'series' },
            });
          } else if (uniqueSeriesTitles.length > 1) {
            addNotification(user.id, {
              title: `${uniqueSeriesTitles.length} nouveaux épisodes disponibles`,
              message:
                uniqueSeriesTitles.slice(0, 3).join(', ') +
                (uniqueSeriesTitles.length > 3 ? `… (+${uniqueSeriesTitles.length - 3})` : ''),
              type: 'search',
              data: { count: uniqueSeriesTitles.length, type: 'series' },
            });
          }
        });
      }
    } catch (error) {
      console.log(`Error processing wishlist indexer for user ${user.username}: ${error.message}`);
    }
  }
}

setInterval(processWishlistIndexer, 60 * 1000);
setTimeout(processWishlistIndexer, 1000);
