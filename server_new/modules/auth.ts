import { NextFunction, Request, Response } from "express";
import { randomBytes, scryptSync } from "node:crypto";
import { db, runInTransaction } from "./db";
import { getUser } from "./user";
import { messages } from "./i18n";
import { ErrorCode } from "./errors";



export const authentication = (req: Request, res: Response, next: NextFunction) => {
    // Authentication Middleware
    const sessionToken = req.cookies['session'];
    if (!sessionToken) {
        return res.status(401).json({ error: messages.auth.authRequired });
    }
    const sessions = runInTransaction(()=>{
        db.exec('DELETE FROM auth_sessions WHERE created_at < datetime(\'now\', \'-15 days\')');
        return db.prepare('SELECT user_id, created_at FROM auth_sessions WHERE token = ?').get(sessionToken);
    });
    if (!sessions) {
        return res.status(401).json({ error: messages.auth.authRequired });
    }
    const userId = Number(sessions.user_id);
    const user = getUser(userId);
    if (!user) {
        return res.status(401).json({ error: messages.auth.failedReadSession });
    }

    req.user = user;
    next();
}

export const withAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (req.user.id !== 1) {
        res.status(403).json({ error: messages.auth.adminRequired });
        return;
    }
    next();
};

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    const hash = scryptSync(password, salt, 64).toString('hex');
    return { salt, hash };
}

export function createAuth(username: string, password: string | null = null) {
    if (!password) {
        password = generateSimpleUserPassword();
    }
    const { salt, hash } = hashPassword(password);
    const result = db.prepare('SELECT user_id FROM auth_users WHERE username = ?').get(username);
    if (result) 
        throw new ErrorCode(messages.auth.usernameAlreadyExists);
    const id = db.prepare('INSERT INTO auth_users (username, salt, hash) VALUES (?, ?, ?)').run(username, salt, hash).lastInsertRowid;
    return { id, password: password };
}

export function resetAuth(userId: number) {
    const generatedPassword = generateSimpleUserPassword();
    const { salt, hash } = hashPassword(generatedPassword);
    db.prepare('UPDATE auth_users SET salt = ?, hash = ?, updated_at = datetime("now") WHERE user_id = ?').run(salt, hash, userId);
    return generatedPassword;
}

export function getAuths() : { id: number, username: string }[] {
    const result = db.prepare('SELECT user_id, username FROM auth_users').all();
    return result.map((row: any) => ({ id: row.user_id, username: row.username }));
}

function generateSimpleUserPassword() {
    return randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
}