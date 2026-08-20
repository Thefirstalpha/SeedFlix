import { randomUUID } from 'node:crypto';
import webPush from 'web-push';
import { Notification } from '../../common/notification';
import { User, WebPushSubscription } from '../../common/user';
import { db } from './db';
import { readGlobalConfig, updateGlobalConfig } from './setting';
import { getUser, updateUser } from './user';

const DISCORD_WEBHOOK_BASE_URL = 'https://discord.com';
const DISCORD_WEBHOOK_PATH = /^\/api\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{40,200})\/?$/;
const WEB_PUSH_SUBJECT = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@seedflix.local';
type NotificationPayload = Omit<Notification, 'id' | 'createdAt' | 'isRead'>;

function getWebPushVapidKeys() {
  const existingKeys = readGlobalConfig().webPushVapidKeys;
  if (existingKeys) return existingKeys;

  const generatedKeys = webPush.generateVAPIDKeys();
  updateGlobalConfig({ webPushVapidKeys: generatedKeys });
  return generatedKeys;
}

export function getWebPushPublicKey(): string {
  return getWebPushVapidKeys().publicKey;
}

function configureWebPush(): void {
  const keys = getWebPushVapidKeys();
  webPush.setVapidDetails(WEB_PUSH_SUBJECT, keys.publicKey, keys.privateKey);
}

function validateWebPushInput(input: any): Omit<WebPushSubscription, 'id' | 'createdAt'> {
  const name = String(input?.name || '').trim();
  const endpoint = String(input?.subscription?.endpoint || '').trim();
  const p256dh = String(input?.subscription?.keys?.p256dh || '').trim();
  const auth = String(input?.subscription?.keys?.auth || '').trim();

  if (!name || name.length > 80) throw new Error('Invalid browser name.');
  const parsedEndpoint = new URL(endpoint);
  if (parsedEndpoint.protocol !== 'https:') throw new Error('Invalid push endpoint.');
  if (!p256dh || !auth) throw new Error('Invalid push subscription keys.');

  return { name, endpoint: parsedEndpoint.toString(), keys: { p256dh, auth } };
}

export function listWebPushSubscriptions(userId: number): WebPushSubscription[] {
  return getUser(userId)?.notifications.web.subscriptions ?? [];
}

