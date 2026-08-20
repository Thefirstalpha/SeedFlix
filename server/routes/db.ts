import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import { listNamespaces, readStore, writeStore } from '../modules/db';
import { messages } from '../modules/i18n';

const router = Router();
router.use(authentication);
router.use(withAdmin);

router.get('/', async (req, res) => {
  res.json({ namespaces: listNamespaces() });
});

router.get('/:userid/:namespace', async (req, res) => {
  const namespace = String(req.params.namespace || '').trim();
  const userId = Number(req.params.userid);
  if (!namespace || Number.isNaN(userId)) {
    res.status(400).json({ error: messages.settings.failedLoadSettings });
    return;
  }

  const entry = readStore(namespace, userId);
  if (!entry) {
    res.status(404).json({ error: messages.settings.failedLoadSettings });
    return;
  }

  res.json(entry);
});

router.put('/:userid/:namespace', async (req, res) => {
  const namespace = String(req.params.namespace || '').trim();
  const userId = Number(req.params.userid);
  const rawValue = String(req.body?.value || '');

  if (!namespace || !rawValue.trim()) {
    res.status(400).json({ error: messages.settings.failedUpdateSettings });
    return;
  }

  const value = JSON.parse(rawValue);

  const updatedEntry = writeStore(namespace, userId, value);
  res.json(updatedEntry);
});

export { router };
