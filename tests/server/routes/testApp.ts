import express, { NextFunction, Request, Response, Router } from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';
import { db } from '../../../server/modules/db';
import { ErrorCode } from '../../../server/modules/errors';

export function createTestApp(router: Router, basePath = '/api') {
  const app = express();
  app.use(express.json());
  app.use(cookieParser('development-secret'));

  app.use(basePath, router);

  // Error handler matching server/index.ts
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ErrorCode) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err?.message || 'Internal server error' });
    }
  });

  return app;
}

export function createSessionCookie(userId: number): string {
  const token = randomBytes(24).toString('hex');
  db.prepare(
    "INSERT INTO auth_sessions (id, user_id, token, created_at) VALUES (?, ?, ?, datetime('now'))",
  ).run(randomBytes(16).toString('hex'), userId, token);
  return `session=${token}`;
}

