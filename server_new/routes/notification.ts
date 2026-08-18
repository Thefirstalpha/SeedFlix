import { Router } from "express";
import { authentication } from "../modules/auth";
import {
    addNotification,
    clearNotifications,
    deleteNotification,
    getNotifications,
    markAllAsRead,
    markAsRead,
} from "../modules/notification";

const router = Router();
router.use(authentication);

// ─── Lecture ─────────────────────────────────────────────────────────────────

// GET /notifications?limit=50&unreadOnly=true
router.get('/notifications', (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = getNotifications(req.user.id, { limit, unreadOnly });
    res.json(result);
});

// ─── Marquer comme lu ─────────────────────────────────────────────────────────

// POST /notifications/:id/read
router.post('/notifications/:id/read', (req, res) => {
    const ok = markAsRead(req.user.id, req.params.id);
    if (!ok) { res.status(404).json({ error: 'Notification introuvable' }); return; }
    res.json({ ok: true });
});

// POST /notifications/read-all
router.post('/notifications/read-all', (req, res) => {
    markAllAsRead(req.user.id);
    res.json({ ok: true });
});

// ─── Suppression ──────────────────────────────────────────────────────────────

// DELETE /notifications/:id
router.delete('/notifications/:id', (req, res) => {
    const ok = deleteNotification(req.user.id, req.params.id);
    if (!ok) { res.status(404).json({ error: 'Notification introuvable' }); return; }
    res.json({ ok: true });
});

// DELETE /notifications  — vide toutes
router.delete('/notifications', (req, res) => {
    clearNotifications(req.user.id);
    res.json({ ok: true });
});


router.post('/notifications/test', (req, res) => {
    const notification = {
        title: 'Test Notification',
        message: 'Ceci est un test de notification.',
        type: 'info' as const,
        data: { test: true },
    };
    addNotification(req.user.id, notification);
    res.json({ ok: true });
});

export { router };
