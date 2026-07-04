import { Router } from 'express';
import { authentication, getUsers, resetAuth, withAdmin } from '../modules/auth';
import { runInTransaction } from '../modules/db';
import { createUser, deleteUser, getUser } from '../modules/user';
import { messages } from '../modules/i18n';
import { ErrorCode } from '../modules/errors';
import { UserStatusBar } from '../../common/user';

const router = Router();
router.use(authentication);

router.post('/user/accept-legal', (req, res) => {
  try {
    runInTransaction(({ writeStore }) => {
      let user = getUser(req.user.id);
      if (!user)
        throw new Error('User not found');
      user.flags.acceptLegal = true;
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

router.get('/user', (req, res) => {
  let downoads = 0;
  let whishlist = 0;
  let notifications = 0;
  const data : UserStatusBar = {
    downloads: downoads,
    wishlist: whishlist,
    notifications: notifications
  }
  res.json(data);
});

export { router };
