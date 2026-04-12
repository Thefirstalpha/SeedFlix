// Compte le nombre de notifications non lues pour un utilisateur
export async function getUnreadCount(userId) {
  const userKey = userStoreKey(userId);
  if (!userKey) return 0;
  const notifications = await loadNotifications();
  const userNotifications = Array.isArray(notifications[userKey]) ? notifications[userKey] : [];
  return userNotifications.filter((n) => !n.isRead).length;
}
// Envoi d'une notification à un webhook Discord
export async function sendDiscordNotification(webhookUrl, notification) {
  if (!webhookUrl || typeof webhookUrl !== 'string') return null;
  try {
    const embed = {
      title: notification.title || '',
      description: notification.message || '',
      color:
        notification.type === 'error'
          ? 0xef4444
          : notification.type === 'success'
            ? 0x10b981
            : notification.type === 'warning'
              ? 0xf59e0b
              : 0x3b82f6,
      timestamp: new Date().toISOString(),
      fields: [],
    };
    if (
      notification.data &&
      notification.data.details &&
      typeof notification.data.details === 'object'
    ) {
      Object.entries(notification.data.details).forEach(([key, value]) => {
        embed.fields.push({
          name: key,
          value: String(value),
          inline: true,
        });
      });
    }
    const payload = { embeds: [embed] };
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok ? { success: true } : null;
  } catch (error) {
    console.error('Error sending Discord notification:', error.message);
    return null;
  }
}
import { withAuth } from './auth.js';
import { readSeriesWishlist, readWishlist } from './wishlist.js';
import { searchTorznabForQuery } from './torznab.js';
import { debugLog } from '../logger.js';
import { getTranslator } from '../i18n.js';
import {
  mutateJsonStore,
  readJsonStore,
  runInTransaction,
  writeJsonStore as writeJsonStoreDb,
} from '../db.js';
import {
  extractTargetKeyFromIndexerStateKey,
  extractUserKeyFromIndexerStateKey,
} from './indexerStateKey.js';

const usersFilePath = 'auth.users';
const notificationsFilePath = 'notifications.items';
const indexerSeenFilePath = 'indexer.rss.seen';
const indexerRejectedFilePath = 'indexer.rss.rejected';
const indexerResultsFilePath = 'indexer.rss.results';

// Fabrique utilitaire pour générer des fonctions read/write typées
function createJsonStoreAccessors(filePath, fallback) {
  return {
    read: async () => readJsonStoreTyped(filePath, fallback),
    write: async (value) => writeJsonStoreTyped(filePath, value),
  };
}

const usersStore = createJsonStoreAccessors(usersFilePath, []);
const indexerSeenStore = createJsonStoreAccessors(indexerSeenFilePath, {});
const indexerRejectedStore = createJsonStoreAccessors(indexerRejectedFilePath, {});
const indexerResultsStore = createJsonStoreAccessors(indexerResultsFilePath, {});
const notificationsStore = createJsonStoreAccessors(notificationsFilePath, {});
const indexerPollIntervalMs = 1000 * 60 * 0.5;
const indexerSeenTtlMs = 1000 * 60 * 60 * 24 * 30;
let indexerPollerStarted = false;

function readJsonStoreTyped(filePath, fallback) {
  const parsed = readJsonStore(filePath, fallback);
  if (Array.isArray(fallback)) {
    return Array.isArray(parsed) ? parsed : fallback;
  }
  if (typeof fallback === 'object' && fallback !== null) {
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  }
  return fallback;
}

function writeJsonStoreTyped(filePath, value) {
  writeJsonStoreDb(filePath, value);
}

async function readUsers() {
  return usersStore.read();
}
async function readIndexerSeen() {
  return indexerSeenStore.read();
}
async function writeIndexerSeen(entries) {
  return indexerSeenStore.write(entries);
}
async function readIndexerRejected() {
  return indexerRejectedStore.read();
}
async function writeIndexerRejected(entries) {
  return indexerRejectedStore.write(entries);
}
async function readIndexerResults() {
  return indexerResultsStore.read();
}
async function writeIndexerResults(entries) {
  return indexerResultsStore.write(entries);
}
async function loadNotifications() {
  return notificationsStore.read();
}

function normalizeMatchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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

function padMediaNumber(value) {
  return String(Number(value) || 0).padStart(2, '0');
}

function buildIndexerStateKey(userKey, targetKey, uniqueItemRef) {
  return `${String(userKey ?? '')}:${String(targetKey || '').trim()}:${String(uniqueItemRef || '').trim()}`;
}

