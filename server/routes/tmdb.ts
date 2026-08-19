import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import {
  buildDetailsRequest,
  buildGenresRequest,
  buildPopularRequest,
  buildSearchRequest,
  buildSeasonRequest,
  configureTmdbApiKey,
  proxyTmdb,
  TmdbType,
} from '../modules/tmdb';
import { getTmdbApiKey } from '../modules/setting';

const router = Router();

router.use(authentication);

router.get('/tmdb/configure', withAdmin, async (req, res) => {
  const apiKey = await getTmdbApiKey();
  res.status(200).json({ ok: apiKey !== null });
});

router.post('/tmdb/configure', withAdmin, async (req, res) => {
  const apiKey = String(req.body?.apiKey || '').trim();
  if (!apiKey) {
    res.status(400).json({ error: 'API key is required' });
    return;
  }
  await configureTmdbApiKey(apiKey);
  res.status(200).json({ message: 'TMDB API key configured successfully' });
});

router.get('/tmdb/:type/popular', async (req, res) => {
  const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
  const request = buildPopularRequest(type, req.query);
  const results = await proxyTmdb(request.path, request.query);
  res.json(results);
});

router.get('/tmdb/:type/search', async (req, res) => {
  const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
  const request = buildSearchRequest(type, req.query);
  const results = await proxyTmdb(request.path, request.query);
  res.json(results);
});

router.get('/tmdb/:type/genres', async (req, res) => {
  const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
  const request = buildGenresRequest(type, req.query);
  const results = await proxyTmdb(request.path, request.query);
  res.json(results);
});

router.get('/tmdb/:type/details/:id', async (req, res) => {
  const type = req.params.type === 'movie' ? TmdbType.movie : TmdbType.series;
  const id = Number(req.params.id);
  const request = buildDetailsRequest(type, id, req.query);
  const results = await proxyTmdb(request.path, request.query);
  res.json(results);
});

router.get('/tmdb/series/details/:id/seasons/:seasonNumber', async (req, res) => {
  const id = Number(req.params.id);
  const seasonNumber = Number(req.params.seasonNumber);
  const request = buildSeasonRequest(id, seasonNumber, req.query);
  const results = await proxyTmdb(request.path, request.query);
  res.json(results);
});

export { router };
