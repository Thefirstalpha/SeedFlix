import { Router } from 'express';
import { messages } from '../modules/i18n';
import { randomBytes } from 'crypto';
import { config, logger } from '../config';
import { db, readStore, runInTransaction } from '../modules/db';
import { authentication, hashPassword } from '../modules/auth';
import { get } from 'http';
import { getUser } from '../modules/user';

const router = Router();


router.get('/auth/me', authentication, (req, res) => {
    res.json({ user: req.user });
});

router.post('/auth/login', (req, res) => {
  try{
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        res.status(400).json({ error: messages.auth.usernamePasswordRequired });
        return;
      }
      const result = db.prepare('SELECT user_id, hash, salt FROM auth_users WHERE username = ?;').get(username);
      if (!result) {
        res.status(401).json({ error: messages.auth.invalidCredentials });
        return;
      }
      const user_id = Number(result.user_id);
      const { hash, salt } = hashPassword(password, String(result.salt));
      if (hash !== result.hash) {
        res.status(401).json({ error: messages.auth.invalidCredentials });
        return;
      }

      const user = getUser(user_id);

      const token = randomBytes(24).toString('hex');

      db.prepare('INSERT INTO auth_sessions (id, user_id, token) VALUES (?, ?, ?);').run(randomBytes(16).toString('hex'), user_id, token);

      res.cookie('session', token, { httpOnly: true, maxAge: config.sessionDurationMs });
      res.json({ ok: true, user: user });
  } catch (error) {
    logger.debug({ error }, 'Error during login');
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/auth/logout', authentication,  (req, res) => {
  try{
      const sessionToken = req.cookies['session'];
      if (sessionToken) {
        db.prepare('DELETE FROM auth_sessions WHERE token = ? AND user_id = ?').run(sessionToken, req.user.id);
        res.clearCookie('session');
      }
      res.json({ message: 'Logout successful' });
  } catch (error) {
      logger.error({ error }, 'Error during logout');
      res.status(500).json({ error: 'Internal server error' });

  }
});

export { router };
