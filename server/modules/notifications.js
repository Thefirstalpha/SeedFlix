import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { dataDir } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const notificationsFilePath = path.join(dataDir, "notifications.json");

// Charger les notifications
async function loadNotifications() {
  try {
    const content = await fs.readFile(notificationsFilePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Sauvegarder les notifications
async function saveNotifications(notifications) {
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
  // Récupérer les notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.user.username;
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
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.user.username;
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
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.user.username;
      await markAllAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Supprimer une notification
  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user.username;
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
  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.user.username;
      await clearNotifications(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
