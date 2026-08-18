import { IndexerSettings, TransmissionSettings } from "../../common/settings";
import { User } from "../../common/user";
import { createAuth } from "./auth";
import { db, readStore, runInTransaction } from "./db";




export const getUser = (id: number): User | null => {
    const user = readStore('user', id);
    if (!user)
        return null;

    return {
        id: Number(user.id),
        username: String(user.username),
        flags: {
            mustSetup: Boolean(user.settings?.indexer === null && user.settings?.transmission === null),
            mustUpdatePassword: Boolean(user?.flags?.mustUpdatePassword),
            legalAccepted: Boolean(user?.flags?.legalAccepted)
        },
        settings: {
            indexer: user.settings?.indexer === null ? null : {
                url: String(user.settings.indexer?.url || ''),
                token: String(user.settings.indexer?.token || ''),
                qualities: Array.isArray(user.settings.indexer?.qualities) ? user.settings.indexer.qualities.map(String) : [],
                languages: Array.isArray(user.settings.indexer?.languages) ? user.settings.indexer.languages.map(String) : [],
            },
            transmission: user.settings?.transmission === null ? null : {
                host: String(user.settings.transmission?.host || ''),
                port: Number(user.settings.transmission?.port || 0),
                authRequired: Boolean(user.settings.transmission?.authRequired),
                username: String(user.settings.transmission?.username || ''),
                password: String(user.settings.transmission?.password || ''),
                moviesFolder: String(user.settings.transmission?.moviesFolder || ''),
                seriesFolder: String(user.settings.transmission?.seriesFolder || ''),
            },
            language: user.settings?.language === null ? null : String(user.settings.language || null),
            spoilerMode: Boolean(user.settings.spoilerMode || false)
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
                mustSetup: true,
                mustUpdatePassword: true,
                legalAccepted: false
            },
            settings: {
                indexer: null,
                transmission: null,
                language: null
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

export const updateUser = (user: User) => {
    return runInTransaction(({ writeStore }) => {
        writeStore('user', user.id, user);
    });
};