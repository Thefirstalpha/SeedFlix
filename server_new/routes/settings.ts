import { Router } from "express";
import { authentication, withAdmin } from "../modules/auth";
import { resetDatabase } from "../modules/db";

const router = Router();
router.use(authentication);


router.post('/settings/reset', withAdmin, async (req, res) => {
    resetDatabase();
    res.status(200).json({ message: "Database reset successfully" });
});

export { router };