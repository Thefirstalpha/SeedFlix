import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import { resetDatabase, runInTransaction } from '../modules/db';
import { getUser } from '../modules/user';
import {
  addWebPushSubscription,
  getWebPushPublicKey,
  listWebPushSubscriptions,
  normalizeDiscordWebhookUrl,
  removeWebPushSubscription,
  sendDiscordNotification,
} from '../modules/notification';

const router = Router();
router.use(authentication);

router.post('/settings/reset', withAdmin, async (req, res) => {
  resetDatabase();
  res.clearCookie('session');
  res.status(200).json({ ok: true, loggedOut: true, message: 'Database reset successfully' });
});

router.post('/settings/language', async (req, res) => {
  const { language } = req.body;
  runInTransaction(({ writeStore }) => {
    let user = getUser(req.user.id);
    if (!user) throw new Error('User not found');
    user.settings.language = language;
    writeStore('user', user.id, user);
  });
  res.status(200).json({ message: `Language updated to ${language}` });
});

router.post('/settings/spoiler', async (req, res) => {
  const { spoiler } = req.body;
  runInTransaction(({ writeStore }) => {
    let user = getUser(req.user.id);
    if (!user) throw new Error('User not found');
    user.settings.spoilerMode = spoiler;
    writeStore('user', user.id, user);
  });
  res.status(200).json({ message: `Spoiler mode updated to ${spoiler}` });
});

router.post('/settings/discord', async (req, res) => {
  const { webhookUrl } = req.body;
  try {
    const safeWebhookUrl = normalizeDiscordWebhookUrl(webhookUrl);

    await sendDiscordNotification(safeWebhookUrl, {
      title: 'Test Notification',
      message: 'This is a test notification from SeedFlix.',
      type: 'info',
    });

    runInTransaction(({ writeStore }) => {
      let user = getUser(req.user.id);
      if (!user) throw new Error('User not found');
      user.notifications['discord'] = { webhookUrl: safeWebhookUrl };
      writeStore('user', user.id, user);
    });

    res.status(200).json({ message: 'Discord webhook URL updated' });
  } catch (error) {
    console.error('Failed to send test Discord notification:', error);
    return res
      .status(400)
      .json({ error: 'Failed to send test Discord notification. Please check the webhook URL.' });
  }
});

router.get('/settings/web-push', (req, res) => {
  res.json({
    publicKey: getWebPushPublicKey(),
    subscriptions: listWebPushSubscriptions(req.user.id),
  });
});

router.post('/settings/web-push', (req, res) => {
  try {
    const subscription = addWebPushSubscription(req.user.id, req.body);
    res.status(201).json({ subscription });
  } catch (error) {
    res
      .status(400)
      .json({ error: error instanceof Error ? error.message : 'Invalid subscription' });
  }
});

router.delete('/settings/web-push/:id', (req, res) => {
  if (!removeWebPushSubscription(req.user.id, String(req.params.id))) {
    res.status(404).json({ error: 'Browser subscription not found' });
    return;
  }
  res.json({ ok: true });
});

export { router };
