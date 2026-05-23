import { Router } from 'express';
import { authentication, getAuths, resetAuth, withAdmin } from '../modules/auth';
import { runInTransaction } from '../modules/db';
import { createUser, deleteUser, getUser } from '../modules/user';
import { messages } from '../modules/i18n';
import { ErrorCode } from '../modules/errors';

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
  const users = getAuths();

  // Return all users except admin
  const nonAdminUsers = users
    .filter((user) => user.id !== 1);

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

router.post('/api/users/:id/reset-password', withAdmin, (req, res) => {
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

export { router };
