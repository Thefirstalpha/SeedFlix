import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import { router as settingsRouter } from '../../../server/routes/settings';
import { createUser, getUser } from '../../../server/modules/user';
import { readGlobalConfig } from '../../../server/modules/setting';
import { createSessionCookie, createTestApp } from './testApp';

describe('Route: /api/settings', () => {
  const app = createTestApp(settingsRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  describe('Global Config & Reset (Admin)', () => {
    it('should get and update pull-auto global setting', async () => {
      const adminCookie = createSessionCookie(1);

      const getRes = await request(app)
        .get('/api/settings/pull-auto')
        .set('Cookie', adminCookie);

      expect(getRes.status).toBe(200);
      expect(getRes.body.pullAuto).toBe(true);

      const postRes = await request(app)
        .post('/api/settings/pull-auto')
        .set('Cookie', adminCookie)
        .send({ pullAuto: false });

      expect(postRes.status).toBe(200);
      expect(readGlobalConfig().pullAuto).toBe(false);
    });

    it('should reset database via /api/settings/reset', async () => {
      const adminCookie = createSessionCookie(1);

      const res = await request(app)
        .post('/api/settings/reset')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
    });
  });

  describe('User Preferences (Language & Spoiler)', () => {
    it('should update user language', async () => {
      const { user } = createUser('langUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/settings/language')
        .set('Cookie', cookie)
        .send({ language: 'fr' });

      expect(res.status).toBe(200);
      expect(getUser(user.id)?.settings.language).toBe('fr');
    });

    it('should update user spoiler mode', async () => {
      const { user } = createUser('spoilerUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/settings/spoiler')
        .set('Cookie', cookie)
        .send({ spoiler: true });

      expect(res.status).toBe(200);
      expect(getUser(user.id)?.settings.spoilerMode).toBe(true);
    });
  });

  describe('Discord Webhook Configuration', () => {
    it('should reject invalid Discord webhook URL', async () => {
      const { user } = createUser('discordUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/settings/discord')
        .set('Cookie', cookie)
        .send({ webhookUrl: 'http://invalid-url.com' });

      expect(res.status).toBe(400);
    });

    it('should test and save valid Discord webhook URL', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const { user } = createUser('discordUser2');
      const cookie = createSessionCookie(user.id);

      const validWebhook =
        'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH';

      const res = await request(app)
        .post('/api/settings/discord')
        .set('Cookie', cookie)
        .send({ webhookUrl: validWebhook });

      expect(res.status).toBe(200);
      expect(getUser(user.id)?.notifications.discord?.webhookUrl).toBe(validWebhook);
    });
  });

  describe('Web Push Subscriptions', () => {
    it('should get public key and list of subscriptions', async () => {
      const { user } = createUser('pushUser');
      const cookie = createSessionCookie(user.id);

      const res = await request(app).get('/api/settings/web-push').set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.publicKey).toBeDefined();
      expect(Array.isArray(res.body.subscriptions)).toBe(true);
    });

    it('should add valid web push subscription', async () => {
      const { user } = createUser('pushUser2');
      const cookie = createSessionCookie(user.id);

      const res = await request(app)
        .post('/api/settings/web-push')
        .set('Cookie', cookie)
        .send({
          name: 'Chrome on macOS',
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
            keys: {
              p256dh: 'p256dh-key',
              auth: 'auth-key',
            },
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.subscription).toBeDefined();
    });
  });
});