function userStoreKey(userId) {
  if (userId === null || userId === undefined) {
    return '';
  }

  return String(userId);
}

function resolveNotificationUserKey(user) {
  return userStoreKey(user?.id);
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

function getUserDiscordWebhook(user) {
  const notifSettings = user?.settings?.placeholders?.notifications || {};
  const enabledChannels = Array.isArray(notifSettings.enabledChannels)
    ? notifSettings.enabledChannels
    : [];

  if (!enabledChannels.includes('discord')) {
    return '';
  }

  return String(notifSettings?.discord?.webhookUrl || '').trim();
}

function isSpoilerModeEnabled(user) {
  return Boolean(user?.settings?.placeholders?.preferences?.spoilerMode);
}

function maskEpisodeLabel(value) {
  return String(value || '').replace(/(S\d{1,2}E\d{1,2})(?:\s*[-–]\s*[^:\n]+)?/i, '$1');
}

function buildExternalNotificationPayload(user, notification) {
  if (!isSpoilerModeEnabled(user) || String(notification?.data?.mediaType || '') !== 'episode') {
    return notification;
  }

  return {
    ...notification,
    message: maskEpisodeLabel(notification?.message),
  };
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

async function notifyUser(user, notification) {
  const userId = resolveNotificationUserKey(user);
  if (!userId) {
    return;
  }

  await addNotification(userId, notification);

  const webhookUrl = getUserDiscordWebhook(user);
  if (webhookUrl) {
    const externalNotification = buildExternalNotificationPayload(user, notification);
    await sendDiscordNotification(webhookUrl, externalNotification);
  }
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
    const users = await readUsers();
    if (!users.length) {
      debugLog('[RSS] No users found, skipping cycle');
      return;
    }

    const [seen, rejected, indexerResults] = await Promise.all([
      readIndexerSeen(),
      readIndexerRejected(),
      readIndexerResults(),
    ]);

    const targetsByUser = {};
    const activeTargetKeysByUser = {};
    let totalTargets = 0;

    for (const user of users) {
      const userStoreKey = resolveNotificationUserKey(user);
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
        writeIndexerSeen(nextSeen),
        writeIndexerRejected(nextRejected),
        writeIndexerResults(clearedIndexerResults),
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
      const userStoreKey = resolveNotificationUserKey(user);
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
        const releasesPreview = actionableItems
          .slice(0, 6)
          .map(({ item }) => String(item.title || '').trim())
          .filter(Boolean);

        const details = {};
        if (primaryMatch.quality) {
          details.Qualite = primaryMatch.quality;
        }
        if (primaryMatch.language) {
          details.Langue = primaryMatch.language;
        }
        if (primaryMatch.sizeHuman) {
          details.Taille = primaryMatch.sizeHuman;
        }
        if (Number.isFinite(primaryMatch.seeders || NaN)) {
          details.Seeders = primaryMatch.seeders;
        }
        if (actionableItems.length > 1) {
          details.Resultats = actionableItems.length;
        }

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
            indexerItem: {
              title: primaryMatch.title,
              downloadUrl: primaryMatch.downloadUrl || primaryMatch.link || '',
              pubDate: primaryMatch.pubDate || null,
            },
            indexerItems: actionableItems.map(({ item, indexerStateKey }) => ({
              title: item.title,
              downloadUrl: item.downloadUrl || item.link || '',
              pubDate: item.pubDate || null,
              indexerStateKey,
            })),
            indexerItemsPreview: releasesPreview,
            details,
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
      writeIndexerSeen(nextSeen),
      writeIndexerRejected(nextRejected),
      writeIndexerResults(nextIndexerResults),
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

function startIndexerWishlistPolling() {
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

// Ajouter une notification
export async function addNotification(userId, notification) {
  const userKey = userStoreKey(userId);
  if (!userKey) {
    return null;
  }

  const id = Date.now().toString();
  const notif = {
    id,
    title: notification.title,
    message: notification.message,
    type: notification.type || 'info',
    createdAt: new Date().toISOString(),
    isRead: false,
    data: notification.data || {},
  };

  mutateJsonStore(notificationsFilePath, {}, (notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (!Array.isArray(nextNotifications[userKey])) {
      nextNotifications[userKey] = [];
    }
    nextNotifications[userKey].push(notif);
    return nextNotifications;
  });

  return notif;
}

// Obtenir les notifications d'un utilisateur
export async function getNotifications(userId, options = {}) {
  const notifications = await loadNotifications();
  const userKey = userStoreKey(userId);

  let userNotifs = [];
  if (Array.isArray(notifications[userKey])) {
    userNotifs = [...notifications[userKey]];
  }

  if (options.unreadOnly) {
    userNotifs = userNotifs.filter((n) => !n.isRead);
  }

  userNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (options.limit) {
    userNotifs = userNotifs.slice(0, options.limit);
  }

  return userNotifs;
}

// Marquer comme lue
export async function markAsRead(userId, notificationId) {
  const userKey = userStoreKey(userId);
  let updatedNotification = null;

  mutateJsonStore(notificationsFilePath, {}, (notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (!Array.isArray(nextNotifications[userKey])) {
      return nextNotifications;
    }

    const notif = nextNotifications[userKey].find((n) => n.id === notificationId);
    if (!notif) {
      return nextNotifications;
    }

    notif.isRead = true;
    updatedNotification = notif;
    return nextNotifications;
  });

  return updatedNotification;
}

// Marquer toutes comme lues
export async function markAllAsRead(userId) {
  const userKey = userStoreKey(userId);
  mutateJsonStore(notificationsFilePath, {}, (notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (!Array.isArray(nextNotifications[userKey])) {
      return nextNotifications;
    }

    nextNotifications[userKey].forEach((n) => {
      n.isRead = true;
    });
    return nextNotifications;
  });
}

export async function deleteNotification(userId, notificationId) {
  const userKey = userStoreKey(userId);
  let wasDeleted = false;

  mutateJsonStore(notificationsFilePath, {}, (notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (!Array.isArray(nextNotifications[userKey])) {
      return nextNotifications;
    }

    const beforeCount = nextNotifications[userKey].length;
    nextNotifications[userKey] = nextNotifications[userKey].filter((n) => n.id !== notificationId);
    wasDeleted = nextNotifications[userKey].length !== beforeCount;
    return nextNotifications;
  });

  return wasDeleted;
}

// Vider toutes les notifications d'un utilisateur
export async function clearNotifications(userId) {
  const userKey = userStoreKey(userId);
  mutateJsonStore(notificationsFilePath, {}, (notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (Array.isArray(nextNotifications[userKey])) {
      nextNotifications[userKey] = [];
    }
    return nextNotifications;
  });
}

export async function getIndexerResultsForUser(userId) {
  const allResults = await readIndexerResults();
  const userKey = userStoreKey(userId);

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
  tx,
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
    tx.writeJson(indexerRejectedFilePath, rejected);
  }
  tx.writeJson(indexerResultsFilePath, allResults);
  return { ok: true };
}

// Validation d'un résultat indexer (retire du bucket sans rejet)
export async function validateIndexerResultItem(userId, targetKey, indexerStateKey) {
  const normalizedTargetKey = String(targetKey || '').trim();
  const normalizedStateKey = String(indexerStateKey || '').trim();
  if (!normalizedTargetKey || !normalizedStateKey) {
    return { ok: false, reason: 'invalid-input' };
  }
  const normalizedUserKey = userStoreKey(userId);
  return runInTransaction((tx) => {
    const allResults = tx.readJson(indexerResultsFilePath, {});
    const rejected = tx.readJson(indexerRejectedFilePath, {});
    return updateIndexerResultBucket({
      tx,
      allResults,
      rejected,
      normalizedUserKey,
      normalizedTargetKey,
      stateKeysToRemove: [normalizedStateKey],
      mode: 'validate',
    });
  });
}

async function mutateIndexerResultItem(userId, targetKey, indexerStateKey, mode) {
  const normalizedTargetKey = String(targetKey || '').trim();
  const normalizedStateKey = String(indexerStateKey || '').trim();
  if (!normalizedTargetKey || !normalizedStateKey) {
    return { ok: false, reason: 'invalid-input' };
  }
  const normalizedUserKey = userStoreKey(userId);
  return runInTransaction((tx) => {
    const allResults = tx.readJson(indexerResultsFilePath, {});
    const rejected = tx.readJson(indexerRejectedFilePath, {});
    return updateIndexerResultBucket({
      tx,
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
  const normalizedUserKey = userStoreKey(userId);
  return runInTransaction((tx) => {
    const allResults = tx.readJson(indexerResultsFilePath, {});
    const rejected = tx.readJson(indexerRejectedFilePath, {});
    return updateIndexerResultBucket({
      tx,
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

// Enregistrer les routes
export function registerNotificationRoutes(app) {
  startIndexerWishlistPolling();

  // Notification de test (interne + Discord si configuré)
  app.post(
    '/api/notifications/test',
    withAuth(async (req, res, auth) => {
      try {
        const t = getTranslator(req, auth.user);

        const notification = {
          type: 'info',
          title: t('notifications.testTitle'),
          message: t('notifications.testMessage'),
          data: {
            source: 'manual-test',
            details: {
              [t('notifications.testChannelLabel')]: t('notifications.testChannel'),
              [t('notifications.testTimestamp')]: new Date().toLocaleString(
                auth.user?.settings?.placeholders?.preferences?.language === 'fr'
                  ? 'fr-FR'
                  : 'en-US',
              ),
            },
          },
        };

        await notifyUser(auth.user, notification);
        res.json({ ok: true, message: t('notifications.testSent') });
      } catch (error) {
        const t = getTranslator(req);
        console.error('Error sending test notification:', error);
        res.status(500).json({ error: error.message || t('notifications.testFailed') });
      }
    }),
  );

  // Récupérer les notifications
  app.get(
    '/api/notifications',
    withAuth(async (req, res, auth) => {
      try {
        const userId = resolveNotificationUserKey(auth.user);
        const limit = parseInt(req.query.limit) || 50;
        const unreadOnly = req.query.unreadOnly === 'true';

        const notifications = await getNotifications(userId, {
          limit,
          unreadOnly,
        });
        const unreadCount = await getUnreadCount(userId);

        res.json({ notifications, unreadCount });
      } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: error.message });
      }
    }),
  );

  const getIndexerResultsHandler = withAuth(async (req, res, auth) => {
    try {
      const targets = await getIndexerResultsForUser(resolveNotificationUserKey(auth.user));
      res.json({ ok: true, targets });
    } catch (error) {
      console.error('Error getting indexer results:', error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/indexer-results', getIndexerResultsHandler);

  const rejectIndexerResultHandler = withAuth(async (req, res, auth) => {
    try {
      const t = getTranslator(req, auth.user);
      const result = await rejectIndexerResultItem(
        resolveNotificationUserKey(auth.user),
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
  app.post('/api/indexer-results/reject', rejectIndexerResultHandler);

  app.post(
    '/api/indexer-results/reject-all',
    withAuth(async (req, res, auth) => {
      try {
        const t = getTranslator(req, auth.user);
        const result = await rejectIndexerResultItems(
          resolveNotificationUserKey(auth.user),
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
    }),
  );

  const validateIndexerResultHandler = withAuth(async (req, res, auth) => {
    try {
      const result = await validateIndexerResultItem(
        resolveNotificationUserKey(auth.user),
        req.body?.targetKey,
        req.body?.indexerStateKey,
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
  app.post('/api/indexer-results/validate', validateIndexerResultHandler);

  // Marquer comme lue
  app.post(
    '/api/notifications/:id/read',
    withAuth(async (req, res, auth) => {
      try {
        const userId = resolveNotificationUserKey(auth.user);
        const notificationId = req.params.id;

        const notif = await markAsRead(userId, notificationId);

        if (!notif) {
          const t = getTranslator(req, auth.user);
          return res.status(404).json({ error: t('notifications.notFound') });
        }

        res.json(notif);
      } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
      }
    }),
  );

  // Marquer toutes comme lues
  app.post(
    '/api/notifications/read-all',
    withAuth(async (req, res, auth) => {
      try {
        const userId = resolveNotificationUserKey(auth.user);
        await markAllAsRead(userId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({ error: error.message });
      }
    }),
  );

  // Supprimer une notification
  app.delete(
    '/api/notifications/:id',
    withAuth(async (req, res, auth) => {
      try {
        const userId = resolveNotificationUserKey(auth.user);
        const notificationId = req.params.id;

        const success = await deleteNotification(userId, notificationId);

        if (!success) {
          const t = getTranslator(req, auth.user);
          return res.status(404).json({ error: t('notifications.notFound') });
        }

        res.json({ success: true });
      } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ error: error.message });
      }
    }),
  );

  // Vider toutes les notifications
  app.delete(
    '/api/notifications',
    withAuth(async (req, res, auth) => {
      try {
        const userId = resolveNotificationUserKey(auth.user);
        await clearNotifications(userId);
        res.json({ success: true });
      } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ error: error.message });
      }
    }),
  );
}
