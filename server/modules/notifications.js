import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { dataDir, usersFilePath } from "../config.js";
import { readSeriesWishlist, readWishlist } from "./wishlist.js";
import { searchTorznabForQuery } from "./torznab.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notificationsFilePath = path.join(dataDir, "notifications.json");
const trackerSeenFilePath = path.join(dataDir, "tracker-rss-seen.json");
const trackerRejectedFilePath = path.join(dataDir, "tracker-rss-rejected.json");
const trackerResultsFilePath = path.join(dataDir, "tracker-rss-results.json");
const trackerPollIntervalMs = 1000 * 60 * 0.5;
const trackerSeenTtlMs = 1000 * 60 * 60 * 24 * 30;
let trackerPollerStarted = false;

async function ensureJsonStore(filePath, fallback) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf-8");
  }
}

async function readUsers() {
  await ensureJsonStore(usersFilePath, []);
  const content = await fs.readFile(usersFilePath, "utf-8");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readTrackerSeen() {
  await ensureJsonStore(trackerSeenFilePath, {});
  const content = await fs.readFile(trackerSeenFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTrackerSeen(entries) {
  await ensureJsonStore(trackerSeenFilePath, {});
  await fs.writeFile(trackerSeenFilePath, JSON.stringify(entries, null, 2), "utf-8");
}

async function readTrackerRejected() {
  await ensureJsonStore(trackerRejectedFilePath, {});
  const content = await fs.readFile(trackerRejectedFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTrackerRejected(entries) {
  await ensureJsonStore(trackerRejectedFilePath, {});
  await fs.writeFile(trackerRejectedFilePath, JSON.stringify(entries, null, 2), "utf-8");
}

async function readTrackerResults() {
  await ensureJsonStore(trackerResultsFilePath, {});
  const content = await fs.readFile(trackerResultsFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTrackerResults(entries) {
  await ensureJsonStore(trackerResultsFilePath, {});
  await fs.writeFile(trackerResultsFilePath, JSON.stringify(entries, null, 2), "utf-8");
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
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
      normalizedItem.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedItem)
    );
  });
}

function padMediaNumber(value) {
  return String(Number(value) || 0).padStart(2, "0");
}

function buildTrackerStateKey(username, targetKey, uniqueItemRef) {
  return `${String(username || "").trim()}:${String(targetKey || "").trim()}:${String(uniqueItemRef || "").trim()}`;
}

function extractTargetKeyFromTrackerStateKey(stateKey) {
  const parts = String(stateKey || "").split(":");
  if (parts.length < 4) {
    return null;
  }

  const targetType = String(parts[1] || "").trim();
  const segmentA = Number(parts[2]);
  const segmentB = Number(parts[3]);
  const segmentC = Number(parts[4]);

  if ((targetType === "movie" || targetType === "series") && Number.isFinite(segmentA)) {
    return `${targetType}:${segmentA}`;
  }

  if (targetType === "season" && Number.isFinite(segmentA) && Number.isFinite(segmentB)) {
    return `${targetType}:${segmentA}:${segmentB}`;
  }

  if (
    targetType === "episode" &&
    Number.isFinite(segmentA) &&
    Number.isFinite(segmentB) &&
    Number.isFinite(segmentC)
  ) {
    return `${targetType}:${segmentA}:${segmentB}:${segmentC}`;
  }

  return null;
}

function parsePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function detectSeasonEpisodeFromItem(item) {
  const attrs = item && typeof item === "object" && item.attributes && typeof item.attributes === "object"
    ? item.attributes
    : {};
  const normalizedAttributes = Object.fromEntries(
    Object.entries(attrs).map(([key, value]) => [String(key || "").toLowerCase(), String(value || "").trim()])
  );
  const title = String(item?.title || "");

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
    title.match(/S(\d{1,2})E(\d{1,3})/i) ||
    title.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (episodeMatch) {
    return {
      seasonNumber: parsePositiveNumber(episodeMatch[1]),
      episodeNumber: parsePositiveNumber(episodeMatch[2]),
    };
  }

  const seasonMatch =
    title.match(/S(\d{1,2})(?!E)/i) ||
    title.match(/\bSeason[ ._-]?(\d{1,2})\b/i);

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

  if (!enabledChannels.includes("discord")) {
    return "";
  }

  return String(notifSettings?.discord?.webhookUrl || "").trim();
}

function isSpoilerModeEnabled(user) {
  return Boolean(user?.settings?.placeholders?.preferences?.spoilerMode);
}

function maskEpisodeLabel(value) {
  return String(value || "").replace(/(S\d{1,2}E\d{1,2})(?:\s*[-–]\s*[^:\n]+)?/i, "$1");
}

function buildExternalNotificationPayload(user, notification) {
  if (
    !isSpoilerModeEnabled(user) ||
    String(notification?.data?.mediaType || "") !== "episode"
  ) {
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

  const type = String(entry?.type || "series");
  const seriesTitle = String(entry?.seriesTitle || "").trim();

  if (type === "series") {
    return {
      key: `series:${seriesId}`,
      type: "series",
      title: seriesTitle,
      id: seriesId,
      label: seriesTitle,
    };
  }

  const seasonNumber = Number(entry?.seasonNumber);
  if (!Number.isFinite(seasonNumber)) {
    return null;
  }

  if (type === "season") {
    const seasonName = String(entry?.seasonName || `Saison ${seasonNumber}`).trim();
    return {
      key: `season:${seriesId}:${seasonNumber}`,
      type: "season",
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

  const episodeName = String(entry?.episodeName || "").trim();
  return {
    key: `episode:${seriesId}:${seasonNumber}:${episodeNumber}`,
    type: "episode",
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
  const userId = String(user?.username || "").trim();
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
      type: "movie",
      title: String(item.title || ""),
      originalTitle: String(item.originalTitle || ""),
      id: Number(item.id),
      label: String(item.title || ""),
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
  if (target.type === "season" && Number.isFinite(target.seasonNumber)) {
    return `${target.title} S${padMediaNumber(target.seasonNumber)}`.trim();
  }

  if (
    target.type === "episode" &&
    Number.isFinite(target.seasonNumber) &&
    Number.isFinite(target.episodeNumber)
  ) {
    return `${target.title} S${padMediaNumber(target.seasonNumber)}E${padMediaNumber(target.episodeNumber)}`.trim();
  }

  return String(target.title || "").trim();
}

function doesTrackerItemMatchTarget(item, target, candidates) {
  if (!isLikelyMatch(item.title, candidates)) {
    return false;
  }

  if (target.type === "movie" || target.type === "series") {
    return true;
  }

  const { seasonNumber, episodeNumber } = detectSeasonEpisodeFromItem(item);
  if (target.type === "season") {
    return seasonNumber === target.seasonNumber;
  }

  return seasonNumber === target.seasonNumber && episodeNumber === target.episodeNumber;
}

function getTrackerNotificationTitleKey(targetType) {
  switch (targetType) {
    case "movie":
      return "notifications.trackerMovieAvailable";
    case "season":
      return "notifications.trackerSeasonAvailable";
    case "episode":
      return "notifications.trackerEpisodeAvailable";
    default:
      return "notifications.trackerSeriesAvailable";
  }
}

function pruneTrackerStateEntries(entries, activeTargetKeys, now) {
  const nextEntries = { ...entries };
  let expiredCount = 0;
  let removedTargetCount = 0;

  for (const key of Object.keys(nextEntries)) {
    if (Number(nextEntries[key]) + trackerSeenTtlMs < now) {
      delete nextEntries[key];
      expiredCount += 1;
      continue;
    }

    const targetKey = extractTargetKeyFromTrackerStateKey(key);
    if (targetKey && !activeTargetKeys.has(targetKey)) {
      delete nextEntries[key];
      removedTargetCount += 1;
    }
  }

  return { nextEntries, expiredCount, removedTargetCount };
}

function pruneTrackerResultsEntries(resultsEntries, activeTargetKeys) {
  const nextResults = { ...resultsEntries };
  let removedTargetCount = 0;

  for (const targetKey of Object.keys(nextResults)) {
    if (!activeTargetKeys.has(targetKey)) {
      delete nextResults[targetKey];
      removedTargetCount += 1;
      continue;
    }

    const bucket = nextResults[targetKey];
    if (!bucket || typeof bucket !== "object") {
      delete nextResults[targetKey];
      removedTargetCount += 1;
    }
  }

  return { nextResults, removedTargetCount };
}

function upsertTrackerResultsForTarget(userResults, target, actionableItems, now) {
  const targetKey = String(target?.key || "").trim();
  if (!targetKey || !Array.isArray(actionableItems) || actionableItems.length === 0) {
    return userResults;
  }

  const nextUserResults = { ...userResults };
  const existingBucket = nextUserResults[targetKey];
  const existingItems = Array.isArray(existingBucket?.items) ? existingBucket.items : [];
  const byStateKey = new Map(
    existingItems
      .filter((item) => item && typeof item === "object")
      .map((item) => [String(item.trackerStateKey || ""), item])
  );

  for (const actionable of actionableItems) {
    const trackerStateKey = String(actionable?.trackerStateKey || "").trim();
    const item = actionable?.item;
    if (!trackerStateKey || !item) {
      continue;
    }

    byStateKey.set(trackerStateKey, {
      trackerStateKey,
      title: String(item.title || ""),
      link: String(item.link || ""),
      downloadUrl: String(item.downloadUrl || item.link || ""),
      guid: item.guid ? String(item.guid) : "",
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
    targetType: String(target.type || ""),
    mediaId: Number.isFinite(Number(target.id)) ? Number(target.id) : null,
    title: String(target.title || ""),
    label: String(target.label || target.title || ""),
    updatedAt: new Date(now).toISOString(),
    items: Array.from(byStateKey.values()),
  };

  return nextUserResults;
}

async function pollTrackerForWishlist() {
  try {
    debugLog("[RSS] Polling cycle started");
    const users = await readUsers();
    if (!users.length) {
      debugLog("[RSS] No users found, skipping cycle");
      return;
    }

    const [movieWishlist, seriesWishlist, seen, rejected, trackerResults] = await Promise.all([
      readWishlist(),
      readSeriesWishlist(),
      readTrackerSeen(),
      readTrackerRejected(),
      readTrackerResults(),
    ]);

    debugLog("[RSS] Loaded stores", {
      users: users.length,
      movieWishlist: Array.isArray(movieWishlist) ? movieWishlist.length : 0,
      seriesWishlist: Array.isArray(seriesWishlist) ? seriesWishlist.length : 0,
      seenEntries: Object.keys(seen || {}).length,
      rejectedEntries: Object.keys(rejected || {}).length,
      resultsUsers: Object.keys(trackerResults || {}).length,
    });

    const targets = buildWishlistTargets(movieWishlist, seriesWishlist);
    const activeTargetKeys = new Set(targets.map((target) => target.key));

    debugLog("[RSS] Targets ready", {
      totalTargets: targets.length,
      preview: targets.slice(0, 5).map((target) => ({
        key: target.key,
        type: target.type,
        id: target.id,
        title: target.title,
      })),
    });

    const now = Date.now();
    const prunedSeen = pruneTrackerStateEntries(seen, activeTargetKeys, now);
    const prunedRejected = pruneTrackerStateEntries(rejected, activeTargetKeys, now);
    const nextSeen = prunedSeen.nextEntries;
    const nextRejected = prunedRejected.nextEntries;
    const nextTrackerResults = { ...trackerResults };

    if (prunedSeen.expiredCount > 0) {
      debugLog("[RSS] Pruned expired seen entries", { prunedSeenCount: prunedSeen.expiredCount });
    }

    if (prunedSeen.removedTargetCount > 0) {
      debugLog("[RSS] Pruned seen entries for removed wishlist targets", {
        prunedRemovedTargetSeenCount: prunedSeen.removedTargetCount,
      });
    }

    if (prunedRejected.expiredCount > 0) {
      debugLog("[RSS] Pruned expired rejected entries", {
        prunedRejectedCount: prunedRejected.expiredCount,
      });
    }

    if (prunedRejected.removedTargetCount > 0) {
      debugLog("[RSS] Pruned rejected entries for removed wishlist targets", {
        prunedRemovedTargetRejectedCount: prunedRejected.removedTargetCount,
      });
    }

    if (!targets.length) {
      const clearedTrackerResults = Object.fromEntries(
        Object.keys(nextTrackerResults).map((username) => [username, {}])
      );
      await Promise.all([
        writeTrackerSeen(nextSeen),
        writeTrackerRejected(nextRejected),
        writeTrackerResults(clearedTrackerResults),
      ]);
      debugLog("[RSS] No wishlist targets, skipping cycle", {
        remainingSeenEntries: Object.keys(nextSeen).length,
        remainingRejectedEntries: Object.keys(nextRejected).length,
        remainingResultsUsers: Object.keys(clearedTrackerResults).length,
      });
      return;
    }

    for (const user of users) {
      const username = String(user?.username || "unknown");
      const indexerSettings = user?.settings?.placeholders?.indexer || {};
      const indexerUrl = String(indexerSettings.url || "").trim();
      const indexerToken = String(indexerSettings.token || "").trim();
      if (!indexerUrl || !indexerToken) {
        debugLog("[RSS] User skipped: indexer not configured", { username });
        continue;
      }

      debugLog("[RSS] User polling started", {
        username,
        targetCount: targets.length,
      });

      const userResults =
        nextTrackerResults[username] && typeof nextTrackerResults[username] === "object"
          ? nextTrackerResults[username]
          : {};
      const prunedUserResults = pruneTrackerResultsEntries(userResults, activeTargetKeys);
      nextTrackerResults[username] = prunedUserResults.nextResults;

      if (prunedUserResults.removedTargetCount > 0) {
        debugLog("[RSS] Pruned stale tracker result targets", {
          username,
          removedTargetCount: prunedUserResults.removedTargetCount,
        });
      }

      const authLike = { user: { settings: user.settings || {} } };

      for (const target of targets) {
        const candidates = [target.title, target.originalTitle].filter(Boolean);
        if (!candidates.length) {
          debugLog("[RSS] Target skipped: no title candidates", {
            username,
            targetKey: target.key,
          });
          continue;
        }

        const query = buildSearchQueryForTarget(target);
        if (!query) {
          debugLog("[RSS] Target skipped: empty query", {
            username,
            targetKey: target.key,
          });
          continue;
        }

        debugLog("[RSS] Querying Torznab", {
          username,
          targetKey: target.key,
          tmdbId: target.id,
          query,
        });

        const result = await searchTorznabForQuery(authLike, query, { limit: 8, tmdbId: target.id });
        if (!result.ok || !Array.isArray(result.items) || !result.items.length) {
          debugLog("[RSS] No Torznab items for target", {
            username,
            targetKey: target.key,
            ok: result.ok,
            itemCount: Array.isArray(result.items) ? result.items.length : 0,
            message: result.message || null,
          });
          continue;
        }

        debugLog("[RSS] Torznab items received", {
          username,
          targetKey: target.key,
          itemCount: result.items.length,
          sourceTitle: result.sourceTitle || null,
        });

        const matchedItems = result.items.filter((item) => doesTrackerItemMatchTarget(item, target, candidates));
        if (!matchedItems.length) {
          debugLog("[RSS] Items found but no target-specific match", {
            username,
            targetKey: target.key,
            candidates,
          });
          continue;
        }

        const actionableItems = [];
        for (const candidateItem of matchedItems) {
          const uniqueItemRef = String(
            candidateItem.guid || candidateItem.downloadUrl || candidateItem.title || ""
          ).trim();
          if (!uniqueItemRef) {
            debugLog("[RSS] Match skipped: no unique reference", {
              username,
              targetKey: target.key,
            });
            continue;
          }

          const candidateStateKey = buildTrackerStateKey(user.username, target.key, uniqueItemRef);
          if (nextRejected[candidateStateKey]) {
            debugLog("[RSS] Match skipped: rejected", {
              username,
              targetKey: target.key,
              trackerStateKey: candidateStateKey,
            });
            continue;
          }
          if (nextSeen[candidateStateKey]) {
            debugLog("[RSS] Match skipped: already seen", {
              username,
              targetKey: target.key,
              seenKey: candidateStateKey,
            });
            continue;
          }

          actionableItems.push({
            item: candidateItem,
            trackerStateKey: candidateStateKey,
          });
        }

        if (!actionableItems.length) {
          debugLog("[RSS] No actionable match after seen/rejected filtering", {
            username,
            targetKey: target.key,
            matchedItems: matchedItems.length,
          });
          continue;
        }

        const primaryMatch = actionableItems[0].item;
        const primaryTrackerStateKey = actionableItems[0].trackerStateKey;
        const releasesPreview = actionableItems
          .slice(0, 6)
          .map(({ item }) => String(item.title || "").trim())
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

        nextTrackerResults[username] = upsertTrackerResultsForTarget(
          nextTrackerResults[username],
          target,
          actionableItems,
          now
        );

        await notifyUser(user, {
          type: "search",
          title: translator(getTrackerNotificationTitleKey(target.type)),
          message: translator("notifications.trackerReleaseMessage", {
            title: target.label || target.title,
            count: actionableItems.length,
          }),
          data: {
            source: "tracker-rss",
            mediaType: target.type,
            mediaId: target.id,
            targetKey: target.key,
            trackerStateKey: primaryTrackerStateKey,
            trackerItem: {
              title: primaryMatch.title,
              downloadUrl: primaryMatch.downloadUrl || primaryMatch.link || "",
              pubDate: primaryMatch.pubDate || null,
            },
            trackerItems: actionableItems.map(({ item, trackerStateKey }) => ({
              title: item.title,
              downloadUrl: item.downloadUrl || item.link || "",
              pubDate: item.pubDate || null,
              trackerStateKey,
            })),
            trackerItemsPreview: releasesPreview,
            details,
          },
        });

        debugLog("[RSS] Notification created", {
          username,
          targetKey: target.key,
          releaseTitle: primaryMatch.title,
          groupedReleases: actionableItems.length,
        });

        for (const actionable of actionableItems) {
          nextSeen[actionable.trackerStateKey] = now;
        }
      }

      debugLog("[RSS] User polling finished", { username });
    }

    await Promise.all([
      writeTrackerSeen(nextSeen),
      writeTrackerRejected(nextRejected),
      writeTrackerResults(nextTrackerResults),
    ]);
    debugLog("[RSS] Polling cycle finished", {
      seenEntries: Object.keys(nextSeen).length,
      rejectedEntries: Object.keys(nextRejected).length,
      resultsUsers: Object.keys(nextTrackerResults).length,
    });
  } catch (error) {
    debugLog("Tracker wishlist polling failed:", error);
  }
}

function startTrackerWishlistPolling() {
  if (trackerPollerStarted) {
    debugLog("[RSS] Poller already started, skip");
    return;
  }

  trackerPollerStarted = true;
  debugLog("[RSS] Poller started", { trackerPollIntervalMs });
  void pollTrackerForWishlist();
  setInterval(() => {
    void pollTrackerForWishlist();
  }, trackerPollIntervalMs);
}

// Charger les notifications
async function loadNotifications() {
  await ensureJsonStore(notificationsFilePath, {});
  try {
    const content = await fs.readFile(notificationsFilePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Sauvegarder les notifications
async function saveNotifications(notifications) {
  await ensureJsonStore(notificationsFilePath, {});
  await fs.writeFile(
    notificationsFilePath,
    JSON.stringify(notifications, null, 2)
  );
}

// Ajouter une notification
export async function addNotification(userId, notification) {
  const notifications = await loadNotifications();

  if (!notifications[userId]) {
    notifications[userId] = [];
  }

  const id = Date.now().toString();
  const notif = {
    id,
    title: notification.title,
    message: notification.message,
    type: notification.type || "info",
    createdAt: new Date().toISOString(),
    isRead: false,
    data: notification.data || {},
  };

  notifications[userId].push(notif);
  await saveNotifications(notifications);

  return notif;
}

// Obtenir les notifications d'un utilisateur
export async function getNotifications(userId, options = {}) {
  const notifications = await loadNotifications();
  let userNotifs = notifications[userId] || [];

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
  const notifications = await loadNotifications();

  if (notifications[userId]) {
    const notif = notifications[userId].find((n) => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      await saveNotifications(notifications);
      return notif;
    }
  }

  return null;
}

// Marquer toutes comme lues
export async function markAllAsRead(userId) {
  const notifications = await loadNotifications();

  if (notifications[userId]) {
    notifications[userId].forEach((n) => {
      n.isRead = true;
    });
    await saveNotifications(notifications);
  }
}

// Supprimer une notification
export async function deleteNotification(userId, notificationId) {
  const notifications = await loadNotifications();

  if (notifications[userId]) {
    notifications[userId] = notifications[userId].filter(
      (n) => n.id !== notificationId
    );
    await saveNotifications(notifications);
    return true;
  }

  return false;
}

export async function getTrackerResultsForUser(userId) {
  const allResults = await readTrackerResults();
  const userResults = allResults[userId] && typeof allResults[userId] === "object"
    ? allResults[userId]
    : {};

  return Object.values(userResults)
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      targetKey: String(entry.targetKey || ""),
      targetType: String(entry.targetType || ""),
      mediaId: Number.isFinite(Number(entry.mediaId)) ? Number(entry.mediaId) : null,
      title: String(entry.title || ""),
      label: String(entry.label || entry.title || ""),
      updatedAt: String(entry.updatedAt || ""),
      items: Array.isArray(entry.items) ? entry.items : [],
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function mutateTrackerResultItem(userId, targetKey, trackerStateKey, mode) {
  const normalizedTargetKey = String(targetKey || "").trim();
  const normalizedStateKey = String(trackerStateKey || "").trim();
  if (!normalizedTargetKey || !normalizedStateKey) {
    return { ok: false, reason: "invalid-input" };
  }

  const [allResults, rejected] = await Promise.all([
    readTrackerResults(),
    readTrackerRejected(),
  ]);

  const userResults = allResults[userId] && typeof allResults[userId] === "object"
    ? { ...allResults[userId] }
    : {};
  const bucket = userResults[normalizedTargetKey] && typeof userResults[normalizedTargetKey] === "object"
    ? { ...userResults[normalizedTargetKey] }
    : null;
  if (!bucket || !Array.isArray(bucket.items)) {
    return { ok: false, reason: "not-found" };
  }

  const index = bucket.items.findIndex(
    (item) => String(item?.trackerStateKey || "").trim() === normalizedStateKey
  );
  if (index < 0) {
    return { ok: false, reason: "not-found" };
  }

  bucket.items.splice(index, 1);
  if (bucket.items.length === 0) {
    delete userResults[normalizedTargetKey];
  } else {
    bucket.updatedAt = new Date().toISOString();
    userResults[normalizedTargetKey] = bucket;
  }
  allResults[userId] = userResults;

  if (mode === "reject") {
    rejected[normalizedStateKey] = Date.now();
  }

  await Promise.all([
    writeTrackerResults(allResults),
    mode === "reject" ? writeTrackerRejected(rejected) : Promise.resolve(),
  ]);

  return { ok: true };
}

export async function rejectTrackerResultItem(userId, targetKey, trackerStateKey) {
  return mutateTrackerResultItem(userId, targetKey, trackerStateKey, "reject");
}

export async function validateTrackerResultItem(userId, targetKey, trackerStateKey) {
  return mutateTrackerResultItem(userId, targetKey, trackerStateKey, "validate");
}

// Supprimer toutes les notifications
export async function clearNotifications(userId) {
  const notifications = await loadNotifications();

  if (notifications[userId]) {
    delete notifications[userId];
    await saveNotifications(notifications);
  }
}

// Compter les non-lues
export async function getUnreadCount(userId) {
  const userNotifs = await getNotifications(userId);
  return userNotifs.filter((n) => !n.isRead).length;
}

// Envoyer via Discord
export async function sendDiscordNotification(webhookUrl, notification) {
  if (!webhookUrl) {
    return null;
  }

  try {
    const embed = {
      title: notification.title,
      description: notification.message,
      color: getColorByType(notification.type),
      timestamp: new Date().toISOString(),
      footer: {
        text: "SeedFlix Notifications",
      },
    };

    if (notification.data?.details) {
      embed.fields = [];
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.ok ? { success: true } : null;
  } catch (error) {
    console.error("Error sending Discord notification:", error.message);
    return null;
  }
}

// Obtenir la couleur selon le type
function getColorByType(type) {
  const colors = {
    success: 0x10b981,
    error: 0xef4444,
    warning: 0xf59e0b,
    info: 0x3b82f6,
    search: 0x06b6d4,
  };
  return colors[type] || colors.info;
}

// Enregistrer les routes
export function registerNotificationRoutes(app) {
  startTrackerWishlistPolling();

  // Notification de test (interne + Discord si configuré)
  app.post("/api/notifications/test", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }
      const t = getTranslator(req, auth.user);

      const notification = {
        type: "info",
        title: t("notifications.testTitle"),
        message: t("notifications.testMessage"),
        data: {
          source: "manual-test",
          details: {
            [t("notifications.testChannelLabel")]: t("notifications.testChannel"),
            [t("notifications.testTimestamp")]: new Date().toLocaleString(
              auth.user?.settings?.placeholders?.preferences?.language === "fr" ? "fr-FR" : "en-US"
            ),
          },
        },
      };

      await notifyUser(auth.user, notification);
      res.json({ ok: true, message: t("notifications.testSent") });
    } catch (error) {
      const t = getTranslator(req);
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: error.message || t("notifications.testFailed") });
    }
  });

  // Récupérer les notifications
  app.get("/api/notifications", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const userId = auth.user.username;
      const limit = parseInt(req.query.limit) || 50;
      const unreadOnly = req.query.unreadOnly === "true";

      const notifications = await getNotifications(userId, {
        limit,
        unreadOnly,
      });
      const unreadCount = await getUnreadCount(userId);

      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error("Error getting notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tracker-results", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const targets = await getTrackerResultsForUser(auth.user.username);
      res.json({ ok: true, targets });
    } catch (error) {
      console.error("Error getting tracker results:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tracker-results/reject", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const t = getTranslator(req, auth.user);
      const result = await rejectTrackerResultItem(
        auth.user.username,
        req.body?.targetKey,
        req.body?.trackerStateKey
      );
      if (!result.ok) {
        if (result.reason === "not-found") {
          return res.status(404).json({ error: t("notifications.notFound") });
        }
        return res.status(400).json({ error: t("notifications.rejectNotSupported") });
      }

      res.json({ ok: true, message: t("notifications.rejected") });
    } catch (error) {
      console.error("Error rejecting tracker result:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tracker-results/validate", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const result = await validateTrackerResultItem(
        auth.user.username,
        req.body?.targetKey,
        req.body?.trackerStateKey
      );
      if (!result.ok) {
        return res.status(404).json({ error: "Tracker result not found" });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error("Error validating tracker result:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Marquer comme lue
  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const userId = auth.user.username;
      const notificationId = req.params.id;

      const notif = await markAsRead(userId, notificationId);

      if (!notif) {
        const t = getTranslator(req, auth.user);
        return res.status(404).json({ error: t("notifications.notFound") });
      }

      res.json(notif);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Marquer toutes comme lues
  app.post("/api/notifications/read-all", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const userId = auth.user.username;
      await markAllAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Supprimer une notification
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const userId = auth.user.username;
      const notificationId = req.params.id;

      const success = await deleteNotification(userId, notificationId);

      if (!success) {
        const t = getTranslator(req, auth.user);
        return res.status(404).json({ error: t("notifications.notFound") });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vider toutes les notifications
  app.delete("/api/notifications", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const userId = auth.user.username;
      await clearNotifications(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
