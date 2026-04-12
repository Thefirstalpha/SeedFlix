import { getTranslator } from '../i18n.js';
import { withAuth } from './auth.js';
import { mutateJsonStore, readJsonStore, writeJsonStore } from '../db.js';
import {
  extractTargetKeyFromIndexerStateKey,
  extractUserKeyFromIndexerStateKey,
} from './indexerStateKey.js';

const wishlistFilePath = 'wishlist.movies';
const seriesWishlistFilePath = 'wishlist.series';
const indexerSeenFilePath = 'indexer.rss.seen';
const indexerRejectedFilePath = 'indexer.rss.rejected';
const indexerResultsFilePath = 'indexer.rss.results';

async function readJsonArrayStore(filePath) {
  const parsed = readJsonStore(filePath, {});

  try {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonArrayStore(filePath, items) {
  writeJsonStore(filePath, items && typeof items === 'object' ? items : {});
}

function normalizeUserStoreKey(userId) {
  return String(userId || '').trim();
}

function normalizeWishlistArray(value) {
  return Array.isArray(value) ? value : [];
}

async function readUserWishlistStore(filePath, userId) {
  const allWishlists = await readJsonArrayStore(filePath);
  const userKey = normalizeUserStoreKey(userId);
  if (!userKey) {
    return [];
  }

  return normalizeWishlistArray(allWishlists[userKey]);
}

async function writeUserWishlistStore(filePath, userId, items) {
  const userKey = normalizeUserStoreKey(userId);
  if (!userKey) {
    return;
  }

  mutateJsonStore(filePath, {}, (allWishlists) => {
    const nextWishlists = allWishlists && typeof allWishlists === 'object' ? allWishlists : {};
    nextWishlists[userKey] = normalizeWishlistArray(items);
    return nextWishlists;
  });
}

async function clearAllUserWishlistStore(filePath) {
  await writeJsonArrayStore(filePath, {});
}

async function readJsonObjectStore(filePath) {
  const parsed = readJsonStore(filePath, {});

  try {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonObjectStore(filePath, value) {
  writeJsonStore(filePath, value && typeof value === 'object' ? value : {});
}

function buildSeriesTargetKey(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const type = String(entry.type || '').trim();
  const seriesId = Number(entry.seriesId);
  if (!Number.isFinite(seriesId)) {
    return null;
  }

  if (type === 'series') {
    return `series:${seriesId}`;
  }

  if (type === 'season') {
    const seasonNumber = Number(entry.seasonNumber);
    return Number.isFinite(seasonNumber) ? `season:${seriesId}:${seasonNumber}` : null;
  }

  if (type === 'episode') {
    const seasonNumber = Number(entry.seasonNumber);
    const episodeNumber = Number(entry.episodeNumber);
    return Number.isFinite(seasonNumber) && Number.isFinite(episodeNumber)
      ? `episode:${seriesId}:${seasonNumber}:${episodeNumber}`
      : null;
  }

  return null;
}

async function purgeIndexerStateStore(filePath, targetKeys, userId) {
  const keys = Array.from(new Set(Array.isArray(targetKeys) ? targetKeys : [])).filter(Boolean);
  if (!keys.length) {
    return 0;
  }

  const wanted = new Set(keys);
  const wantedUserId = normalizeUserStoreKey(userId);
  const stateEntries = await readJsonObjectStore(filePath);
  let removedCount = 0;

  for (const seenKey of Object.keys(stateEntries)) {
    const ownerId = extractUserKeyFromIndexerStateKey(seenKey);
    if (wantedUserId && ownerId !== wantedUserId) {
      continue;
    }

    const targetKey = extractTargetKeyFromIndexerStateKey(seenKey);
    if (targetKey && wanted.has(targetKey)) {
      delete stateEntries[seenKey];
      removedCount += 1;
    }
  }

  if (removedCount > 0) {
    await writeJsonObjectStore(filePath, stateEntries);
  }

  return removedCount;
}

async function purgeIndexerStateForTargetKeys(targetKeys, userId) {
  await Promise.all([
    purgeIndexerStateStore(indexerSeenFilePath, targetKeys, userId),
    purgeIndexerStateStore(indexerRejectedFilePath, targetKeys, userId),
    purgeIndexerResultsStore(indexerResultsFilePath, targetKeys, userId),
  ]);
}

async function purgeIndexerResultsStore(filePath, targetKeys, userId) {
  const keys = Array.from(new Set(Array.isArray(targetKeys) ? targetKeys : [])).filter(Boolean);
  if (!keys.length) {
    return 0;
  }

  const wanted = new Set(keys);
  const wantedUserId = normalizeUserStoreKey(userId);
  const allResults = await readJsonObjectStore(filePath);
  let removedCount = 0;

  for (const username of Object.keys(allResults)) {
    if (wantedUserId && String(username) !== wantedUserId) {
      continue;
    }

    const userResults = allResults[username];
    if (!userResults || typeof userResults !== 'object' || Array.isArray(userResults)) {
      continue;
    }

    for (const targetKey of Object.keys(userResults)) {
      if (wanted.has(targetKey)) {
        delete userResults[targetKey];
        removedCount += 1;
      }
    }

    allResults[username] = userResults;
  }

  if (removedCount > 0) {
    await writeJsonObjectStore(filePath, allResults);
  }

  return removedCount;
}

export async function readWishlist(userId) {
  return readUserWishlistStore(wishlistFilePath, userId);
}

export async function writeWishlist(userId, wishlist) {
  await writeUserWishlistStore(wishlistFilePath, userId, wishlist);
}

export async function readSeriesWishlist(userId) {
  return readUserWishlistStore(seriesWishlistFilePath, userId);
}

export async function writeSeriesWishlist(userId, wishlist) {
  await writeUserWishlistStore(seriesWishlistFilePath, userId, wishlist);
}

export async function resetAllWishlists() {
  await Promise.all([
    clearAllUserWishlistStore(wishlistFilePath),
    clearAllUserWishlistStore(seriesWishlistFilePath),
  ]);
}

function normalizeMovie(movie) {
  if (!movie || typeof movie !== 'object') {
    return null;
  }

  const id = Number(movie.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  return {
    id,
    title: String(movie.title || ''),
    year: Number(movie.year || 0),
    rating: Number(movie.rating || 0),
    genre: String(movie.genre || 'Inconnu'),
    poster: String(movie.poster || ''),
    director: String(movie.director || 'Non disponible'),
    actors: Array.isArray(movie.actors) ? movie.actors.map((actor) => String(actor)) : [],
    plot: String(movie.plot || ''),
    duration: String(movie.duration || 'Non disponible'),
    backdrop: movie.backdrop ? String(movie.backdrop) : undefined,
    originalTitle: movie.originalTitle ? String(movie.originalTitle) : undefined,
    releaseDate: movie.releaseDate ? String(movie.releaseDate) : undefined,
    voteCount: Number.isFinite(Number(movie.voteCount)) ? Number(movie.voteCount) : undefined,
  };
}

function normalizeSeriesEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const validTypes = ['series', 'season', 'episode'];
  const type = String(entry.type || '');
  if (!validTypes.includes(type)) {
    return null;
  }

  const seriesId = Number(entry.seriesId);
  if (!Number.isFinite(seriesId)) {
    return null;
  }

  const normalized = {
    type,
    seriesId,
    seriesTitle: String(entry.seriesTitle || ''),
    seriesPoster: String(entry.seriesPoster || ''),
    year: Number(entry.year || 0),
    rating: Number(entry.rating || 0),
    genre: String(entry.genre || 'Inconnu'),
  };

  if (type === 'season' || type === 'episode') {
    const seasonNumber = Number(entry.seasonNumber);
    if (!Number.isFinite(seasonNumber)) {
      return null;
    }

    normalized.seasonNumber = seasonNumber;
    normalized.seasonName = String(entry.seasonName || `Saison ${seasonNumber}`);
  }

  if (type === 'episode') {
    const episodeNumber = Number(entry.episodeNumber);
    if (!Number.isFinite(episodeNumber)) {
      return null;
    }

    normalized.episodeNumber = episodeNumber;
    normalized.episodeName = String(entry.episodeName || '');
  }

  if (type === 'series') {
    normalized.entryId = `series_${seriesId}`;
  } else if (type === 'season') {
    normalized.entryId = `season_${seriesId}_${normalized.seasonNumber}`;
  } else {
    normalized.entryId = `episode_${seriesId}_${normalized.seasonNumber}_${normalized.episodeNumber}`;
  }

  return normalized;
}

export function registerWishlistRoutes(app) {
  app.get(
    '/api/wishlist',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const wishlist = await readWishlist(userKey);
        res.json(wishlist);
      } catch (error) {
        console.error('Read wishlist failed:', error);
        res.status(500).json({ error: t('wishlist.readWishlistFailed') });
      }
    }),
  );

  app.post(
    '/api/wishlist',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const movie = normalizeMovie(req.body);
        if (!movie) {
          res.status(400).json({ error: t('wishlist.invalidMoviePayload') });
          return;
        }

        const wishlist = await readWishlist(userKey);
        const alreadyExists = wishlist.some((item) => item.id === movie.id);
        if (!alreadyExists) {
          wishlist.push(movie);
          await writeWishlist(userKey, wishlist);
        }

        res.status(201).json({ ok: true, exists: alreadyExists });
      } catch (error) {
        console.error('Add wishlist movie failed:', error);
        res.status(500).json({ error: t('wishlist.addMovieFailed') });
      }
    }),
  );

  app.delete(
    '/api/wishlist/:id',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const indexerUserKey = String(auth.user.id || '');
        const movieId = Number(req.params.id);
        if (!Number.isFinite(movieId)) {
          res.status(400).json({ error: t('wishlist.invalidMovieId') });
          return;
        }

        const wishlist = await readWishlist(userKey);
        const updatedWishlist = wishlist.filter((movie) => movie.id !== movieId);
        await writeWishlist(userKey, updatedWishlist);

        if (updatedWishlist.length !== wishlist.length) {
          await purgeIndexerStateForTargetKeys([`movie:${movieId}`], indexerUserKey);
        }

        res.json({ ok: true });
      } catch (error) {
        console.error('Remove wishlist movie failed:', error);
        res.status(500).json({ error: t('wishlist.removeMovieFailed') });
      }
    }),
  );

  app.delete(
    '/api/wishlist',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const indexerUserKey = String(auth.user.id || '');
        const ids = Array.isArray(req.body?.ids)
          ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
          : [];

        const idsSet = new Set(ids);
        const wishlist = await readWishlist(userKey);
        const updatedWishlist = wishlist.filter((movie) => !idsSet.has(movie.id));
        await writeWishlist(userKey, updatedWishlist);

        const removedMovieTargetKeys = wishlist
          .filter((movie) => idsSet.has(movie.id))
          .map((movie) => `movie:${movie.id}`);
        await purgeIndexerStateForTargetKeys(removedMovieTargetKeys, indexerUserKey);

        res.json({ ok: true });
      } catch (error) {
        console.error('Remove multiple wishlist movies failed:', error);
        res.status(500).json({ error: t('wishlist.removeMoviesFailed') });
      }
    }),
  );

  app.get(
    '/api/wishlist/:id',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const movieId = Number(req.params.id);
        if (!Number.isFinite(movieId)) {
          res.status(400).json({ error: t('wishlist.invalidMovieId') });
          return;
        }

        const wishlist = await readWishlist(userKey);
        const exists = wishlist.some((movie) => movie.id === movieId);
        res.json({ exists });
      } catch (error) {
        console.error('Check wishlist movie failed:', error);
        res.status(500).json({ error: t('wishlist.checkMovieFailed') });
      }
    }),
  );

  app.get(
    '/api/series-wishlist',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const wishlist = await readSeriesWishlist(userKey);
        res.json(wishlist);
      } catch (error) {
        console.error('Read series wishlist failed:', error);
        res.status(500).json({ error: t('wishlist.readSeriesWishlistFailed') });
      }
    }),
  );

  app.get(
    '/api/series-wishlist/series/:seriesId/status',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const seriesId = Number(req.params.seriesId);
        if (!Number.isFinite(seriesId)) {
          res.status(400).json({ error: t('wishlist.invalidSeriesId') });
          return;
        }

        const wishlist = await readSeriesWishlist(userKey);
        const entries = wishlist.filter((entry) => entry.seriesId === seriesId);

        res.json({
          seriesInWishlist: entries.some((entry) => entry.type === 'series'),
          seasonsInWishlist: entries
            .filter((entry) => entry.type === 'season')
            .map((entry) => entry.seasonNumber),
          episodesInWishlist: entries
            .filter((entry) => entry.type === 'episode')
            .map((entry) => ({
              seasonNumber: entry.seasonNumber,
              episodeNumber: entry.episodeNumber,
            })),
        });
      } catch (error) {
        console.error('Series wishlist status failed:', error);
        res.status(500).json({ error: t('wishlist.getSeriesStatusFailed') });
      }
    }),
  );

  app.post(
    '/api/series-wishlist',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const entry = normalizeSeriesEntry(req.body);
        if (!entry) {
          res.status(400).json({ error: t('wishlist.invalidSeriesPayload') });
          return;
        }

        let wishlist = await readSeriesWishlist(userKey);

        if (entry.type === 'series') {
          wishlist = wishlist.filter((item) => item.seriesId !== entry.seriesId);
          wishlist.push(entry);
        } else if (entry.type === 'season') {
          wishlist = wishlist.filter(
            (item) =>
              !(
                item.seriesId === entry.seriesId &&
                item.type === 'episode' &&
                item.seasonNumber === entry.seasonNumber
              ),
          );

          const coveringSeriesExists = wishlist.some(
            (item) => item.seriesId === entry.seriesId && item.type === 'series',
          );

          if (!coveringSeriesExists) {
            wishlist = wishlist.filter((item) => item.entryId !== entry.entryId);
            wishlist.push(entry);
          }
        } else {
          const covered = wishlist.some(
            (item) =>
              item.seriesId === entry.seriesId &&
              (item.type === 'series' ||
                (item.type === 'season' && item.seasonNumber === entry.seasonNumber)),
          );

          if (!covered) {
            wishlist = wishlist.filter((item) => item.entryId !== entry.entryId);
            wishlist.push(entry);
          }
        }

        await writeSeriesWishlist(userKey, wishlist);
        res.status(201).json({ ok: true });
      } catch (error) {
        console.error('Add series wishlist entry failed:', error);
        res.status(500).json({ error: t('wishlist.addSeriesFailed') });
      }
    }),
  );

  app.delete(
    '/api/series-wishlist/entry/:entryId',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const indexerUserKey = String(auth.user.id || '');
        const entryId = req.params.entryId;
        const wishlist = await readSeriesWishlist(userKey);
        const removedEntry = wishlist.find((entry) => entry.entryId === entryId);
        const updated = wishlist.filter((entry) => entry.entryId !== entryId);
        await writeSeriesWishlist(userKey, updated);

        if (removedEntry) {
          const removedTargetKey = buildSeriesTargetKey(removedEntry);
          const updatedTargetKeys = new Set(
            updated.map((entry) => buildSeriesTargetKey(entry)).filter(Boolean),
          );
          if (removedTargetKey && !updatedTargetKeys.has(removedTargetKey)) {
            await purgeIndexerStateForTargetKeys([removedTargetKey], indexerUserKey);
          }
        }

        res.json({ ok: true });
      } catch (error) {
        console.error('Remove series wishlist entry failed:', error);
        res.status(500).json({ error: t('wishlist.removeSeriesEntryFailed') });
      }
    }),
  );

  app.delete(
    '/api/series-wishlist/bulk',
    withAuth(async (req, res, auth) => {
      const t = getTranslator(req);
      try {
        const userKey = auth.user.username;
        const indexerUserKey = String(auth.user.id || '');
        const entryIds = Array.isArray(req.body?.entryIds)
          ? req.body.entryIds.map((id) => String(id))
          : [];
        const entryIdsSet = new Set(entryIds);
        const wishlist = await readSeriesWishlist(userKey);
        const removedEntries = wishlist.filter((entry) => entryIdsSet.has(entry.entryId));
        const updated = wishlist.filter((entry) => !entryIdsSet.has(entry.entryId));
        await writeSeriesWishlist(userKey, updated);

        const updatedTargetKeys = new Set(
          updated.map((entry) => buildSeriesTargetKey(entry)).filter(Boolean),
        );
        const removedTargetKeys = Array.from(
          new Set(
            removedEntries
              .map((entry) => buildSeriesTargetKey(entry))
              .filter(Boolean)
              .filter((targetKey) => !updatedTargetKeys.has(targetKey)),
          ),
        );

        await purgeIndexerStateForTargetKeys(removedTargetKeys, indexerUserKey);

        res.json({ ok: true });
      } catch (error) {
        console.error('Bulk remove series wishlist entries failed:', error);
        res.status(500).json({ error: t('wishlist.removeSeriesEntriesFailed') });
      }
    }),
  );
}
