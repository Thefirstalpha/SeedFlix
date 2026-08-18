// Point d'entrée principal du backend TypeScript
import express, { NextFunction, Request, Response } from 'express';

import { randomUUID } from "crypto"
import cookieParser from "cookie-parser"
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
import { User } from '../common/user';

initDB();
Logger.init();
startDownloadWatcher();

declare module "express-serve-static-core" {
    interface Request {
        user: User;
        correlationId: string;
    }
}

const app = express();
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || "development-secret"));

app.use(Logger.express());

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

// Exemple de route racine
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ErrorCode) {
        console.error(`Error: ${err.message}`,);
        res.status(400).json({ error: err.message });
    } else {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
})

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Serveur backend TS démarré sur le port ${PORT}`);
});
