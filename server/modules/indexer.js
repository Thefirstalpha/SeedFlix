import { readSeriesWishlist, readWishlist } from './wishlist.js';
import { searchTorznabForQuery } from './torznab.js';
import { debugLog } from '../logger.js';
import {
  extractTargetKeyFromIndexerStateKey,
  extractUserKeyFromIndexerStateKey,
} from './indexerStateKey.js';
import { withAuth } from './auth.js';
import { getTranslator } from '../i18n.js';
import { notifyUser } from './notifications.js';
import {
  indexerRejectedStore,
  indexerResultsStore,
  indexerSeenStore,
  runInTransaction,
  usersStore,
} from '../db.js';

const indexerPollIntervalMs = 1000 * 60 * 0.5;
const indexerSeenTtlMs = 1000 * 60 * 60 * 24 * 30;
let indexerPollerStarted = false;

function isLikelyMatch(itemTitle, candidates) {
  const normalizedItem = normalizeMatchText(itemTitle);
  if (!normalizedItem) {
    return false;
  }

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeMatchText(candidate);
    if (!normalizedCandidate || normalizedCandidate.length < 3) {
      return false;
    }

    return (
      normalizedItem.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedItem)
    );
  });
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function detectSeasonEpisodeFromItem(item) {
  const attrs =
    item && typeof item === 'object' && item.attributes && typeof item.attributes === 'object'
      ? item.attributes
      : {};
  const normalizedAttributes = Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [
      String(key || '').toLowerCase(),
      String(value || '').trim(),
    ]),
  );
  const title = String(item?.title || '');

  const seasonFromAttrs =
    parsePositiveNumber(normalizedAttributes.season) ||
    parsePositiveNumber(normalizedAttributes.seasonnum) ||
    parsePositiveNumber(normalizedAttributes.seasonnumber);
  const episodeFromAttrs =
    parsePositiveNumber(normalizedAttributes.episode) ||
    parsePositiveNumber(normalizedAttributes.ep) ||
    parsePositiveNumber(normalizedAttributes.episodenum) ||
    parsePositiveNumber(normalizedAttributes.episodenumber);

  if (seasonFromAttrs || episodeFromAttrs) {
    return {
      seasonNumber: seasonFromAttrs,
      episodeNumber: episodeFromAttrs,
    };
  }

  const episodeMatch =
    title.match(/S(\d{1,2})E(\d{1,3})/i) || title.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (episodeMatch) {
    return {
      seasonNumber: parsePositiveNumber(episodeMatch[1]),
      episodeNumber: parsePositiveNumber(episodeMatch[2]),
    };
  }

  const seasonMatch = title.match(/S(\d{1,2})(?!E)/i) || title.match(/\bSeason[ ._-]?(\d{1,2})\b/i);

  return {
    seasonNumber: seasonMatch?.[1] ? parsePositiveNumber(seasonMatch[1]) : null,
    episodeNumber: null,
  };
}

function buildIndexerStateKey(userKey, targetKey, uniqueItemRef) {
  return `${String(userKey ?? '')}:${String(targetKey || '').trim()}:${String(uniqueItemRef || '').trim()}`;
}

function buildWishlistTargets(movieWishlist, seriesWishlist) {
  const movieTargets = (Array.isArray(movieWishlist) ? movieWishlist : [])
    .filter((item) => Number.isFinite(Number(item?.id)))
    .map((item) => ({
      key: `movie:${Number(item.id)}`,
      type: 'movie',
      title: String(item.title || ''),
      originalTitle: String(item.originalTitle || ''),
      id: Number(item.id),
      label: String(item.title || ''),
    }));

  const dedupSeries = new Map();
  for (const entry of Array.isArray(seriesWishlist) ? seriesWishlist : []) {
    const target = buildSeriesTarget(entry);
    if (!target) {
      continue;
    }

    if (dedupSeries.has(target.key)) {
      continue;
    }

    dedupSeries.set(target.key, target);
  }

  return [...movieTargets, ...dedupSeries.values()];
}

