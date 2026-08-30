import { User, WebPushSubscription } from '../../common/user';
import { createAuth } from './auth';
import { decryptSecret, encryptSecret } from './crypto';
import { db, readStore, runInTransaction } from './db';

function normalizeWebPushSubscriptions(subscriptions: unknown): WebPushSubscription[] {
  if (!Array.isArray(subscriptions)) return [];

  return subscriptions
    .filter(
      (subscription: any) =>
        subscription?.id &&
        subscription?.name &&
        subscription?.endpoint &&
        subscription?.keys?.p256dh &&
        subscription?.keys?.auth,
    )
    .map((subscription: any) => ({
      id: String(subscription.id),
      name: String(subscription.name),
      endpoint: String(subscription.endpoint),
      keys: {
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
      },
      createdAt: String(subscription.createdAt || new Date(0).toISOString()),
    }));
}

function normalizeDiscordNotification(discord: any): User['notifications']['discord'] {
  if (discord === null || discord === undefined) return null;
  return { webhookUrl: String(discord.webhookUrl) };
}

export function serializeUser(user: User): Record<string, any> {
  const copy: any = JSON.parse(JSON.stringify(user));
  if (copy.settings?.indexer?.token) {
    copy.settings.indexer.token = encryptSecret(copy.settings.indexer.token);
  }
  if (copy.settings?.transmission?.password) {
    copy.settings.transmission.password = encryptSecret(copy.settings.transmission.password);
  }
  if (copy.settings?.ftp?.password) {
    copy.settings.ftp.password = encryptSecret(copy.settings.ftp.password);
  }
  return copy;
}

export const getUser = (id: number): User | null => {
  const user = readStore('user', id);
  if (!user) return null;

  const initialPassword = Boolean(user?.flags?.initialPassword);
  const mustUpdatePassword = Boolean(user?.flags?.mustUpdatePassword);
  const legalAccepted = Boolean(user?.flags?.legalAccepted);
  const hasIndexer = user.settings?.indexer !== null;
  const hasTransmission = user.settings?.transmission !== null;

  return {
    id: Number(user.id),
    username: String(user.username),
    flags: {
      mustSetup: Boolean(!legalAccepted || initialPassword || !hasIndexer || !hasTransmission),
      initialPassword,
      mustUpdatePassword,
      legalAccepted,
    },
    settings: {
      indexer:
        user.settings?.indexer === null
          ? null
          : {
              url: String(user.settings.indexer?.url || ''),
              token: decryptSecret(String(user.settings.indexer?.token || '')) || '',
              qualities: Array.isArray(user.settings.indexer?.qualities)
                ? user.settings.indexer.qualities.map(String)
                : [],
              languages: Array.isArray(user.settings.indexer?.languages)
                ? user.settings.indexer.languages.map(String)
                : [],
              autoDownload: Boolean(user.settings.indexer?.autoDownload),
            },
      transmission:
        user.settings?.transmission === null
          ? null
          : {
              host: String(user.settings.transmission?.host || ''),
              port: Number(user.settings.transmission?.port || 0),
              authRequired: Boolean(user.settings.transmission?.authRequired),
              username: String(user.settings.transmission?.username || ''),
              password: decryptSecret(String(user.settings.transmission?.password || '')) || '',
              moviesFolder: String(user.settings.transmission?.moviesFolder || ''),
              seriesFolder: String(user.settings.transmission?.seriesFolder || ''),
            },
      ftp:
        user.settings?.ftp === null
          ? null
          : {
              host: String(user.settings.ftp?.host || ''),
              port: Number(user.settings.ftp?.port || 0),
              secure: Boolean(user.settings.ftp?.secure ?? false),
              authRequired: Boolean(user.settings.ftp?.authRequired),
              username:
                user.settings.ftp?.username !== undefined
                  ? String(user.settings.ftp?.username || '')
                  : undefined,
              password:
                user.settings.ftp?.password !== undefined
                  ? decryptSecret(String(user.settings.ftp?.password || '')) || ''
                  : undefined,
              rootFolder: String(user.settings.ftp?.rootFolder || ''),
              storageLimit:
                user.settings.ftp?.storageLimit === null
                  ? null
                  : Number(user.settings.ftp?.storageLimit || 0),
            },
      language: user.settings?.language === null ? null : String(user.settings.language || null),
      spoilerMode: Boolean(user.settings.spoilerMode || false),
    },
    notifications: {
      discord: normalizeDiscordNotification(user.notifications?.discord),
      web: {
        subscriptions: normalizeWebPushSubscriptions(user.notifications?.web?.subscriptions),
      },
    },
  };
};

export const createUser = (
  username: string,
  forcePassword: string | null = null,
): { user: User; password: string } => {
  return runInTransaction(({ writeStore }) => {
    const { id, password } = createAuth(username, forcePassword);
    const user: User = {
      id: Number(id),
      username,
      flags: {
        mustSetup: true,
        initialPassword: true,
        mustUpdatePassword: false,
        legalAccepted: false,
      },
      settings: {
        indexer: null,
        transmission: null,
        ftp: null,
        language: 'en',
        spoilerMode: false,
      },
      notifications: {
        discord: null,
        web: {
          subscriptions: [],
        },
      },
    };
    writeStore('user', user.id, serializeUser(user));
    return { user, password };
  });
};

export const deleteUser = (id: number) => {
  return runInTransaction(() => {
    db.prepare('DELETE FROM auth_users WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM kv_store WHERE user_id = ?').run(id);
  });
};

export const updateUser = (user: User) => {
  return runInTransaction(({ writeStore }) => {
    writeStore('user', user.id, serializeUser(user));
  });
};