export function addWebPushSubscription(userId: number, input: any): WebPushSubscription {
  const user = getUser(userId);
  if (!user) throw new Error('User not found');

  const validated = validateWebPushInput(input);
  const existing = user.notifications.web.subscriptions.find(
    (subscription) => subscription.endpoint === validated.endpoint,
  );
  const saved: WebPushSubscription = {
    ...validated,
    id: existing?.id || randomUUID(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  user.notifications.web.subscriptions = [
    ...user.notifications.web.subscriptions.filter(
      (subscription) => subscription.endpoint !== validated.endpoint,
    ),
    saved,
  ];
  updateUser(user);
  return saved;
}

export function removeWebPushSubscription(userId: number, subscriptionId: string): boolean {
  const user = getUser(userId);
  if (!user) return false;
  const subscriptions = user.notifications.web.subscriptions.filter(
    (subscription) => subscription.id !== subscriptionId,
  );
  if (subscriptions.length === user.notifications.web.subscriptions.length) return false;
  user.notifications.web.subscriptions = subscriptions;
  updateUser(user);
  return true;
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

function rowToNotification(row: any): Notification {
  return {
    id: String(row.id),
    title: row.title,
    message: row.message,
    isRead: Boolean(row.read),
    createdAt: row.created_at,
    type: row.type,
    data: row.data ? JSON.parse(row.data) : undefined,
  };
}

export function getNotifications(
  userId: number,
  options: { limit?: number; unreadOnly?: boolean } = {},
): { notifications: Notification[]; unreadCount: number } {
  const unreadCount = Number(
    (
      db
        .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0')
        .get(userId) as any
    )?.c ?? 0,
  );

  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: any[] = [userId];

  if (options.unreadOnly) {
    query += ' AND read = 0';
  }
  query += ' ORDER BY created_at DESC';
  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(query).all(...params);
  return { notifications: rows.map(rowToNotification), unreadCount };
}

export function getUnreadCount(userId: number): number {
  return Number(
    (
      db
        .prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read = 0')
        .get(userId) as any
    )?.c ?? 0,
  );
}

// ─── Ajout ────────────────────────────────────────────────────────────────────

export function addNotification(userId: number, notification: NotificationPayload) {
  db.prepare(
    'INSERT INTO notifications (user_id, title, message, type, read, data) VALUES (?, ?, ?, ?, 0, ?)',
  ).run(
    userId,
    notification.title,
    notification.message,
    notification.type,
    notification.data ? JSON.stringify(notification.data) : null,
  );

  const user: User | null = getUser(userId);
  if (user?.notifications?.discord?.webhookUrl) {
    sendDiscordNotification(user.notifications.discord.webhookUrl, notification).catch((err) => {
      console.error(`Failed to send Discord notification: ${err.message}`);
    });
  }
  if (user?.notifications.web.subscriptions.length) {
    sendWebPushNotifications(user, notification).catch((err) => {
      console.error(`Failed to send web push notification: ${err.message}`);
    });
  }
}

async function sendWebPushNotifications(
  user: User,
  notification: NotificationPayload,
): Promise<void> {
  configureWebPush();
  const expiredIds: string[] = [];
  const payload = JSON.stringify({
    title: notification.title,
    message: notification.message,
    type: notification.type,
    url: '/notifications',
  });

  await Promise.allSettled(
    user.notifications.web.subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
          },
          payload,
        );
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          expiredIds.push(subscription.id);
          return;
        }
        throw error;
      }
    }),
  );

  if (expiredIds.length) {
    const latestUser = getUser(user.id);
    if (latestUser) {
      latestUser.notifications.web.subscriptions =
        latestUser.notifications.web.subscriptions.filter(
          (subscription) => !expiredIds.includes(subscription.id),
        );
      updateUser(latestUser);
    }
  }
}

// ─── Marquer comme lu ─────────────────────────────────────────────────────────

export function markAsRead(userId: number, notificationId: string): boolean {
  const result = db
    .prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND id = ?')
    .run(userId, Number(notificationId));
  return (result as any).changes > 0;
}

export function markAllAsRead(userId: number): void {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
}

// ─── Suppression ──────────────────────────────────────────────────────────────

export function deleteNotification(userId: number, notificationId: string): boolean {
  const result = db
    .prepare('DELETE FROM notifications WHERE user_id = ? AND id = ?')
    .run(userId, Number(notificationId));
  return (result as any).changes > 0;
}

export function clearNotifications(userId: number): void {
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
}

export function normalizeDiscordWebhookUrl(input: string): string {
  const value = String(input || '').trim();
  const parsed = new URL(value);

  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS Discord webhooks are allowed.');
  }

  const match = DISCORD_WEBHOOK_PATH.exec(parsed.pathname);
  if (!match) {
    throw new Error('Invalid Discord webhook URL format.');
  }

  const webhookId = match[1];
  const webhookToken = match[2];
  return `${DISCORD_WEBHOOK_BASE_URL}/api/webhooks/${webhookId}/${webhookToken}`;
}

export function sendDiscordNotification(
  webhookUrl: string,
  notification: NotificationPayload,
): Promise<void> {
  const safeWebhookUrl = normalizeDiscordWebhookUrl(webhookUrl);

  return fetch(safeWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [
        {
          title: notification.title,
          description: notification.message,
          color: 0x10b981,
          timestamp: new Date().toISOString(),
          footer: { text: notification.title },
        },
      ],
    }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to send Discord notification: ${response.statusText}`);
    }
  });
}
