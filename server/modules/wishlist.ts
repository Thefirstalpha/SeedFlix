import { WishListItem, WishListSeasonItem } from '../../common/wishlist';
import { readStore, runInTransaction } from './db';
import { buildDetailsRequest, proxyTmdb, TmdbType } from './tmdb';
import { emitStatusBar } from './events';
import { purgeIndexerResultsForMedia, resetIndexerStateForMedia } from './indexer';

const DB_NAMESPACE = 'wishlist';

export interface DeleteWishlistOptions {
  tmdbId: number;
  type?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  season?: number;
  episode?: number;
}

function parseWishlistSeasons(rawSeasons: unknown): Record<number, WishListSeasonItem> {
  const seasons: Record<number, WishListSeasonItem> = {};
  if (!rawSeasons || typeof rawSeasons !== 'object') {
    return seasons;
  }
  for (const [key, value] of Object.entries(rawSeasons)) {
    const seasonNumber = Number(key);
    if (Number.isNaN(seasonNumber) || typeof value !== 'object' || value === null) {
      continue;
    }
    const seasonObj = value as Record<string, unknown>;
    const all_episodes = Boolean(seasonObj.all_episodes);
    const episodes = Array.isArray(seasonObj.episodes)
      ? seasonObj.episodes.map(Number).filter((num: number) => !Number.isNaN(num))
      : [];
    seasons[seasonNumber] = {
      season_number: seasonNumber,
      all_episodes,
      episodes,
    };
  }
  return seasons;
}

/**
 * Normalise et valide un élément stocké brut en mémoire
 */
function parseWishlistItem(raw: unknown): WishListItem | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const tmdb = Number(item.tmdb);
  let type: 'movie' | 'series' | null = null;
  if (item.type === 'movie') {
    type = 'movie';
  } else if (item.type === 'series') {
    type = 'series';
  }

  const title = typeof item.title === 'string' ? item.title : '';
  const addedAt = typeof item.addedAt === 'string' ? item.addedAt : '';
  const original_title = typeof item.original_title === 'string' ? item.original_title : '';
  const releaseDate = typeof item.releaseDate === 'string' ? item.releaseDate : '';

  if (Number.isNaN(tmdb) || !type || !title || !addedAt || !original_title) {
    return null;
  }

  const genre = typeof item.genre === 'string' ? item.genre : '';
  const rating = typeof item.rating === 'number' ? item.rating : Number(item.rating) || 0;
  const poster_path = typeof item.poster_path === 'string' ? item.poster_path : null;
  const all_seasons = Boolean(item.all_seasons);
  const seasons = parseWishlistSeasons(item.seasons);

  return {
    tmdb,
    type,
    title,
    releaseDate,
    genre,
    rating,
    addedAt,
    poster_path,
    original_title,
    all_seasons,
    seasons,
  };
}

/**
 * Met à jour les saisons et épisodes d'une série
 */
function applySeasonAndEpisode(
  item: WishListItem,
  seasonNumber?: number,
  episodeNumber?: number,
): void {
  if (seasonNumber === undefined) {
    item.all_seasons = true;
    item.seasons = {};
    return;
  }

  item.all_seasons = false;
  if (!item.seasons) {
    item.seasons = {};
  }

  if (episodeNumber === undefined) {
    item.seasons[seasonNumber] = {
      season_number: seasonNumber,
      all_episodes: true,
      episodes: [],
    };
    return;
  }

  const existingSeason = item.seasons[seasonNumber];
  if (!existingSeason) {
    item.seasons[seasonNumber] = {
      season_number: seasonNumber,
      all_episodes: false,
      episodes: [episodeNumber],
    };
  } else if (!existingSeason.all_episodes && !existingSeason.episodes.includes(episodeNumber)) {
    existingSeason.episodes.push(episodeNumber);
    existingSeason.episodes.sort((a, b) => a - b);
  }
}

function deleteSeriesEpisodeOrSeason(
  item: WishListItem,
  seasonNumber: number,
  episodeNumber?: number,
): void {
  if (episodeNumber !== undefined) {
    const season = item.seasons[seasonNumber];
    if (season && !season.all_episodes) {
      season.episodes = season.episodes.filter((ep) => ep !== episodeNumber);
      if (season.episodes.length === 0) {
        delete item.seasons[seasonNumber];
      }
    }
  } else {
    delete item.seasons[seasonNumber];
  }
}

/**
 * Applique la suppression d'un élément ou sous-élément de la wishlist
 */
function processDeletion(wishlist: WishListItem[], target: DeleteWishlistOptions): WishListItem[] {
  const seasonNumber = target.seasonNumber ?? target.season;
  const episodeNumber = target.episodeNumber ?? target.episode;

  if (target.type === 'series' && seasonNumber !== undefined) {
    const item = wishlist.find((i) => i.tmdb === target.tmdbId && i.type === 'series');
    if (item) {
      deleteSeriesEpisodeOrSeason(item, seasonNumber, episodeNumber);
      if (item.seasons && Object.keys(item.seasons).length === 0) {
        return wishlist.filter((i) => !(i.tmdb === target.tmdbId && i.type === 'series'));
      }
    }
    return wishlist;
  }

  return wishlist.filter(
    (i) => !(i.tmdb === target.tmdbId && (!target.type || i.type === target.type)),
  );
}

