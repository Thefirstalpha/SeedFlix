import { Router } from 'express';
import { messages } from '../modules/i18n';
import { randomBytes } from 'node:crypto';
import { db, runInTransaction } from '../modules/db';
import { config } from '../config';
import { authentication, hashPassword, resetPassword } from '../modules/auth';
import { getUser } from '../modules/user';

const router = Router();

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z\d]/.test(password)) return false;
  return true;
}

router.get('/auth/me', authentication, (req, res) => {
  res.json({ user: req.user });
});

router.post('/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    res.status(400).json({ error: messages.auth.usernamePasswordRequired });
    return;
  }
  const result = db
    .prepare('SELECT user_id, hash, salt FROM auth_users WHERE username = ?;')
    .get(username);
  if (!result) {
    res.status(401).json({ error: messages.auth.invalidCredentials });
    return;
  }
  const user_id = Number(result.user_id);
  const { hash } = hashPassword(password, String(result.salt));
  if (hash !== result.hash) {
    res.status(401).json({ error: messages.auth.invalidCredentials });
    return;
  }

  const user = getUser(user_id);

  const token = randomBytes(24).toString('hex');

  db.prepare('INSERT INTO auth_sessions (id, user_id, token) VALUES (?, ?, ?);').run(
    randomBytes(16).toString('hex'),
    user_id,
    token,
  );

  res.cookie('session', token, { httpOnly: true, maxAge: config.sessionDurationMs });
  res.json({ ok: true, user: user });
});

router.post('/auth/reset-password', authentication, (req, res) => {
  const password = String(req.body?.password || '');
  if (!isStrongPassword(password)) {
    res.status(400).json({
      error:
        'Le mot de passe doit contenir au moins 8 caracteres, avec majuscule, minuscule, chiffre et caractere special.',
    });
    return;
  }
  resetPassword(req.user.id, password);
  runInTransaction(({ writeStore }) => {
    let user = getUser(req.user.id);
    if (!user) throw new Error('User not found');
    user.flags.mustUpdatePassword = false;
    user.flags.initialPassword = false;
    writeStore('user', user.id, user);
  });
  res.json({ ok: true });
});

router.post('/auth/accept-legal', authentication, (req, res) => {
  runInTransaction(({ writeStore }) => {
    let user = getUser(req.user.id);
    if (!user) throw new Error('User not found');
    user.flags.legalAccepted = true;
    writeStore('user', user.id, user);
  });
  res.json({ ok: true });
});

router.post('/auth/logout', authentication, (req, res) => {
  const sessionToken = req.cookies['session'];
  if (sessionToken) {
    db.prepare('DELETE FROM auth_sessions WHERE token = ? AND user_id = ?').run(
      sessionToken,
      req.user.id,
    );
    res.clearCookie('session');
  }
  res.json({ message: 'Logout successful' });
});

export { router };
