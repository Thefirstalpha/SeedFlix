import { Router } from "express";
import { authentication, withAdmin } from "../modules/auth";
import { resetDatabase, runInTransaction } from "../modules/db";
import { getUser } from "../modules/user";

const router = Router();
router.use(authentication);


router.post('/settings/reset', withAdmin, async (req, res) => {
    resetDatabase();
    res.clearCookie('session');
    res.status(200).json({ ok: true, loggedOut: true, message: "Database reset successfully" });
});

router.post('/settings/language', async (req, res) => {
    const { language } = req.body;
    runInTransaction(({ writeStore }) => {
        let user = getUser(req.user.id);
        if (!user)
            throw new Error('User not found');
        user.settings.language = language;
        writeStore('user', user.id, user);
    });
    res.status(200).json({ message: `Language updated to ${language}` });
});

router.post('/settings/spoiler', async (req, res) => {
    const { spoiler } = req.body;
    runInTransaction(({ writeStore }) => {
        let user = getUser(req.user.id);
        if (!user)
            throw new Error('User not found');
        user.settings.spoilerMode = spoiler;
        writeStore('user', user.id, user);
    });
    res.status(200).json({ message: `Spoiler mode updated to ${spoiler}` });
});

export { router };