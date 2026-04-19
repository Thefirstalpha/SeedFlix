import { Router } from 'express';
import { authentication } from '../modules/auth';

const router = Router();

router.use(authentication);

router.get('/api/wishlist', (req, res) => {
  // À implémenter
  res.json({ message: 'Wishlist endpoint (TS)' });
});

export { router };
