import { Router } from 'express';
import { authentication, getUsers, resetAuth, withAdmin } from '../modules/auth';
import { runInTransaction } from '../modules/db';
import { createUser, deleteUser, getUser } from '../modules/user';
import { messages } from '../modules/i18n';
import { ErrorCode } from '../modules/errors';
import { getNotifications } from '../modules/notification';
import { getDownloadsTransmission } from '../modules/transmission';
import { getWishlist } from '../modules/wishlist';
import { UserStatusBar } from '../../common/user';

const router = Router();
router.use(authentication);

router.post('/user/accept-legal', (req, res) => {
  try {
    runInTransaction(({ writeStore }) => {
      let user = getUser(req.user.id);
      if (!user)
        throw new Error('User not found');
      user.flags.legalAccepted = true;
      writeStore('user', user.id, user);
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: messages.settings.failedUpdate });
  }
});

router.get('/users', withAdmin, (req, res) => {
  const withAdmin = req.query.admin === 'true';
  const users = getUsers();

  // Return all users except admin
  const nonAdminUsers = users
    .filter((user) => user.id !== 1 || withAdmin);

  res.json(nonAdminUsers);
});

router.post('/users', withAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim();
  if (!username) {
    res.status(400).json({ error: messages.auth.usernameRequired });
    return;
  }
  const { user, password } = createUser(username);
  res.json({ username: user.username, password });
});

router.delete('/users/:id', withAdmin, (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  deleteUser(userId);
  res.json({ ok: true });
});

router.post('/users/:id/reset-password', withAdmin, (req, res) => {
  const userId = parseInt(String(req.params.id), 10);
  if (userId === 1) {
    res.status(400).json({ error: messages.auth.cannotModifyAdmin });
    return;
  }
  const user = getUser(userId);
  if (!user) {
    res.status(404).json({ error: messages.auth.userNotFound });
    return;
  }

  const newPassword = resetAuth(userId);
  res.json({ ok: true, password: newPassword });
});

router.get('/user', async (req, res) => {
  const userId = req.user.id;

  // Téléchargements actifs
  let downloads = 0;
  try {
    const torrents = await getDownloadsTransmission(userId, {});
    downloads = torrents.filter(t => t.leftUntilDone > 0 && !t.isFinished).length;
  } catch { /* Transmission non configuré ou inaccessible */ }

  // Wishlist
  let wishlist = 0;
  try {
    const items = await getWishlist(userId);
    wishlist = items.length;
  } catch { /* ignore */ }

  // Notifications non lues + dernière notification
  const { notifications: notifList, unreadCount } = getNotifications(userId, { limit: 1, unreadOnly: true });
  const latest = notifList[0] ?? null;

  const data: UserStatusBar = {
    downloads,
    wishlist,
    notifications: unreadCount,
    latestNotification: latest
      ? { id: latest.id, title: latest.title, message: latest.message, type: latest.type }
      : null,
  };
  res.json(data);
});

export { router };
