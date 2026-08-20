// Point d'entrée principal du backend TypeScript
/// <reference path="./types/express.d.ts" />

import { NextFunction, Request, Response } from 'express';

import cookieParser from 'cookie-parser';
import { router as authRouter } from './routes/auth';
import { router as wishlistRouter } from './routes/wishlist';
import { router as userRouter } from './routes/user';
import { router as tmdbRouter } from './routes/tmdb';
import { router as transmissionRouter } from './routes/transmission';
import { router as indexerRouter } from './routes/indexer';
import { router as dbRouter } from './routes/db';
import { router as settingsRouter } from './routes/settings';
import { router as ftpRouter } from './routes/ftp';
import { router as notificationRouter } from './routes/notification';
import { initDB } from './modules/db';
import { startDownloadWatcher } from './modules/downloadWatcher';
import { ErrorCode } from './modules/errors';

import { Logger } from './logger';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express') as typeof import('express');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, '../dist');

initDB();
Logger.init();
startDownloadWatcher();

const app: import('express').Express = express();
app.disable('x-powered-by');

app.use(express.static(clientDistDir));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistDir, 'index.html'));
});

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || 'development-secret'));

app.use(Logger.express());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', authRouter);
app.use('/api', userRouter);
app.use('/api', wishlistRouter);
app.use('/api', tmdbRouter);
app.use('/api', transmissionRouter);
app.use('/api', indexerRouter);
app.use('/api/settings/database', dbRouter);
app.use('/api', settingsRouter);
app.use('/api', ftpRouter);
app.use('/api', notificationRouter);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErrorCode) {
    console.error(`Error: ${err.message}`);
    res.status(400).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Serveur backend TS démarré sur le port ${PORT}`);
});
server.on('error', (error) => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});