/**
 * Récupère la wishlist de façon synchrone depuis la base
 */
export function getWishlistSync(userId: number): WishListItem[] {
  const rawList = readStore(DB_NAMESPACE, userId) ?? readStore('whishlist', userId);
  if (!rawList || !Array.isArray(rawList)) {
    return [];
  }
  const result: WishListItem[] = [];
  for (const item of rawList) {
    const parsed = parseWishlistItem(item);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

export async function getWishlist(userId: number): Promise<WishListItem[]> {
  return getWishlistSync(userId);
}

function createWishlistItemFromTmdb(results: any, type: 'movie' | 'series'): WishListItem {
  return {
    tmdb: results.id,
    type,
    title: type === 'movie' ? results.title : results.name,
    releaseDate: (type === 'movie' ? results.release_date : results.first_air_date) || '',
    genre: results.genres?.[0]?.name || '',
    rating: Number(results.vote_average) || 0,
    addedAt: new Date().toISOString(),
    poster_path: results.poster_path !== undefined ? results.poster_path : null,
    original_title: (type === 'movie' ? results.original_title : results.original_name) || '',
    all_seasons: false,
    seasons: {},
  };
}

export async function addToWishlist(
  userId: number,
  tmdbId: number,
  type: 'movie' | 'series',
  seasonNumber?: number,
  episodeNumber?: number,
) {
  const request = buildDetailsRequest(
    type === 'movie' ? TmdbType.movie : TmdbType.series,
    tmdbId,
    {},
  );
  const results = await proxyTmdb(request.path, request.query);

  if (!results?.id) {
    throw new Error('Item not found in TMDB');
  }

  runInTransaction(({ writeStore }) => {
    const wishlist = getWishlistSync(userId);
    let item = wishlist.find(
      (existing: WishListItem) => existing.tmdb === tmdbId && existing.type === type,
    );

    if (!item) {
      item = createWishlistItemFromTmdb(results, type);
      wishlist.push(item);
    }

    if (type === 'series') {
      applySeasonAndEpisode(item, seasonNumber, episodeNumber);
    }

    writeStore(DB_NAMESPACE, userId, wishlist);
  });
  void emitStatusBar(userId);
}

async function fetchSeriesSeasonInfo(
  tmdbId: number,
): Promise<{ seasons: Array<{ season_number: number; episode_count: number }> } | null> {
  try {
    const request = buildDetailsRequest(TmdbType.series, tmdbId, {});
    const data = await proxyTmdb(request.path, request.query);
    if (!data?.seasons || !Array.isArray(data.seasons)) return null;
    return {
      seasons: data.seasons.map((s: any) => ({
        season_number: Number(s.season_number || 0),
        episode_count: Number(s.episode_count || 0),
      })),
    };
  } catch {
    return null;
  }
}

export async function consumeWishlistItemForDownload(
  userId: number,
  guid: string,
  mediaType: 'movie' | 'series',
  options?: { tmdbId?: number; seasonNumber?: number; episodeNumber?: number },
): Promise<void> {
  // 1. Chercher dans les résultats indexer existants pour extraire le tmdbId et la saison/épisode si non fournis
  const moviesResult = (readStore('indexer-movie-result', userId) || []) as Array<any>;
  const seriesResult = (readStore('indexer-series-result', userId) || []) as Array<any>;

  let tmdbId = options?.tmdbId;
  let seasonNumber = options?.seasonNumber;
  let episodeNumber = options?.episodeNumber;

  const matchedMovie = moviesResult.find((m) => m.guid === guid);
  const matchedSeries = seriesResult.find((s) => s.guid === guid);

  if (matchedMovie) {
    tmdbId = Number(matchedMovie.tmdbId || matchedMovie.matchedWishlist?.tmdbId || tmdbId);
  } else if (matchedSeries) {
    tmdbId = Number(matchedSeries.tmdbId || matchedSeries.matchedWishlist?.tmdbId || tmdbId);
    seasonNumber =
      matchedSeries.seasonNumber ?? matchedSeries.matchedWishlist?.seasonNumber ?? seasonNumber;
    episodeNumber =
      matchedSeries.episodeNumber ?? matchedSeries.matchedWishlist?.episodeNumber ?? episodeNumber;
  }

  if (!tmdbId || Number.isNaN(tmdbId)) {
    // Si pas de tmdbId, on purge quand même le guid de l'index
    if (guid) {
      purgeIndexerResultsForMedia(userId, 0, mediaType, seasonNumber, episodeNumber, guid);
    }
    return;
  }

  // 2. Mettre à jour la wishlist de façon atomique
  let seriesInfo: { seasons: Array<{ season_number: number; episode_count: number }> } | null =
    null;
  if (mediaType === 'series') {
    seriesInfo = await fetchSeriesSeasonInfo(tmdbId);
  }

  runInTransaction(({ writeStore }) => {
    let wishlist = getWishlistSync(userId);

    if (mediaType === 'movie') {
      wishlist = wishlist.filter((i) => !(i.tmdb === tmdbId && i.type === 'movie'));
    } else {
      const item = wishlist.find((i) => i.tmdb === tmdbId && i.type === 'series');
      if (item) {
        if (seasonNumber !== undefined && episodeNumber !== undefined) {
          // Cas 1 : Téléchargement d'un épisode spécifique S{seasonNumber}E{episodeNumber}
          if (item.all_seasons === true) {
            item.all_seasons = false;
            item.seasons = {};
            const availableSeasons = seriesInfo?.seasons || [];
            for (const s of availableSeasons) {
              if (s.season_number <= 0) continue;
              if (s.season_number === seasonNumber) {
                const totalEps = s.episode_count || 10;
                const remaining = Array.from({ length: totalEps }, (_, idx) => idx + 1).filter(
                  (ep) => ep !== episodeNumber,
                );
                if (remaining.length > 0) {
                  item.seasons[s.season_number] = {
                    season_number: s.season_number,
                    all_episodes: false,
                    episodes: remaining,
                  };
                }
              } else {
                item.seasons[s.season_number] = {
                  season_number: s.season_number,
                  all_episodes: true,
                  episodes: [],
                };
              }
            }
          } else {
            const season = item.seasons?.[seasonNumber];
            if (season) {
              if (season.all_episodes) {
                const seasonMeta = seriesInfo?.seasons.find(
                  (s) => s.season_number === seasonNumber,
                );
                const totalEps = seasonMeta?.episode_count || 10;
                const remaining = Array.from({ length: totalEps }, (_, idx) => idx + 1).filter(
                  (ep) => ep !== episodeNumber,
                );
                if (remaining.length > 0) {
                  season.all_episodes = false;
                  season.episodes = remaining;
                } else {
                  delete item.seasons[seasonNumber];
                }
              } else {
                season.episodes = season.episodes.filter((ep) => ep !== episodeNumber);
                if (season.episodes.length === 0) {
                  delete item.seasons[seasonNumber];
                }
              }
            }
          }

          if (Object.keys(item.seasons || {}).length === 0) {
            wishlist = wishlist.filter((i) => !(i.tmdb === tmdbId && i.type === 'series'));
          }
        } else if (seasonNumber !== undefined) {
          // Cas 2 : Téléchargement d'un pack saison entier S{seasonNumber}
          if (item.all_seasons === true) {
            item.all_seasons = false;
            item.seasons = {};
            const availableSeasons = seriesInfo?.seasons || [];
            for (const s of availableSeasons) {
              if (s.season_number <= 0 || s.season_number === seasonNumber) continue;
              item.seasons[s.season_number] = {
                season_number: s.season_number,
                all_episodes: true,
                episodes: [],
              };
            }
          } else if (item.seasons?.[seasonNumber]) {
            delete item.seasons[seasonNumber];
          }

          if (Object.keys(item.seasons || {}).length === 0) {
            wishlist = wishlist.filter((i) => !(i.tmdb === tmdbId && i.type === 'series'));
          }
        } else {
          // Cas 3 : Téléchargement de la série complète
          wishlist = wishlist.filter((i) => !(i.tmdb === tmdbId && i.type === 'series'));
        }
      }
    }

    writeStore(DB_NAMESPACE, userId, wishlist);
  });

  // 3. Purger les résultats indexer et blacklister la release téléchargée
  purgeIndexerResultsForMedia(userId, tmdbId, mediaType, seasonNumber, episodeNumber, guid);
  void emitStatusBar(userId);
}

export async function deleteWishlist(
  userId: number,
  tmdbId: number,
  type?: string,
  seasonNumber?: number,
  episodeNumber?: number,
) {
  runInTransaction(({ writeStore }) => {
    let wishlist = getWishlistSync(userId);
    wishlist = processDeletion(wishlist, {
      tmdbId,
      type,
      seasonNumber,
      episodeNumber,
    });
    writeStore(DB_NAMESPACE, userId, wishlist);
  });

  // Réinitialise également l'état des résultats indexer et de la blacklist pour ce média
  resetIndexerStateForMedia(
    userId,
    tmdbId,
    type === 'movie' ? 'movie' : type === 'series' ? 'series' : undefined,
    seasonNumber,
    episodeNumber,
  );
  void emitStatusBar(userId);
}

export async function deleteWishlistItems(userId: number, items: DeleteWishlistOptions[]) {
  if (!items || items.length === 0) {
    return;
  }

  runInTransaction(({ writeStore }) => {
    let wishlist = getWishlistSync(userId);
    for (const item of items) {
      wishlist = processDeletion(wishlist, item);
    }
    writeStore(DB_NAMESPACE, userId, wishlist);
  });

  for (const item of items) {
    resetIndexerStateForMedia(
      userId,
      item.tmdbId,
      item.type === 'movie' ? 'movie' : item.type === 'series' ? 'series' : undefined,
      item.seasonNumber ?? item.season,
      item.episodeNumber ?? item.episode,
    );
  }
  void emitStatusBar(userId);
}