function buildSearchQueryForTarget(target) {
  if (target.type === 'season' && Number.isFinite(target.seasonNumber)) {
    return `${target.title} S${padMediaNumber(target.seasonNumber)}`.trim();
  }

  if (
    target.type === 'episode' &&
    Number.isFinite(target.seasonNumber) &&
    Number.isFinite(target.episodeNumber)
  ) {
    return `${target.title} S${padMediaNumber(target.seasonNumber)}E${padMediaNumber(target.episodeNumber)}`.trim();
  }

  return String(target.title || '').trim();
}

function doesIndexerItemMatchTarget(item, target, candidates) {
  if (!isLikelyMatch(item.title, candidates)) {
    return false;
  }

  if (target.type === 'movie' || target.type === 'series') {
    return true;
  }

  const { seasonNumber, episodeNumber } = detectSeasonEpisodeFromItem(item);
  if (target.type === 'season') {
    return seasonNumber === target.seasonNumber;
  }

  return seasonNumber === target.seasonNumber && episodeNumber === target.episodeNumber;
}

function getIndexerNotificationTitleKey(targetType) {
  switch (targetType) {
    case 'movie':
      return 'notifications.indexerMovieAvailable';
    case 'season':
      return 'notifications.indexerSeasonAvailable';
    case 'episode':
      return 'notifications.indexerEpisodeAvailable';
    default:
      return 'notifications.indexerSeriesAvailable';
  }
}

function pruneIndexerStateEntries(entries, activeTargetKeysByUser, now) {
  const nextEntries = { ...entries };
  let expiredCount = 0;
  let removedTargetCount = 0;

  for (const key of Object.keys(nextEntries)) {
    if (Number(nextEntries[key]) + indexerSeenTtlMs < now) {
      delete nextEntries[key];
      expiredCount += 1;
      continue;
    }

    const targetKey = extractTargetKeyFromIndexerStateKey(key);
    const userKey = extractUserKeyFromIndexerStateKey(key);
    const userActiveTargets = activeTargetKeysByUser[userKey] || new Set();
    if (targetKey && !userActiveTargets.has(targetKey)) {
      delete nextEntries[key];
      removedTargetCount += 1;
    }
  }

  return { nextEntries, expiredCount, removedTargetCount };
}

function pruneIndexerResultsEntries(resultsEntries, activeTargetKeys) {
  const nextResults = { ...resultsEntries };
  let removedTargetCount = 0;

  for (const targetKey of Object.keys(nextResults)) {
    if (!activeTargetKeys.has(targetKey)) {
      delete nextResults[targetKey];
      removedTargetCount += 1;
      continue;
    }

    const bucket = nextResults[targetKey];
    if (!bucket || typeof bucket !== 'object') {
      delete nextResults[targetKey];
      removedTargetCount += 1;
    }
  }

  return { nextResults, removedTargetCount };
}

