import { WishListItem, WishListSeasonItem } from '../../common/wishlist';
import { readStore, runInTransaction } from './db';
import { buildDetailsRequest, proxyTmdb, TmdbType } from './tmdb';

const DB_NAMESPACE = 'whishlist';

export interface DeleteWishlistOptions {
  tmdbId: number;
  type?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  season?: number;
  episode?: number;
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

  const title = String(item.title || '');
  const addedAt = String(item.addedAt || '');
  const original_title = String(item.original_title || '');
  const releaseDate = String(item.releaseDate || '');

  if (Number.isNaN(tmdb) || !type || !title || !addedAt || !original_title) {
    return null;
  }

  const genre = String(item.genre || '');
  const rating = Number(item.rating || 0);
  const poster_path =
    item.poster_path !== undefined && item.poster_path !== null ? String(item.poster_path) : null;
  const all_seasons = Boolean(item.all_seasons);

  const seasons: Record<number, WishListSeasonItem> = {};
  if (item.seasons && typeof item.seasons === 'object') {
    for (const [key, value] of Object.entries(item.seasons)) {
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
  }

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

/**
 * Applique la suppression d'un élément ou sous-élément de la wishlist
 */
function processDeletion(wishlist: WishListItem[], target: DeleteWishlistOptions): WishListItem[] {
  const seasonNumber = target.seasonNumber ?? target.season;
  const episodeNumber = target.episodeNumber ?? target.episode;

  if (target.type === 'series' && (seasonNumber !== undefined || episodeNumber !== undefined)) {
    const item = wishlist.find((i) => i.tmdb === target.tmdbId && i.type === 'series');
    if (item) {
      if (seasonNumber !== undefined) {
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

        if (item.seasons && Object.keys(item.seasons).length === 0) {
          return wishlist.filter((i) => !(i.tmdb === target.tmdbId && i.type === 'series'));
        }
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
  const rawList = readStore(DB_NAMESPACE, userId);
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

    if (item) {
      if (type === 'series') {
        applySeasonAndEpisode(item, seasonNumber, episodeNumber);
      }
    } else {
      item = {
        tmdb: results.id,
        type,
        title: type === 'movie' ? results.title : results.name,
        releaseDate: (type === 'movie' ? results.release_date : results.first_air_date) || '',
        genre: results.genres && results.genres.length > 0 ? results.genres[0].name : '',
        rating: Number(results.vote_average) || 0,
        addedAt: new Date().toISOString(),
        poster_path: results.poster_path !== undefined ? results.poster_path : null,
        original_title: (type === 'movie' ? results.original_title : results.original_name) || '',
        all_seasons: false,
        seasons: {},
      };

      if (type === 'series') {
        applySeasonAndEpisode(item, seasonNumber, episodeNumber);
      }
      wishlist.push(item);
    }

    writeStore(DB_NAMESPACE, userId, wishlist);
  });
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
}
