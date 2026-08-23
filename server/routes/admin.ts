import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import { Logger } from '../logger';

const router = Router();
router.use(authentication);
router.use(withAdmin);

router.get('/admin/logs', (req, res) => {
  res.status(200).json({ logs: Logger.buffer });
});

export { router };
