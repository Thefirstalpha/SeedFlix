import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { dataDir, usersFilePath } from "../config.js";
import { readSeriesWishlist, readWishlist } from "./wishlist.js";
import { searchTorznabForQuery } from "./torznab.js";
import { debugLog } from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notificationsFilePath = path.join(dataDir, "notifications.json");
const trackerSeenFilePath = path.join(dataDir, "tracker-rss-seen.json");
const trackerPollIntervalMs = 1000 * 60 * 5;
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

async function notifyUser(user, notification) {
  const userId = String(user?.username || "").trim();
  if (!userId) {
    return;
  }

  await addNotification(userId, notification);

  const webhookUrl = getUserDiscordWebhook(user);
  if (webhookUrl) {
    await sendDiscordNotification(webhookUrl, notification);
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
    }));

  const dedupSeries = new Map();
  for (const entry of Array.isArray(seriesWishlist) ? seriesWishlist : []) {
    const seriesId = Number(entry?.seriesId);
    if (!Number.isFinite(seriesId)) {
      continue;
    }

    const key = `series:${seriesId}`;
    if (dedupSeries.has(key)) {
      continue;
    }

    dedupSeries.set(key, {
      key,
      type: "series",
      title: String(entry.seriesTitle || ""),
      id: seriesId,
    });
  }

  return [...movieTargets, ...dedupSeries.values()];
}

async function pollTrackerForWishlist() {
  try {
    const users = await readUsers();
    if (!users.length) {
      return;
    }

    const [movieWishlist, seriesWishlist, seen] = await Promise.all([
      readWishlist(),
      readSeriesWishlist(),
      readTrackerSeen(),
    ]);

    const targets = buildWishlistTargets(movieWishlist, seriesWishlist);
    if (!targets.length) {
      return;
    }

    const nextSeen = { ...seen };
    const now = Date.now();

    for (const key of Object.keys(nextSeen)) {
      if (Number(nextSeen[key]) + trackerSeenTtlMs < now) {
        delete nextSeen[key];
      }
    }

    for (const user of users) {
      const indexerSettings = user?.settings?.placeholders?.indexer || {};
      const indexerUrl = String(indexerSettings.url || "").trim();
      const indexerToken = String(indexerSettings.token || "").trim();
      if (!indexerUrl || !indexerToken) {
        continue;
      }

      const authLike = { user: { settings: user.settings || {} } };

      for (const target of targets) {
        const candidates = [target.title, target.originalTitle].filter(Boolean);
        if (!candidates.length) {
          continue;
        }

        const query = String(candidates[0]).trim();
        if (!query) {
          continue;
        }

        const result = await searchTorznabForQuery(authLike, query, { limit: 8, tmdbId: target.id });
        if (!result.ok || !Array.isArray(result.items) || !result.items.length) {
          continue;
        }

        const match = result.items.find((item) => isLikelyMatch(item.title, candidates));
        if (!match) {
          continue;
        }

        const uniqueItemRef = String(match.guid || match.downloadUrl || match.title || "").trim();
        if (!uniqueItemRef) {
          continue;
        }

        const seenKey = `${String(user.username)}:${target.key}:${uniqueItemRef}`;
        if (nextSeen[seenKey]) {
          continue;
        }

        const mediaLabel = target.type === "movie" ? "Film" : "Série";
        const details = {};
        if (match.quality) {
          details.Qualite = match.quality;
        }
        if (match.language) {
          details.Langue = match.language;
        }
        if (match.sizeHuman) {
          details.Taille = match.sizeHuman;
        }
        if (Number.isFinite(match.seeders || NaN)) {
          details.Seeders = match.seeders;
        }

        await notifyUser(user, {
          type: "success",
          title: `${mediaLabel} disponible sur tracker`,
          message: `${target.title}: une version semble disponible (${match.title}).`,
          data: {
            source: "tracker-rss",
            mediaType: target.type,
            mediaId: target.id,
            trackerItem: {
              title: match.title,
              downloadUrl: match.downloadUrl || match.link || "",
              pubDate: match.pubDate || null,
            },
            details,
          },
        });

        nextSeen[seenKey] = now;
      }
    }

    await writeTrackerSeen(nextSeen);
  } catch (error) {
    debugLog("Tracker wishlist polling failed:", error);
  }
}

function startTrackerWishlistPolling() {
  if (trackerPollerStarted) {
    return;
  }

  trackerPollerStarted = true;
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

      const notification = {
        type: "info",
        title: "Notification de test",
        message: "SeedFlix: la chaîne de notification fonctionne correctement.",
        data: {
          source: "manual-test",
          details: {
            Canal: "Interne + canaux actifs (Discord/Navigateur)",
            Horodatage: new Date().toLocaleString("fr-FR"),
          },
        },
      };

      await notifyUser(auth.user, notification);
      res.json({ ok: true, message: "Notification de test envoyée" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ error: error.message || "Notification de test impossible" });
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
        return res.status(404).json({ error: "Notification not found" });
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
        return res.status(404).json({ error: "Notification not found" });
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
