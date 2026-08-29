import { IndexerMovieResult, IndexerSeriesResult } from '../../common/indexer';
import { IndexerSettings } from '../../common/settings';
import { WishListItem } from '../../common/wishlist';
import { getUsers } from './auth';
import { readStore, runInTransaction } from './db';
import { ErrorCode } from './errors';
import { addNotification } from './notification';
import { readGlobalConfig } from './setting';
import { buildDetailsRequest, proxyTmdb, TmdbType } from './tmdb';
import { checkTorznabConnection, rssTorznab, searchTorznab } from './torznab';
import { getUser } from './user';
import { getWishlist } from './wishlist';

const QUALITY_PATTERNS: Array<{ regex: RegExp; value: string }> = [
  { regex: /(?:^|[\s._\-[\]()])(?:2160p|4k|uhd)(?:$|[\s._\-[\]()])/i, value: '2160p' },
  { regex: /(?:^|[\s._\-[\]()])(?:1080p|1080i)(?:$|[\s._\-[\]()])/i, value: '1080p' },
  { regex: /(?:^|[\s._\-[\]()])(?:720p)(?:$|[\s._\-[\]()])/i, value: '720p' },
  { regex: /(?:^|[\s._\-[\]()])(?:480p|576p|sd)(?:$|[\s._\-[\]()])/i, value: '480p' },
];

const SOURCE_PATTERNS: Array<{ regex: RegExp; value: string }> = [
  { regex: /(?:^|[\s._\-[\]()])(?:web-?dl|web)(?:$|[\s._\-[\]()])/i, value: 'WEB' },
  { regex: /(?:^|[\s._\-[\]()])(?:webrip)(?:$|[\s._\-[\]()])/i, value: 'WEBRip' },
  { regex: /(?:^|[\s._\-[\]()])(?:hdrip)(?:$|[\s._\-[\]()])/i, value: 'HDRip' },
  { regex: /(?:^|[\s._\-[\]()])(?:bdrip|brrip)(?:$|[\s._\-[\]()])/i, value: 'BDRip' },
  { regex: /(?:^|[\s._\-[\]()])(?:dvdrip|dvd)(?:$|[\s._\-[\]()])/i, value: 'DVDRip' },
  { regex: /(?:^|[\s._\-[\]()])(?:hdtv)(?:$|[\s._\-[\]()])/i, value: 'HDTV' },
  { regex: /(?:^|[\s._\-[\]()])(?:sdtv)(?:$|[\s._\-[\]()])/i, value: 'SDTV' },
  { regex: /(?:^|[\s._\-[\]()])(?:bluray|remux)(?:$|[\s._\-[\]()])/i, value: 'BluRay' },
];

const LANGUAGE_PATTERNS: Array<{ regex: RegExp; value: string }> = [
  { regex: /(?:^|[\s._\-[\]()])(?:vostfr|subfrench)(?:$|[\s._\-[\]()])/i, value: 'VOSTFR' },
  { regex: /(?:^|[\s._\-[\]()])(?:truefrench|vff)(?:$|[\s._\-[\]()])/i, value: 'VFF' },
  { regex: /(?:^|[\s._\-[\]()])(?:vf2)(?:$|[\s._\-[\]()])/i, value: 'VF2' },
  { regex: /(?:^|[\s._\-[\]()])(?:vfq)(?:$|[\s._\-[\]()])/i, value: 'VFQ' },
  { regex: /(?:^|[\s._\-[\]()])(?:multi)(?:$|[\s._\-[\]()])/i, value: 'MULTI' },
  { regex: /(?:^|[\s._\-[\]()])(?:french|vf)(?:$|[\s._\-[\]()])/i, value: 'VF' },
  { regex: /(?:^|[\s._\-[\]()])(?:vo|eng|english)(?:$|[\s._\-[\]()])/i, value: 'VO' },
];

export function extractQuality(title: string): string | null {
  const normalized = String(title || '');
  for (const { regex, value } of QUALITY_PATTERNS) {
    if (regex.test(normalized)) {
      return value;
    }
  }
  return null;
}

export function extractSource(title: string): string | null {
  const normalized = String(title || '');
  for (const { regex, value } of SOURCE_PATTERNS) {
    if (regex.test(normalized)) {
      return value;
    }
  }
  return null;
}

export function extractLanguage(title: string): string | null {
  const normalized = String(title || '');
  for (const { regex, value } of LANGUAGE_PATTERNS) {
    if (regex.test(normalized)) {
      return value;
    }
  }
  return null;
}

