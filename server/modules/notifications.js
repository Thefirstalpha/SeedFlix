import { withAuth } from './auth.js';
import { getTranslator } from '../i18n.js';
import { notificationsStore } from '../db.js';

function userStoreKey(userId) {
  if (userId === null || userId === undefined) {
    return '';
  }

  return String(userId);
}

export function resolveNotificationUserKey(user) {
  return userStoreKey(user?.id);
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

export async function notifyUser(user, notification) {
  const userId = String(user?.id);
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

  notificationsStore.mutate((notifications) => {
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
  const notifications = await notificationsStore.read();
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

  notificationsStore.mutate((notifications) => {
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
  notificationsStore.mutate((notifications) => {
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

  notificationsStore.mutate((notifications) => {
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
  notificationsStore.mutate((notifications) => {
    const nextNotifications =
      notifications && typeof notifications === 'object' ? notifications : {};
    if (Array.isArray(nextNotifications[userKey])) {
      nextNotifications[userKey] = [];
    }
    return nextNotifications;
  });
}

// Compte le nombre de notifications non lues pour un utilisateur
export async function getUnreadCount(userId) {
  const userKey = userStoreKey(userId);
  if (!userKey) return 0;
  const notifications = await notificationsStore.read();
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

const sendTestNotificationHandler = withAuth(async (req, res, auth) => {
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
            auth.user?.settings?.placeholders?.preferences?.language === 'fr' ? 'fr-FR' : 'en-US',
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
});

const getNotificationsHandler = withAuth(async (req, res, auth) => {
  try {
    const userId = String(auth.user?.id);
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
});

const markAsReadHandler = withAuth(async (req, res, auth) => {
  try {
    const userId = String(auth.user?.id);
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
});

const markAllAsReadHandler = withAuth(async (req, res, auth) => {
  try {
    const userId = String(auth.user?.id);
    await markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: error.message });
  }
});

const deleteNotificationHandler = withAuth(async (req, res, auth) => {
  try {
    const userId = String(auth.user?.id);
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
});

const clearNotificationsHandler = withAuth(async (req, res, auth) => {
  try {
    const userId = String(auth.user?.id);
    await clearNotifications(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enregistrer les routes
export function registerNotificationRoutes(app) {
  // Notification de test (interne + Discord si configuré)
  app.post('/api/notifications/test', sendTestNotificationHandler);
  // Récupérer les notifications
  app.get('/api/notifications', getNotificationsHandler);

  // Marquer comme lue
  app.post('/api/notifications/:id/read', markAsReadHandler);

  // Marquer toutes comme lues
  app.post('/api/notifications/read-all', markAllAsReadHandler);

  // Supprimer une notification
  app.delete('/api/notifications/:id', deleteNotificationHandler);

  // Vider toutes les notifications
  app.delete('/api/notifications', clearNotificationsHandler);
}