function upsertIndexerResultsForTarget(userResults, target, actionableItems, now) {
  const targetKey = String(target?.key || '').trim();
  if (!targetKey || !Array.isArray(actionableItems) || actionableItems.length === 0) {
    return userResults;
  }

  const nextUserResults = { ...userResults };
  const existingBucket = nextUserResults[targetKey];
  const existingItems = Array.isArray(existingBucket?.items) ? existingBucket.items : [];
  const byStateKey = new Map(
    existingItems
      .filter((item) => item && typeof item === 'object')
      .map((item) => [String(item.indexerStateKey || ''), item]),
  );

  for (const actionable of actionableItems) {
    const indexerStateKey = String(actionable?.indexerStateKey || '').trim();
    const item = actionable?.item;
    if (!indexerStateKey || !item) {
      continue;
    }

    byStateKey.set(indexerStateKey, {
      indexerStateKey,
      title: String(item.title || ''),
      link: String(item.link || ''),
      downloadUrl: String(item.downloadUrl || item.link || ''),
      guid: item.guid ? String(item.guid) : '',
      pubDate: item.pubDate ? String(item.pubDate) : null,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
      sizeHuman: item.sizeHuman ? String(item.sizeHuman) : null,
      seeders: Number.isFinite(Number(item.seeders)) ? Number(item.seeders) : null,
      leechers: Number.isFinite(Number(item.leechers)) ? Number(item.leechers) : null,
      quality: item.quality ? String(item.quality) : null,
      language: item.language ? String(item.language) : null,
      categories: Array.isArray(item.categories)
        ? item.categories.map((value) => String(value))
        : [],
    });
  }

  nextUserResults[targetKey] = {
    targetKey,
    targetType: String(target.type || ''),
    mediaId: Number.isFinite(Number(target.id)) ? Number(target.id) : null,
    title: String(target.title || ''),
    label: String(target.label || target.title || ''),
    updatedAt: new Date(now).toISOString(),
    items: Array.from(byStateKey.values()),
  };

  return nextUserResults;
}