export function extractSeasonNumber(title: string): number | null {
  const normalized = String(title || '').toLowerCase();

  // 1. Check explicit "saison X" or "season X"
  const textSeasonMatch = new RegExp(/(?:saison|season)[\s._-]?(\d{1,3})(?=[^a-z0-9]|$)/).exec(
    normalized,
  );
  if (textSeasonMatch?.[1]) {
    return Number(textSeasonMatch[1]);
  }

  // 2. Check "S01", "S01E05", "S1"
  const seasonMatch = new RegExp(
    /(?:^|[^a-z0-9])s(\d{1,3})(?=e\d{1,4}|[\s._-]e\d{1,4}|[^a-z0-9]|$)/,
  ).exec(normalized);
  if (seasonMatch?.[1]) {
    return Number(seasonMatch[1]);
  }

  // 3. Check "1x05" (e.g. season 1, episode 5)
  const crossMatch = new RegExp(/(?:^|[^a-z0-9])(\d{1,2})x\d{1,4}(?=[^a-z0-9]|$)/).exec(normalized);
  if (crossMatch?.[1]) {
    return Number(crossMatch[1]);
  }

  return null;
}

export function extractEpisodeNumber(title: string): number | null {
  const normalized = String(title || '').toLowerCase();

  // 1. Check "S01E05" or "S01.E05"
  const compactMatch = new RegExp(/(?:^|[^a-z0-9])s\d{1,3}[\s._-]?e(\d{1,4})(?=[^a-z0-9]|$)/).exec(
    normalized,
  );
  if (compactMatch?.[1]) {
    return Number(compactMatch[1]);
  }

  // 2. Check "1x05"
  const crossMatch = new RegExp(/(?:^|[^a-z0-9])\d{1,2}x(\d{1,4})(?=[^a-z0-9]|$)/).exec(normalized);
  if (crossMatch?.[1]) {
    return Number(crossMatch[1]);
  }

  // 3. Check "Episode 5", "Épisode 5", "Ep.5", "Ep 05"
  const textEpisodeMatch = new RegExp(
    /(?:^|[^a-z0-9])(?:episode|épisode|ep)[\s._-]?(\d{1,4})(?=[^a-z0-9]|$)/,
  ).exec(normalized);
  if (textEpisodeMatch?.[1]) {
    return Number(textEpisodeMatch[1]);
  }

  // 4. Check single "E05"
  const episodeMatch = new RegExp(/(?:^|[^a-z0-9])e(\d{1,4})(?=[^a-z0-9]|$)/).exec(normalized);
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
    autoDownload: Boolean(raw.autoDownload),
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
    const rawAttrs = Array.isArray(block?.['torznab:attr'])
      ? block['torznab:attr']
      : block?.['torznab:attr']
        ? [block['torznab:attr']]
        : [];
    const attributes = rawAttrs.reduce(
      (acc: Record<string, any>, item: { name: string; value: any }) => {
        if (item?.name) acc[item.name] = item.value;
        return acc;
      },
      {},
    );

    results.push({
      title: String(title ?? ''),
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
    const rawAttrs = Array.isArray(block?.['torznab:attr'])
      ? block['torznab:attr']
      : block?.['torznab:attr']
        ? [block['torznab:attr']]
        : [];
    const attributes = rawAttrs.reduce(
      (acc: Record<string, any>, item: { name: string; value: any }) => {
        if (item?.name) acc[item.name] = item.value;
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

async function extractWishlistItemsFromIndexerResults(
  wishlist: WishListItem[],
  indexerMovies: IndexerMovieResult[],
  indexerSeries: IndexerSeriesResult[],
): Promise<{ movies: IndexerMovieResult[]; series: IndexerSeriesResult[] }> {
  const moviesFounds: IndexerMovieResult[] = [];
  const seriesFounds: IndexerSeriesResult[] = [];
  for (const item of wishlist) {
    if (item.type === 'movie') {
      const founds = indexerMovies.filter((m) => String(m.tmdbId) === String(item.tmdb));
      if (founds.length > 0) {
        moviesFounds.push(...founds);
      }
    } else if (item.type === 'series') {
      const founds = indexerSeries.filter(
        (s) =>
          String(s.tmdbId) === String(item.tmdb) &&
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
  return { movies: moviesFounds, series: seriesFounds };
}

// Automated job to search wishlist items in the indexer and update their status
export async function processWishlistIndexer() {
  const users = getUsers();
  for (const user of users) {
    try {
      const wishlist = await getWishlist(user.id);
      if (wishlist.length === 0) {
        continue;
      }
      console.log(`Processing wishlist indexer for user ${user.username}`);
      const lastMovies = await getLastMovies(user.id);
      const lastSeries = await getLastSeries(user.id);
      const { movies: moviesFounds, series: seriesFounds } =
        await extractWishlistItemsFromIndexerResults(wishlist, lastMovies, lastSeries);

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

          // Auto-Download (Auto-Grab) si activé pour l'utilisateur
          const indexerSettings = getIndexerSettings(user.id);
          const autoDownloadEnabled = Boolean(indexerSettings?.autoDownload);
          const autoDownloadedMovieGuids = new Set<string>();
          const autoDownloadedSeriesGuids = new Set<string>();

          if (autoDownloadEnabled) {
            const { startDownload } = await import('./transmission');
            for (const movie of remainingMovies) {
              if (movie.guid) {
                try {
                  await startDownload(user.id, movie.guid, 'movie');
                  autoDownloadedMovieGuids.add(movie.guid);
                } catch (dlErr) {
                  console.log(`Auto-download failed for movie "${movie.title}": ${dlErr}`);
                }
              }
            }
            for (const series of remainingSeries) {
              if (series.guid) {
                try {
                  await startDownload(user.id, series.guid, 'series');
                  autoDownloadedSeriesGuids.add(series.guid);
                } catch (dlErr) {
                  console.log(`Auto-download failed for series "${series.title}": ${dlErr}`);
                }
              }
            }
          }

          // Notifications pour les nouveaux résultats
          const uniqueMovieTitles = [
            ...new Set(remainingMovies.map((m) => m.title || `Film #${m.tmdbId}`)),
          ];
          const uniqueSeriesTitles = [
            ...new Set(remainingSeries.map((s) => s.title || `Série #${s.tmdbId}`)),
          ];

          if (uniqueMovieTitles.length === 1) {
            const isAutoDl = autoDownloadedMovieGuids.has(remainingMovies[0].guid || '');
            addNotification(user.id, {
              title: isAutoDl ? 'Téléchargement automatique lancé' : 'Film disponible',
              message: uniqueMovieTitles[0],
              type: isAutoDl ? 'success' : 'search',
              data: { tmdbId: remainingMovies[0].tmdbId, type: 'movie' },
            });
          } else if (uniqueMovieTitles.length > 1) {
            const autoDlCount = autoDownloadedMovieGuids.size;
            addNotification(user.id, {
              title:
                autoDlCount > 0
                  ? `${autoDlCount} téléchargements automatiques de films lancés`
                  : `${uniqueMovieTitles.length} nouveaux films disponibles`,
              message:
                uniqueMovieTitles.slice(0, 3).join(', ') +
                (uniqueMovieTitles.length > 3 ? `… (+${uniqueMovieTitles.length - 3})` : ''),
              type: autoDlCount > 0 ? 'success' : 'search',
              data: { count: uniqueMovieTitles.length, type: 'movie' },
            });
          }

          if (uniqueSeriesTitles.length === 1) {
            const isAutoDl = autoDownloadedSeriesGuids.has(remainingSeries[0].guid || '');
            addNotification(user.id, {
              title: isAutoDl ? 'Téléchargement automatique lancé' : 'Épisode disponible',
              message: uniqueSeriesTitles[0],
              type: isAutoDl ? 'success' : 'search',
              data: { tmdbId: remainingSeries[0].tmdbId, type: 'series' },
            });
          } else if (uniqueSeriesTitles.length > 1) {
            const autoDlCount = autoDownloadedSeriesGuids.size;
            addNotification(user.id, {
              title:
                autoDlCount > 0
                  ? `${autoDlCount} téléchargements automatiques d'épisodes lancés`
                  : `${uniqueSeriesTitles.length} nouveaux épisodes disponibles`,
              message:
                uniqueSeriesTitles.slice(0, 3).join(', ') +
                (uniqueSeriesTitles.length > 3 ? `… (+${uniqueSeriesTitles.length - 3})` : ''),
              type: autoDlCount > 0 ? 'success' : 'search',
              data: { count: uniqueSeriesTitles.length, type: 'series' },
            });
          }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Error processing wishlist indexer for user ${user.username}: ${message}`);
    }
  }
}

// Process wishlist every 5 minutes to check for new releases in the indexer
let intervalId: NodeJS.Timeout | null = null;

export function updateIndexerProcess() {
  const config = readGlobalConfig();
  if (config.pullAuto) {
    if (!intervalId) {
      console.info('Starting wishlist indexer process...');
      intervalId = setInterval(processWishlistIndexer, 5 * 60 * 1000);
    }
  } else if (intervalId) {
    console.info('Stopping wishlist indexer process...');
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Call updateIndexerProcess on server start to initialize the process based on the current configuration
setTimeout(() => {
  updateIndexerProcess();
}, 1000);
