import { Router } from 'express';
import { authentication, withAdmin } from '../modules/auth';
import { listNamespaces, readStore } from '../modules/db';


const router = Router();
router.use(authentication);



router.get('/settings/database', withAdmin, async (req, res) => {
    res.json({ namespaces: listNamespaces() });
});

router.get(
    '/api/settings/database/:userid/:namespace', withAdmin, async (req, res) => {
        const namespace = String(req.params.namespace || '').trim();
        const userId = String(req.params.userid || '').trim();
        if (!namespace) {
            res.status(400).json({ error: t('auth.failedLoadSettings') });
            return;
        }

        const entry = readStore(namespace);
        if (!entry) {
            res.status(404).json({ error: t('auth.failedLoadSettings') });
            return;
        }

        res.json(entry);
    });

router.put('/api/settings/database/:namespace', withAdmin, async (req, res) => {
    const namespace = String(req.params.namespace || '').trim();
    const rawValue = String(req.body?.value || '');

    if (!namespace || !rawValue.trim()) {
        res.status(400).json({ error: t('auth.failedUpdateSettings') });
        return;
    }

    const updatedEntry = writeRawJsonStore(namespace, rawValue);
    res.json(updatedEntry);
});


export { router };