async function pollIndexerForWishlist() {
  try {
    debugLog('[RSS] Polling cycle started');
    const users = await usersStore.read();
    if (!users.length) {
      debugLog('[RSS] No users found, skipping cycle');
      return;
    }

    const [seen, rejected, indexerResults] = await Promise.all([
      indexerSeenStore.read(),
      indexerRejectedStore.read(),
      indexerResultsStore.read(),
    ]);

    const targetsByUser = {};
    const activeTargetKeysByUser = {};
    let totalTargets = 0;

    for (const user of users) {
      const userStoreKey = user.id;
      if (!userStoreKey) {
        continue;
      }

      const [movieWishlist, seriesWishlist] = await Promise.all([
        readWishlist(String(user?.username || '')),
        readSeriesWishlist(String(user?.username || '')),
      ]);

      const userTargets = buildWishlistTargets(movieWishlist, seriesWishlist);
      targetsByUser[userStoreKey] = userTargets;
      activeTargetKeysByUser[userStoreKey] = new Set(userTargets.map((target) => target.key));
      totalTargets += userTargets.length;
    }

    debugLog('[RSS] Loaded stores', {
      users: users.length,
      totalTargets,
      seenEntries: Object.keys(seen || {}).length,
      rejectedEntries: Object.keys(rejected || {}).length,
      resultsUsers: Object.keys(indexerResults || {}).length,
    });

    const now = Date.now();
    const prunedSeen = pruneIndexerStateEntries(seen, activeTargetKeysByUser, now);
    const prunedRejected = pruneIndexerStateEntries(rejected, activeTargetKeysByUser, now);
    const nextSeen = prunedSeen.nextEntries;
    const nextRejected = prunedRejected.nextEntries;
    const nextIndexerResults = { ...indexerResults };

    if (prunedSeen.expiredCount > 0) {
      debugLog('[RSS] Pruned expired seen entries', { prunedSeenCount: prunedSeen.expiredCount });
    }

    if (prunedSeen.removedTargetCount > 0) {
      debugLog('[RSS] Pruned seen entries for removed wishlist targets', {
        prunedRemovedTargetSeenCount: prunedSeen.removedTargetCount,
      });
    }

    if (prunedRejected.expiredCount > 0) {
      debugLog('[RSS] Pruned expired rejected entries', {
        prunedRejectedCount: prunedRejected.expiredCount,
      });
    }

    if (prunedRejected.removedTargetCount > 0) {
      debugLog('[RSS] Pruned rejected entries for removed wishlist targets', {
        prunedRemovedTargetRejectedCount: prunedRejected.removedTargetCount,
      });
    }

    if (!totalTargets) {
      const clearedIndexerResults = Object.fromEntries(
        Object.keys(nextIndexerResults).map((username) => [username, {}]),
      );
      await Promise.all([
        indexerSeenStore.write(nextSeen),
        indexerRejectedStore.write(nextRejected),
        indexerResultsStore.write(clearedIndexerResults),
      ]);
      debugLog('[RSS] No wishlist targets, skipping cycle', {
        remainingSeenEntries: Object.keys(nextSeen).length,
        remainingRejectedEntries: Object.keys(nextRejected).length,
        remainingResultsUsers: Object.keys(clearedIndexerResults).length,
      });
      return;
    }

    for (const user of users) {
      const username = String(user?.username || 'unknown');
      const userStoreKey = String(user?.id || '').trim();
      const userTargets = Array.isArray(targetsByUser[userStoreKey])
        ? targetsByUser[userStoreKey]
        : [];
      const activeTargetKeys = activeTargetKeysByUser[userStoreKey] || new Set();
      const indexerSettings = user?.settings?.placeholders?.indexer || {};
      const indexerUrl = String(indexerSettings.url || '').trim();
      const indexerToken = String(indexerSettings.token || '').trim();
      if (!indexerUrl || !indexerToken) {
        debugLog('[RSS] User skipped: indexer not configured', { username });
        continue;
      }

      debugLog('[RSS] User polling started', {
        username,
        targetCount: userTargets.length,
      });

      const userResults =
        nextIndexerResults[userStoreKey] && typeof nextIndexerResults[userStoreKey] === 'object'
          ? nextIndexerResults[userStoreKey]
          : {};
      const prunedUserResults = pruneIndexerResultsEntries(userResults, activeTargetKeys);
      nextIndexerResults[userStoreKey] = prunedUserResults.nextResults;

      if (prunedUserResults.removedTargetCount > 0) {
        debugLog('[RSS] Pruned stale indexer result targets', {
          username,
          removedTargetCount: prunedUserResults.removedTargetCount,
        });
      }

      const authLike = { user: { settings: user.settings || {} } };

      for (const target of userTargets) {
        const candidates = [target.title, target.originalTitle].filter(Boolean);
        if (!candidates.length) {
          debugLog('[RSS] Target skipped: no title candidates', {
            username,
            targetKey: target.key,
          });
          continue;
        }

        const query = buildSearchQueryForTarget(target);
        if (!query) {
          debugLog('[RSS] Target skipped: empty query', {
            username,
            targetKey: target.key,
          });
          continue;
        }

        debugLog('[RSS] Querying Torznab', {
          username,
          targetKey: target.key,
          tmdbId: target.id,
          query,
        });

        const result = await searchTorznabForQuery(authLike, query, {
          limit: 8,
          tmdbId: target.id,
        });
        if (!result.ok || !Array.isArray(result.items) || !result.items.length) {
          debugLog('[RSS] No Torznab items for target', {
            username,
            targetKey: target.key,
            ok: result.ok,
            itemCount: Array.isArray(result.items) ? result.items.length : 0,
            message: result.message || null,
          });
          continue;
        }

        debugLog('[RSS] Torznab items received', {
          username,
          targetKey: target.key,
          itemCount: result.items.length,
          sourceTitle: result.sourceTitle || null,
        });

        const matchedItems = result.items.filter((item) =>
          doesIndexerItemMatchTarget(item, target, candidates),
        );
        if (!matchedItems.length) {
          debugLog('[RSS] Items found but no target-specific match', {
            username,
            targetKey: target.key,
            candidates,
          });
          continue;
        }

        const actionableItems = [];
        for (const candidateItem of matchedItems) {
          const uniqueItemRef = String(
            candidateItem.guid || candidateItem.downloadUrl || candidateItem.title || '',
          ).trim();
          if (!uniqueItemRef) {
            debugLog('[RSS] Match skipped: no unique reference', {
              username,
              targetKey: target.key,
            });
            continue;
          }

          const candidateStateKey = buildIndexerStateKey(userStoreKey, target.key, uniqueItemRef);
          if (nextRejected[candidateStateKey]) {
            debugLog('[RSS] Match skipped: rejected', {
              username,
              targetKey: target.key,
              indexerStateKey: candidateStateKey,
            });
            continue;
          }
          if (nextSeen[candidateStateKey]) {
            debugLog('[RSS] Match skipped: already seen', {
              username,
              targetKey: target.key,
              seenKey: candidateStateKey,
            });
            continue;
          }

          actionableItems.push({
            item: candidateItem,
            indexerStateKey: candidateStateKey,
          });
        }

        if (!actionableItems.length) {
          debugLog('[RSS] No actionable match after seen/rejected filtering', {
            username,
            targetKey: target.key,
            matchedItems: matchedItems.length,
          });
          continue;
        }

        const primaryMatch = actionableItems[0].item;
        const primaryIndexerStateKey = actionableItems[0].indexerStateKey;

        const translator = getTranslator(undefined, user);

        nextIndexerResults[userStoreKey] = upsertIndexerResultsForTarget(
          nextIndexerResults[userStoreKey],
          target,
          actionableItems,
          now,
        );

        await notifyUser(user, {
          type: 'search',
          title: translator(getIndexerNotificationTitleKey(target.type)),
          message: translator('notifications.indexerReleaseMessage', {
            title: target.label || target.title,
            count: actionableItems.length,
          }),
          data: {
            source: 'indexer-rss',
            mediaType: target.type,
            mediaId: target.id,
            targetKey: target.key,
            indexerStateKey: primaryIndexerStateKey,
          },
        });

        debugLog('[RSS] Notification created', {
          username,
          targetKey: target.key,
          releaseTitle: primaryMatch.title,
          groupedReleases: actionableItems.length,
        });

        for (const actionable of actionableItems) {
          nextSeen[actionable.indexerStateKey] = now;
        }
      }

      debugLog('[RSS] User polling finished', { username });
    }

    await Promise.all([
      indexerSeenStore.write(nextSeen),
      indexerRejectedStore.write(nextRejected),
      indexerResultsStore.write(nextIndexerResults),
    ]);
    debugLog('[RSS] Polling cycle finished', {
      seenEntries: Object.keys(nextSeen).length,
      rejectedEntries: Object.keys(nextRejected).length,
      resultsUsers: Object.keys(nextIndexerResults).length,
    });
  } catch (error) {
    debugLog('Indexer wishlist polling failed:', error);
  }
}

