import { Router } from 'express';
import { authentication } from '../modules/auth';
import { addToWishlist, deleteWishlist, getWishlist } from '../modules/wishlist';

const router = Router();

router.use(authentication);

router.get('/wishlist', async (req, res) => {
  const wishlist = await getWishlist(req.user.id);
  res.json(wishlist);
});

router.post('/wishlist', async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  await addToWishlist(req.user.id, tmdbId, type, season, episode);
  res.status(201).json({ ok: true });
});

router.delete('/wishlist', async (req, res) => {
  const { tmdbId, type, season, episode } = req.body;
  await deleteWishlist(req.user.id, tmdbId, type, season, episode);
  res.json({ ok: true });
});
router.delete('/wishlists', async (req, res) => {
  for (const item of req.body.items) {
    const { tmdbId, type, season, episode } = item;
    await deleteWishlist(req.user.id, tmdbId, type, season, episode);
  }
  res.json({ ok: true });
});

router.get('/wishlist/:id', async (req, res) => {
  const wishlist = await getWishlist(req.user.id);
  const item = wishlist.find((i) => i.tmdb === parseInt(req.params.id));
  res.json({ exists: !!item, content: item });
});

router.delete('/wishlist/:id', async (req, res) => {
  await deleteWishlist(req.user.id, parseInt(req.params.id));
  res.json({ ok: true });
});

export { router };
