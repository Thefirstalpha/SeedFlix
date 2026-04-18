// Point d'entrée principal du backend TypeScript
import express from 'express';
import { randomUUID } from "crypto"
import cookieParser from "cookie-parser"
import { router as authRouter } from './routes/auth';
import { router as wishlistRouter } from './routes/wishlist';
import { router as userRouter } from './routes/user';
import { router as tmdbRouter } from './routes/tmdb';
import { User } from './modules/user';
import { logger } from './config';
import { initDB } from './modules/db';

initDB();

declare module "express-serve-static-core" {
    interface Request {
        user: User;
        correlationId: string;
    }
}

const app = express();
app.use(express.json());
app.use(cookieParser("204e03f6-18b8-4c8c-945a-d32a1a5b9f20"));

app.use((req, res, next) => {
    req.correlationId = randomUUID();
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration,
            correlationId: req.correlationId,
        }, "express_request")
    })
    next();
});

app.use('/api', authRouter);
app.use('/api', userRouter);
app.use('/api', wishlistRouter);
app.use('/api', tmdbRouter);

// Exemple de route racine
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Serveur backend TS démarré sur le port ${PORT}`);
});
