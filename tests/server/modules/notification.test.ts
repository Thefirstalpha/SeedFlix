import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import {
  addNotification,
  addWebPushSubscription,
  clearNotifications,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  getWebPushPublicKey,
  listWebPushSubscriptions,
  markAllAsRead,
  markAsRead,
  removeWebPushSubscription,
  sendDiscordNotification,
} from '../../../server/modules/notification';
import { createUser } from '../../../server/modules/user';
import webPush from 'web-push';

describe('notification module', () => {
  let userId: number;

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
    const { user } = createUser('notifUser');
    userId = user.id;
  });

  describe('In-App Notifications CRUD', () => {
    it('should add a notification and retrieve it', () => {
      addNotification(userId, {
        title: 'New Movie Available',
        message: 'Fight Club has finished downloading',
        type: 'success',
      });

      const list = getNotifications(userId);
      expect(list.notifications).toHaveLength(1);
      expect(list.unreadCount).toBe(1);
      expect(list.notifications[0].title).toBe('New Movie Available');
      expect(list.notifications[0].isRead).toBe(false);
      expect(getUnreadCount(userId)).toBe(1);
    });

    it('should mark notification as read with markAsRead', () => {
      addNotification(userId, {
        title: 'Test Read',
        message: 'Content',
        type: 'info',
      });

      const list = getNotifications(userId);
      const notifId = list.notifications[0].id;

      markAsRead(userId, notifId);
      expect(getUnreadCount(userId)).toBe(0);
    });

    it('should support pagination and unread-only filters in getNotifications', () => {
      addNotification(userId, { title: 'N1', message: 'M1', type: 'info' });
      addNotification(userId, { title: 'N2', message: 'M2', type: 'info' });
      addNotification(userId, { title: 'N3', message: 'M3', type: 'info' });

      const list = getNotifications(userId);
      markAsRead(userId, list.notifications[0].id);

      const unread = getNotifications(userId, { unreadOnly: true });
      expect(unread.notifications).toHaveLength(2);
      expect(getUnreadCount(userId)).toBe(2);
    });

    it('should mark all notifications as read', () => {
      addNotification(userId, { title: 'N1', message: 'M1', type: 'info' });
      addNotification(userId, { title: 'N2', message: 'M2', type: 'info' });

      expect(getUnreadCount(userId)).toBe(2);
      markAllAsRead(userId);
      expect(getUnreadCount(userId)).toBe(0);
    });

    it('should delete single notification with deleteNotification', () => {
      addNotification(userId, { title: 'To Delete', message: 'Msg', type: 'info' });
      const notifId = getNotifications(userId).notifications[0].id;

      const deleted = deleteNotification(userId, notifId);
      expect(deleted).toBe(true);
      expect(getNotifications(userId).notifications).toHaveLength(0);
    });

    it('should clear all notifications for user', () => {
      addNotification(userId, { title: 'A', message: '1', type: 'info' });
      addNotification(userId, { title: 'B', message: '2', type: 'info' });

      clearNotifications(userId);
      expect(getNotifications(userId).notifications).toHaveLength(0);
    });
  });

  describe('Web Push Subscriptions & Delivery', () => {
    it('should get or generate VAPID public key', () => {
      const publicKey = getWebPushPublicKey();
      expect(publicKey).toBeDefined();
      expect(typeof publicKey).toBe('string');
    });

    it('should add, list, and remove push subscriptions', () => {
      const sub = {
        name: 'Chrome on Mac',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/sub-123',
          keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
        },
      };

      const added = addWebPushSubscription(userId, sub);
      const subs = listWebPushSubscriptions(userId);
      expect(subs).toHaveLength(1);
      expect(subs[0].endpoint).toBe(sub.subscription.endpoint);

      removeWebPushSubscription(userId, added.id);
      expect(listWebPushSubscriptions(userId)).toHaveLength(0);
    });

    it('should dispatch push notification and prune expired 410 subscriptions', async () => {
      const sub = {
        name: 'Expired Browser',
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/expired',
          keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
        },
      };
      addWebPushSubscription(userId, sub);

      const sendSpy = vi.spyOn(webPush, 'sendNotification').mockRejectedValueOnce({
        statusCode: 410,
        message: 'Gone',
      });

      addNotification(userId, {
        title: 'Push Test',
        message: 'Testing push delivery',
        type: 'info',
      });

      // Wait for background async web push delivery
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(sendSpy).toHaveBeenCalled();
      const subs = listWebPushSubscriptions(userId);
      expect(subs).toHaveLength(0);
    });
  });

  describe('Discord Notifications', () => {
    it('should send webhook notification to Discord with formatted payload', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const validDiscordWebhook =
        'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH';

      await sendDiscordNotification(validDiscordWebhook, {
        title: 'Torrent Completed',
        message: 'Fight Club is ready to watch',
        type: 'success',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        validDiscordWebhook,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
  });
});
