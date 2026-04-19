import { createAuth } from "./auth";
import { db, readStore, runInTransaction } from "./db";



export interface User {
    id: number;
    username: string;
    flags: {
        updatePassword: boolean;
        acceptLegal: boolean;
    };
    settings: {
        indexer: {

        } | null;
    };
}


export const getUser = (id: number): User | null => {
    const user = readStore('user', id);
    if (!user) 
        return null;
    
    return {
        id: Number(user.id),
        username: String(user.username),
        flags: {
            updatePassword: Boolean(user?.flags?.updatePassword || true),
            acceptLegal: Boolean(user?.flags?.acceptLegal || true)
        },
        settings: {
            indexer: null,
        }
    };
}

export const createUser = (username: string, forcePassword: string | null = null): { user: User; password: string } => {
    return runInTransaction(({ writeStore }) => {
        const { id, password } = createAuth(username, forcePassword);
        const user: User = {
            id: Number(id),
            username,
            flags: {
                updatePassword: true,
                acceptLegal: true
            },
            settings: {
                indexer: null
            },
        };
        writeStore('user', user.id, user);
        return { user, password };
    });
}


export const deleteUser = (id: number) => {
    return runInTransaction(() => {
        db.prepare('DELETE FROM auth_users WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM kv_store WHERE user_id = ?').run(id);
    });
}