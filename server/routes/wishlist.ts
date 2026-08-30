import { Router } from 'express';
import { authentication } from '../modules/auth';
import {
  addToWishlist,
  deleteWishlist,
  deleteWishlistItems,
  getWishlist,
  updateWishlistAutoGrab,
} from '../modules/wishlist';

const router = Router();

router.use(authentication);

router.get('/wishlist', async (req, res) => {
  const wishlist = await getWishlist(req.user.id);
  res.json(wishlist);
});

router.post('/wishlist', async (req, res) => {
  const { tmdbId, type, season, episode, autoGrab } = req.body;
  await addToWishlist(req.user.id, tmdbId, type, season, episode, autoGrab);
  res.status(201).json({ ok: true });
});

router.patch('/wishlist/:id/autograb', (req, res) => {
  const tmdbId = Number.parseInt(req.params.id);
  const { type, autoGrab, season, seasonNumber, episode, episodeNumber } = req.body;
  const targetSeason = seasonNumber ?? season;
  const targetEpisode = episodeNumber ?? episode;
  const updated = updateWishlistAutoGrab(
    req.user.id,
    tmdbId,
    type === 'series' ? 'series' : 'movie',
    Boolean(autoGrab),
    targetSeason !== undefined ? Number(targetSeason) : undefined,
    targetEpisode !== undefined ? Number(targetEpisode) : undefined,
  );
  res.json({ ok: updated });
});

router.delete('/wishlist', async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  await deleteWishlist(req.user.id, tmdbId, type, season, episode);
  res.json({ ok: true });
});
router.delete('/wishlists', async (req, res) => {
  if (Array.isArray(req.body.items)) {
    await deleteWishlistItems(req.user.id, req.body.items);
  }
  res.json({ ok: true });
});

router.get('/wishlist/:id', async (req, res) => {
  const wishlist = await getWishlist(req.user.id);
  const type = req.query.type as string | undefined;
  const item = wishlist.find(
    (i) => i.tmdb === Number.parseInt(req.params.id) && (!type || i.type === type),
  );
  res.json({ exists: !!item, content: item });
});

router.delete('/wishlist/:id', async (req, res) => {
  await deleteWishlist(req.user.id, Number.parseInt(req.params.id));
  res.json({ ok: true });
});

export { router };
