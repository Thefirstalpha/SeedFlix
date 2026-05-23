import { IndexerSettings, TransmissionSettings } from "../../common/settings";
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
        indexer: IndexerSettings | null;
        transmission: TransmissionSettings | null;
    };
}


export const getUser = (id: number): User | null => {
    const user = readStore('user', id);
    if (!user)
        return null;

    user

    return {
        id: Number(user.id),
        username: String(user.username),
        flags: {
            updatePassword: Boolean(user?.flags?.updatePassword || true),
            acceptLegal: Boolean(user?.flags?.acceptLegal || true)
        },
        settings: {
            indexer: user.settings?.indexer === undefined ? null : {
                url: String(user.settings.indexer?.url || ''),
                token: String(user.settings.indexer?.token || ''),
                qualities: Array.isArray(user.settings.indexer?.qualities) ? user.settings.indexer.qualities.map(String) : [],
                languages: Array.isArray(user.settings.indexer?.languages) ? user.settings.indexer.languages.map(String) : [],
            },
            transmission: user.settings?.transmission === undefined ? null : {
                host: String(user.settings.transmission?.host || ''),
                port: Number(user.settings.transmission?.port || 0),
                authRequired: Boolean(user.settings.transmission?.authRequired || false),
                username: String(user.settings.transmission?.username || ''),
                password: String(user.settings.transmission?.password || ''),
                moviesFolder: String(user.settings.transmission?.moviesFolder || ''),
                seriesFolder: String(user.settings.transmission?.seriesFolder || ''),
            },
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
                indexer: null,
                transmission: null,
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