export function startIndexerWishlistPolling() {
  if (indexerPollerStarted) {
    debugLog('[RSS] Poller already started, skip');
    return;
  }

  indexerPollerStarted = true;
  debugLog('[RSS] Poller started', { indexerPollIntervalMs });
  void pollIndexerForWishlist();
  setInterval(() => {
    void pollIndexerForWishlist();
  }, indexerPollIntervalMs);
}

function buildSeriesTarget(entry) {
  const seriesId = Number(entry?.seriesId);
  if (!Number.isFinite(seriesId)) {
    return null;
  }

  const type = String(entry?.type || 'series');
  const seriesTitle = String(entry?.seriesTitle || '').trim();

  if (type === 'series') {
    return {
      key: `series:${seriesId}`,
      type: 'series',
      title: seriesTitle,
      id: seriesId,
      label: seriesTitle,
    };
  }

  const seasonNumber = Number(entry?.seasonNumber);
  if (!Number.isFinite(seasonNumber)) {
    return null;
  }

  if (type === 'season') {
    const seasonName = String(entry?.seasonName || `Saison ${seasonNumber}`).trim();
    return {
      key: `season:${seriesId}:${seasonNumber}`,
      type: 'season',
      title: seriesTitle,
      id: seriesId,
      seasonNumber,
      label: `${seriesTitle} - ${seasonName}`,
    };
  }

  const episodeNumber = Number(entry?.episodeNumber);
  if (!Number.isFinite(episodeNumber)) {
    return null;
  }

  const episodeName = String(entry?.episodeName || '').trim();
  return {
    key: `episode:${seriesId}:${seasonNumber}:${episodeNumber}`,
    type: 'episode',
    title: seriesTitle,
    id: seriesId,
    seasonNumber,
    episodeNumber,
    label: episodeName
      ? `${seriesTitle} - S${padMediaNumber(seasonNumber)}E${padMediaNumber(episodeNumber)} - ${episodeName}`
      : `${seriesTitle} - S${padMediaNumber(seasonNumber)}E${padMediaNumber(episodeNumber)}`,
  };
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function padMediaNumber(value) {
  return String(Number(value) || 0).padStart(2, '0');
}

export async function getIndexerResultsForUser(userId) {
  const allResults = await indexerResultsStore.read();
  const userKey = String(userId || '').trim();

  const userResults =
    allResults[userKey] && typeof allResults[userKey] === 'object' ? allResults[userKey] : {};

  return Object.values(userResults)
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      targetKey: String(entry.targetKey || ''),
      targetType: String(entry.targetType || ''),
      mediaId: Number.isFinite(Number(entry.mediaId)) ? Number(entry.mediaId) : null,
      title: String(entry.title || ''),
      label: String(entry.label || entry.title || ''),
      updatedAt: String(entry.updatedAt || ''),
      items: Array.isArray(entry.items)
        ? entry.items.map((item) => ({
            ...item,
            indexerStateKey: String(item?.indexerStateKey || ''),
          }))
        : [],
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function updateIndexerResultBucket({
  allResults,
  rejected,
  normalizedUserKey,
  normalizedTargetKey,
  stateKeysToRemove,
  mode,
}) {
  const userResults =
    allResults[normalizedUserKey] && typeof allResults[normalizedUserKey] === 'object'
      ? { ...allResults[normalizedUserKey] }
      : {};
  const bucket =
    userResults[normalizedTargetKey] && typeof userResults[normalizedTargetKey] === 'object'
      ? { ...userResults[normalizedTargetKey] }
      : null;
  if (!bucket || !Array.isArray(bucket.items)) {
    return { ok: false, reason: 'not-found' };
  }
  const removableStateKeys = new Set(stateKeysToRemove);
  const originalLength = bucket.items.length;
  bucket.items = bucket.items.filter(
    (item) => !removableStateKeys.has(String(item?.indexerStateKey || '').trim()),
  );
  if (bucket.items.length === originalLength) {
    return { ok: false, reason: 'not-found' };
  }
  if (bucket.items.length === 0) {
    delete userResults[normalizedTargetKey];
  } else {
    bucket.updatedAt = new Date().toISOString();
    userResults[normalizedTargetKey] = bucket;
  }
  allResults[normalizedUserKey] = userResults;
  if (mode === 'reject') {
    const rejectedAt = Date.now();
    for (const stateKey of removableStateKeys) {
      rejected[stateKey] = rejectedAt;
    }
    indexerRejectedStore.write(rejected);
  }
  indexerResultsStore.write(allResults);
  return { ok: true };
}

async function mutateIndexerResultItem(userId, targetKey, indexerStateKey, mode) {
  const normalizedTargetKey = String(targetKey || '').trim();
  const normalizedStateKey = String(indexerStateKey || '').trim();
  if (!normalizedTargetKey || !normalizedStateKey) {
    return { ok: false, reason: 'invalid-input' };
  }
  const normalizedUserKey = String(userId || '').trim();
  return runInTransaction(async () => {
    const allResults = await indexerResultsStore.read();
    const rejected = await indexerRejectedStore.read();
    return updateIndexerResultBucket({
      allResults,
      rejected,
      normalizedUserKey,
      normalizedTargetKey,
      stateKeysToRemove: [normalizedStateKey],
      mode,
    });
  });
}

async function mutateIndexerResultItemsBatch(userId, targetKey, indexerStateKeys, mode) {
  const normalizedTargetKey = String(targetKey || '').trim();
  const normalizedStateKeys = Array.from(
    new Set(
      (Array.isArray(indexerStateKeys) ? indexerStateKeys : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );
  if (!normalizedTargetKey || normalizedStateKeys.length === 0) {
    return { ok: false, reason: 'invalid-input' };
  }
  const normalizedUserKey = String(userId || '').trim();
  return runInTransaction(async () => {
    const allResults = await indexerResultsStore.read();
    const rejected = await indexerRejectedStore.read();
    return updateIndexerResultBucket({
      allResults,
      rejected,
      normalizedUserKey,
      normalizedTargetKey,
      stateKeysToRemove: normalizedStateKeys,
      mode,
    });
  });
}

// Rejet d'un résultat indexer (single)
export async function rejectIndexerResultItem(userId, targetKey, indexerStateKey) {
  return mutateIndexerResultItem(userId, targetKey, indexerStateKey, 'reject');
}

// Rejet de plusieurs résultats indexer (batch)
export async function rejectIndexerResultItems(userId, targetKey, indexerStateKeys) {
  return mutateIndexerResultItemsBatch(userId, targetKey, indexerStateKeys, 'reject');
}

const getIndexerResultsHandler = withAuth(async (req, res, auth) => {
  try {
    const targets = await getIndexerResultsForUser(String(auth.user?.id));
    res.json({ ok: true, targets });
  } catch (error) {
    console.error('Error getting indexer results:', error);
    res.status(500).json({ error: error.message });
  }
});

const rejectIndexerResultHandler = withAuth(async (req, res, auth) => {
  try {
    const t = getTranslator(req, auth.user);
    const result = await rejectIndexerResultItem(
      String(auth.user?.id),
      req.body?.targetKey,
      req.body?.indexerStateKey,
    );
    if (!result.ok) {
      if (result.reason === 'not-found') {
        return res.status(404).json({ error: t('notifications.notFound') });
      }
      return res.status(400).json({ error: t('notifications.rejectNotSupported') });
    }

    res.json({ ok: true, message: t('notifications.rejected') });
  } catch (error) {
    console.error('Error rejecting indexer result:', error);
    res.status(500).json({ error: error.message });
  }
});

const validateIndexerResultHandler = withAuth(async (req, res, auth) => {
  try {
    const result = await mutateIndexerResultItem(
      String(auth.user?.id),
      req.body?.targetKey,
      req.body?.indexerStateKey,
      'validate',
    );
    if (!result.ok) {
      return res.status(404).json({ error: 'Indexer result not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error validating indexer result:', error);
    res.status(500).json({ error: error.message });
  }
});

const rejectAllIndexerResultHandler = withAuth(async (req, res, auth) => {
  try {
    const t = getTranslator(req, auth.user);
    const result = await rejectIndexerResultItems(
      String(auth.user?.id),
      req.body?.targetKey,
      req.body?.indexerStateKeys,
    );
    if (!result.ok) {
      if (result.reason === 'not-found') {
        return res.status(404).json({ error: t('notifications.notFound') });
      }
      return res.status(400).json({ error: t('notifications.rejectNotSupported') });
    }

    res.json({ ok: true, message: t('notifications.rejected') });
  } catch (error) {
    console.error('Error rejecting all indexer results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enregistrer les routes
export function registerIndexerRoutes(app) {
  app.get('/api/indexer-results', getIndexerResultsHandler);
  app.post('/api/indexer-results/reject', rejectIndexerResultHandler);
  app.post('/api/indexer-results/reject-all', rejectAllIndexerResultHandler);
  app.post('/api/indexer-results/validate', validateIndexerResultHandler);
}
