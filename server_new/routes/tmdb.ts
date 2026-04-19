import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import { buildDetailsRequest, buildGenresRequest, buildPopularRequest, buildSearchRequest, buildSeasonRequest, configureTmdbApiKey, proxyTmdb, TmdbType } from '../modules/tmdb';
import { ErrorCode } from '../modules/errors';
import { getTmdbApiKey } from '../modules/setting';
import { build } from 'vite';

const router = Router();

router.use(authentication);



router.get('/tmdb/configure', withAdmin, async (req, res) => {
    try {
        const apiKey = await getTmdbApiKey();
        res.status(200).json({ ok: apiKey !== null });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/tmdb/configure', withAdmin, async (req, res) => {
    try {
        const apiKey = String(req.body?.apiKey || '').trim();
        if (!apiKey) {
            res.status(400).json({ error: 'API key is required' });
            return;
        }
        await configureTmdbApiKey(apiKey);
        res.status(200).json({ message: 'TMDB API key configured successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/tmdb/:type/popular', async (req, res) => {
    try {
        const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
        const request = buildPopularRequest(type, req.query);
        const results = await proxyTmdb(request.path, request.query);
        res.json(results);
    } catch (error) {
        if (error instanceof ErrorCode) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.get('/tmdb/:type/search', async (req, res) => {
    try {
        const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
        const request = buildSearchRequest(type, req.query);
        const results = await proxyTmdb(request.path, request.query);
        res.json(results);
    } catch (error) {
        if (error instanceof ErrorCode) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.get('/tmdb/:type/genres', async (req, res) => {
    try {
        const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
        const request = buildGenresRequest(type, req.query);
        const results = await proxyTmdb(request.path, request.query);
        res.json(results);
    } catch (error) {
        if (error instanceof ErrorCode) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.get('/tmdb/:type/details/:id', async (req, res) => {
    try {
        const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
        const id = Number(req.params.id);
        const request = buildDetailsRequest(type, id, req.query);
        const results = await proxyTmdb(request.path, request.query);
        res.json(results);
    } catch (error) {
        if (error instanceof ErrorCode) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

router.get('/tmdb/series/details/:id/seasons/:seasonNumber', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const seasonNumber = Number(req.params.seasonNumber);
        const request = buildSeasonRequest(id, seasonNumber, req.query);
        const results = await proxyTmdb(request.path, request.query);
        res.json(results);
    } catch (error) {
        if (error instanceof ErrorCode) {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});

export { router };