import { promises as fs } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  appImageTag,
  authCookieName,
  defaultSettingsFilePath,
  sessionDurationMs,
} from "../config.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";
import {
  listJsonStores,
  mutateJsonStore,
  readJsonStore,
  readRawJsonStore,
  runInTransaction,
  writeRawJsonStore,
  writeJsonStore,
} from "../db.js";

const USERS_STORE_KEY = "auth.users";
const SESSIONS_STORE_KEY = "auth.sessions";
const GLOBAL_CONFIG_STORE_KEY = "auth.global-config";
const APP_TORRENTS_STORE_KEY = "transmission.app-torrents";

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

const SIMPLE_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateSimpleUserPassword(length = 10) {
  const randomValues = randomBytes(length);
  return Array.from(randomValues)
    .map((value) => SIMPLE_PASSWORD_CHARS[value % SIMPLE_PASSWORD_CHARS.length])
    .join("");
}

function verifyPassword(password, salt, expectedHash) {
  const calculatedHash = scryptSync(password, salt, 64);
  const storedHash = Buffer.from(expectedHash, "hex");

  return (
    calculatedHash.length === storedHash.length &&
    timingSafeEqual(calculatedHash, storedHash)
  );
}

function buildDefaultSettings(username = "admin") {
  return {
    profile: {
      username,
    },
    security: {
      lastPasswordChangeAt: new Date().toISOString(),
    },
    apiKeys: {
      tmdb: "",
    },
    placeholders: {
      notifications: {
        enabledChannels: [],
        discord: {
          webhookUrl: "",
        },
        browser: {
          devices: [],
        },
      },
      preferences: {
        language: "fr",
        spoilerMode: false,
      },
      torrent: {
        url: "",
        port: "",
        authRequired: false,
        username: "",
        password: "",
        moviesFolder: "",
        seriesFolder: "",
      },
      indexer: {
        url: "",
        token: "",
        defaultQuality: "all",
      },
    },
  };
}

function defaultUserRecord() {
  const { salt, hash } = hashPassword("admin");
  return {
    id: 1,
    username: "admin",
    passwordSalt: salt,
    passwordHash: hash,
    mustChangePassword: true,
    firstLoginPending: false,
    settings: buildDefaultSettings("admin"),
  };
}

async function readUsers() {
  const users = readJsonStore(USERS_STORE_KEY, [defaultUserRecord()]);
  return Array.isArray(users) ? users : [defaultUserRecord()];
}

export { readUsers };

async function readSessions() {
  const sessions = readJsonStore(SESSIONS_STORE_KEY, []);
  return Array.isArray(sessions) ? sessions : [];
}

async function readDefaultSettings() {
  let content = "";
  try {
    content = await fs.readFile(defaultSettingsFilePath, "utf-8");
  } catch {
    return buildDefaultSettings("admin");
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return buildDefaultSettings("admin");
    }

    return parsed;
  } catch {
    return buildDefaultSettings("admin");
  }
}

async function ensureUsersStore() {
  mutateJsonStore(USERS_STORE_KEY, [defaultUserRecord()], (users) => {
    const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
    return safeUsers.length === 0 ? [defaultUserRecord()] : safeUsers;
  });
}

export async function initializeAuthStores() {
  await ensureUsersStore();
  mutateJsonStore(SESSIONS_STORE_KEY, [], (sessions) =>
    Array.isArray(sessions) ? sessions : []
  );
  writeJsonStore(GLOBAL_CONFIG_STORE_KEY, await readGlobalConfig());
}

function isTorrentConfigured(user) {
  const torrentSettings = user?.settings?.placeholders?.torrent || {};
  const hasEndpoint = Boolean(String(torrentSettings.url || "").trim());
  const hasPort = Boolean(String(torrentSettings.port || "").trim());

  if (!hasEndpoint || !hasPort) {
    return false;
  }

  if (!torrentSettings.authRequired) {
    return true;
  }

  return Boolean(
    String(torrentSettings.username || "").trim() &&
      String(torrentSettings.password || "").trim()
  );
}

function isIndexerConfigured(user) {
  const indexerSettings = user?.settings?.placeholders?.indexer || {};
  return Boolean(
    String(indexerSettings.url || "").trim() &&
      String(indexerSettings.token || "").trim()
  );
}

async function buildSetupStatus(user) {
  const isAdmin = user?.username === "admin";
  const mustChangePassword = Boolean(user?.mustChangePassword || user?.firstLoginPending);
  const globalConfig = await readGlobalConfig();
  const isGlobalTmdbConfigured = Boolean(globalConfig.tmdbApiKey);
  // TMDB is a global/admin setting - only admin needs to configure it
  const mustConfigureTmdb = isAdmin && !isGlobalTmdbConfigured;
  const mustConfigureTorrent = !isTorrentConfigured(user);
  const mustConfigureIndexer = !isIndexerConfigured(user);
  const shouldChangePassword = Boolean(user?.shouldChangePassword);
  const legalAccepted = Boolean(user?.legalAcceptedAt);

  return {
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
    shouldChangePassword,
    legalAccepted,
    needsInitialSetup:
      !legalAccepted ||
      mustChangePassword ||
      mustConfigureTmdb ||
      mustConfigureTorrent ||
      mustConfigureIndexer,
  };
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rawValue.join("="));
    return cookies;
  }, {});
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader(
    "Set-Cookie",
    `${authCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${authCookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(0).toUTCString()}`
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
  };
}

function sanitizeSettingsPayload(settings) {
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  return {
    profile: safeSettings.profile || { username: "admin" },
    security: safeSettings.security || {},
    apiKeys: safeSettings.apiKeys || {},
    placeholders: {
      notifications: safeSettings.placeholders?.notifications || {},
      preferences: safeSettings.placeholders?.preferences || {},
      torrent: safeSettings.placeholders?.torrent || {},
      indexer: safeSettings.placeholders?.indexer || {},
    },
  };
}

function buildClientSettingsPayload(settings) {
  return {
    ...sanitizeSettingsPayload(settings),
    appInfo: {
      imageTag: appImageTag,
    },
  };
}

async function getAuthenticatedUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const sessionToken = cookies[authCookieName];
  if (!sessionToken) {
    return null;
  }

  let activeSessions = [];
  const now = Date.now();
  mutateJsonStore(SESSIONS_STORE_KEY, [], (sessions) => {
    const safeSessions = Array.isArray(sessions) ? sessions : [];
    activeSessions = safeSessions.filter((session) => Number(session.expiresAt) > now);
    return activeSessions.length === safeSessions.length ? safeSessions : activeSessions;
  });

  const session = activeSessions.find((entry) => entry.token === sessionToken);
  if (!session) {
    return null;
  }

  const users = await readUsers();
  const user = users.find((entry) => entry.id === session.userId);
  if (!user) {
    return null;
  }

  return { user, session, sessions: activeSessions };
}

async function requireAuth(req, res) {
  const t = getTranslator(req);
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    res.status(401).json({ error: t("common.authRequired") });
    return null;
  }

  return auth;
}

function withAuth(handler) {
  return async (req, res) => {
    const auth = await requireAuth(req, res);
    if (!auth) {
      return;
    }

    return handler(req, res, auth);
  };
}

function withAdmin(handler) {
  return withAuth(async (req, res, auth) => {
    const t = getTranslator(req, auth.user);
    if (auth.user.username !== "admin") {
      res.status(403).json({ error: t("auth.adminRequired") });
      return;
    }

    return handler(req, res, auth);
  });
}

export { getAuthenticatedUser, requireAuth, withAuth, withAdmin };

export async function getGlobalTmdbApiKey() {
  const globalConfig = await readGlobalConfig();
  return globalConfig.tmdbApiKey || "";
}

export function registerAuthRoutes(app) {
  app.get("/api/auth/me", async (req, res) => {
    const t = getTranslator(req);
    try {
      const auth = await getAuthenticatedUser(req);
      if (!auth) {
        res.json({
          authenticated: false,
          mustChangePassword: false,
          mustConfigureTmdb: false,
          mustConfigureTorrent: false,
          mustConfigureIndexer: false,
          shouldChangePassword: false,
          needsInitialSetup: false,
          legalAccepted: false,
        });
        return;
      }

      res.json({
        authenticated: true,
        user: sanitizeUser(auth.user),
        ...(await buildSetupStatus(auth.user)),
        settings: buildClientSettingsPayload(auth.user.settings),
      });
    } catch (error) {
      debugLog("Auth me failed:", error);
      res.status(500).json({ error: t("auth.failedReadSession") });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const t = getTranslator(req);
    try {
      await ensureUsersStore();
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");

      if (!username || !password) {
        res.status(400).json({ error: t("auth.usernamePasswordRequired") });
        return;
      }

      const now = Date.now();
      const token = randomBytes(24).toString("hex");
      const expiresAt = now + sessionDurationMs;
      const loginResult = runInTransaction((tx) => {
        const users = tx.readJson(USERS_STORE_KEY, [defaultUserRecord()]);
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        const user = safeUsers.find((entry) => entry.username === username);
        if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
          return { ok: false };
        }

        const sessions = tx.readJson(SESSIONS_STORE_KEY, []);
        const safeSessions = Array.isArray(sessions) ? sessions : [];
        const nextSessions = [
          ...safeSessions.filter((session) => Number(session.expiresAt) > now),
          { token, userId: user.id, expiresAt },
        ];
        tx.writeJson(SESSIONS_STORE_KEY, nextSessions);
        return { ok: true, user };
      });

      if (!loginResult.ok) {
        res.status(401).json({ error: t("auth.invalidCredentials") });
        return;
      }

      setSessionCookie(res, token, expiresAt);

      res.json({
        user: sanitizeUser(loginResult.user),
        ...(await buildSetupStatus(loginResult.user)),
        settings: loginResult.user.settings,
      });
    } catch (error) {
      debugLog("Login failed:", error);
      res.status(500).json({ error: t("auth.failedLogin") });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const t = getTranslator(req);
    try {
      const cookies = parseCookies(req.headers.cookie || "");
      const sessionToken = cookies[authCookieName];
      if (sessionToken) {
        mutateJsonStore(SESSIONS_STORE_KEY, [], (sessions) => {
          const safeSessions = Array.isArray(sessions) ? sessions : [];
          return safeSessions.filter((session) => session.token !== sessionToken);
        });
      }

      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      debugLog("Logout failed:", error);
      res.status(500).json({ error: t("auth.failedLogout") });
    }
  });

  app.post("/api/auth/accept-legal", withAuth(async (req, res, auth) => {
    try {
      mutateJsonStore(USERS_STORE_KEY, [defaultUserRecord()], (users) => {
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        return safeUsers.map((user) => {
          if (user.id !== auth.user.id) {
            return user;
          }
          return { ...user, legalAcceptedAt: new Date().toISOString() };
        });
      });
      res.json({ ok: true });
    } catch (error) {
      const t = getTranslator(req);
      debugLog("Accept legal failed:", error);
      res.status(500).json({ error: t("auth.failedUpdateSettings") });
    }
  }));

  app.post("/api/auth/change-password", withAuth(async (req, res, auth) => {
    try {
      const t = getTranslator(req, auth.user);

      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: t("auth.currentNewPasswordRequired") });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: t("auth.newPasswordTooShort") });
        return;
      }

      const { salt, hash } = hashPassword(newPassword);
      const changeResult = runInTransaction((tx) => {
        const users = tx.readJson(USERS_STORE_KEY, [defaultUserRecord()]);
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        const foundUser = safeUsers.find((user) => user.id === auth.user.id);
        if (!foundUser || !verifyPassword(currentPassword, foundUser.passwordSalt, foundUser.passwordHash)) {
          return { ok: false };
        }

        const nextUsers = safeUsers.map((user) => {
          if (user.id !== auth.user.id) {
            return user;
          }

          return {
            ...user,
            passwordSalt: salt,
            passwordHash: hash,
            mustChangePassword: false,
            shouldChangePassword: false,
            firstLoginPending: false,
            settings: {
              ...user.settings,
              security: {
                ...user.settings?.security,
                lastPasswordChangeAt: new Date().toISOString(),
              },
            },
          };
        });

        tx.writeJson(USERS_STORE_KEY, nextUsers);
        return { ok: true };
      });

      if (!changeResult.ok) {
        res.status(401).json({ error: t("auth.invalidCurrentPassword") });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      const t = getTranslator(req);
      debugLog("Change password failed:", error);
      res.status(500).json({ error: t("auth.failedChangePassword") });
    }
  }));

  app.get("/api/settings", withAuth(async (req, res, auth) => {
    const t = getTranslator(req);
    try {
      res.json(buildClientSettingsPayload(auth.user.settings));
    } catch (error) {
      debugLog("Read settings failed:", error);
      res.status(500).json({ error: t("auth.failedLoadSettings") });
    }
  }));

  app.put("/api/settings", withAuth(async (req, res, auth) => {
    const t = getTranslator(req);
    try {
      const newSettings = sanitizeSettingsPayload(req.body);
      mutateJsonStore(USERS_STORE_KEY, [defaultUserRecord()], (users) => {
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        return safeUsers.map((user) => {
          if (user.id !== auth.user.id) {
            return user;
          }

          return {
            ...user,
            settings: newSettings,
          };
        });
      });
      res.json(buildClientSettingsPayload(newSettings));
    } catch (error) {
      debugLog("Update settings failed:", error);
      res.status(500).json({ error: t("auth.failedUpdateSettings") });
    }
  }));

  app.get("/api/settings/global", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const globalConfig = await readGlobalConfig();
      res.json({ tmdbApiKey: globalConfig.tmdbApiKey || "" });
    } catch (error) {
      debugLog("Read global settings failed:", error);
      res.status(500).json({ error: t("auth.failedLoadSettings") });
    }
  }));

  app.put("/api/settings/global", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const tmdbApiKey = String(req.body?.tmdbApiKey || "").trim();
      await writeGlobalConfig({ tmdbApiKey });
      res.json({ tmdbApiKey });
    } catch (error) {
      debugLog("Update global settings failed:", error);
      res.status(500).json({ error: t("auth.failedUpdateSettings") });
    }
  }));

  app.get("/api/settings/database", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      res.json({ namespaces: listJsonStores() });
    } catch (error) {
      debugLog("Read database namespaces failed:", error);
      res.status(500).json({ error: t("auth.failedLoadSettings") });
    }
  }));

  app.get("/api/settings/database/:namespace", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const namespace = String(req.params.namespace || "").trim();
      if (!namespace) {
        res.status(400).json({ error: t("auth.failedLoadSettings") });
        return;
      }

      const entry = readRawJsonStore(namespace);
      if (!entry) {
        res.status(404).json({ error: t("auth.failedLoadSettings") });
        return;
      }

      res.json(entry);
    } catch (error) {
      debugLog("Read database namespace failed:", error);
      res.status(500).json({ error: t("auth.failedLoadSettings") });
    }
  }));

  app.put("/api/settings/database/:namespace", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const namespace = String(req.params.namespace || "").trim();
      const rawValue = String(req.body?.value || "");

      if (!namespace || !rawValue.trim()) {
        res.status(400).json({ error: t("auth.failedUpdateSettings") });
        return;
      }

      const updatedEntry = writeRawJsonStore(namespace, rawValue);
      res.json(updatedEntry);
    } catch (error) {
      debugLog("Update database namespace failed:", error);
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: t("auth.invalidJsonPayload") });
        return;
      }
      res.status(500).json({ error: t("auth.failedUpdateSettings") });
    }
  }));

  app.post("/api/settings/reset", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const { resetAllWishlists } = await import("./wishlist.js");

      const defaults = await readDefaultSettings();
      const resetUser = {
        ...defaultUserRecord(),
        settings: {
          ...defaults,
          profile: {
            ...(defaults.profile || {}),
            username: "admin",
          },
        },
      };

      runInTransaction((tx) => {
        tx.writeJson(USERS_STORE_KEY, [resetUser]);
        tx.writeJson(SESSIONS_STORE_KEY, []);
        tx.writeJson(GLOBAL_CONFIG_STORE_KEY, defaultGlobalConfig());
        tx.writeJson(APP_TORRENTS_STORE_KEY, {});
      });
      await resetAllWishlists();
      clearSessionCookie(res);

      res.json({
        ok: true,
        loggedOut: true,
        reset: {
          users: true,
          wishlist: true,
          seriesWishlist: true,
          sessions: true,
          appTorrents: true,
        },
      });
    } catch (error) {
      debugLog("Reset settings failed:", error);
      res.status(500).json({ error: t("auth.failedResetSettings") });
    }
  }));

  // ────────────────────────────────────────────────────────────────────────
  // User Management (Admin only)
  // ────────────────────────────────────────────────────────────────────────

  app.get("/api/users", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const users = await readUsers();
      // Return all users except admin
      const nonAdminUsers = users
        .filter((user) => user.username !== "admin")
        .map((user) => ({
          id: user.id,
          username: user.username,
        }));

      res.json(nonAdminUsers);
    } catch (error) {
      debugLog("List users failed:", error);
      res.status(500).json({ error: t("auth.failedListUsers") });
    }
  }));

  app.post("/api/users", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const username = String(req.body?.username || "").trim();

      if (!username) {
        res.status(400).json({ error: t("auth.usernameRequired") });
        return;
      }

      const generatedPassword = generateSimpleUserPassword();
      const { salt, hash } = hashPassword(generatedPassword);
      const createResult = runInTransaction((tx) => {
        const users = tx.readJson(USERS_STORE_KEY, [defaultUserRecord()]);
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        if (safeUsers.some((user) => user.username === username)) {
          return { ok: false, reason: "exists" };
        }

        const newId = Math.max(0, ...safeUsers.map((user) => user.id)) + 1;
        const newUser = {
          id: newId,
          username,
          passwordSalt: salt,
          passwordHash: hash,
          mustChangePassword: true,
          shouldChangePassword: false,
          firstLoginPending: true,
          settings: buildDefaultSettings(username),
        };

        tx.writeJson(USERS_STORE_KEY, [...safeUsers, newUser]);
        return { ok: true, newUser };
      });

      if (!createResult.ok) {
        res.status(400).json({ error: t("auth.usernameAlreadyExists") });
        return;
      }

      res.json({
        id: createResult.newUser.id,
        username: createResult.newUser.username,
        generatedPassword,
      });
    } catch (error) {
      debugLog("Create user failed:", error);
      res.status(500).json({ error: t("auth.failedCreateUser") });
    }
  }));

  app.delete("/api/users/:id", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const userId = parseInt(String(req.params.id), 10);

      const deleteResult = runInTransaction((tx) => {
        const users = tx.readJson(USERS_STORE_KEY, [defaultUserRecord()]);
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        const userToDelete = safeUsers.find((user) => user.id === userId);

        if (!userToDelete) {
          return { ok: false, reason: "not-found" };
        }

        if (userToDelete.username === "admin") {
          return { ok: false, reason: "admin" };
        }

        tx.writeJson(
          USERS_STORE_KEY,
          safeUsers.filter((user) => user.id !== userId)
        );

        const sessions = tx.readJson(SESSIONS_STORE_KEY, []);
        const safeSessions = Array.isArray(sessions) ? sessions : [];
        tx.writeJson(
          SESSIONS_STORE_KEY,
          safeSessions.filter((session) => session.userId !== userId)
        );

        return { ok: true };
      });

      if (!deleteResult.ok) {
        if (deleteResult.reason === "not-found") {
          res.status(404).json({ error: t("auth.userNotFound") });
          return;
        }
        res.status(400).json({ error: t("auth.cannotDeleteAdmin") });
        return;
      }

      res.json({ ok: true });
    } catch (error) {
      debugLog("Delete user failed:", error);
      res.status(500).json({ error: t("auth.failedDeleteUser") });
    }
  }));

  app.post("/api/users/:id/reset-password", withAdmin(async (req, res) => {
    const t = getTranslator(req);
    try {
      const userId = parseInt(String(req.params.id), 10);

      const generatedPassword = generateSimpleUserPassword();
      const { salt, hash } = hashPassword(generatedPassword);
      const resetResult = runInTransaction((tx) => {
        const users = tx.readJson(USERS_STORE_KEY, [defaultUserRecord()]);
        const safeUsers = Array.isArray(users) ? users : [defaultUserRecord()];
        const user = safeUsers.find((u) => u.id === userId);

        if (!user) {
          return { ok: false, reason: "not-found" };
        }

        if (user.username === "admin") {
          return { ok: false, reason: "admin" };
        }

        const nextUsers = safeUsers.map((u) => {
          if (u.id !== userId) {
            return u;
          }

          return {
            ...u,
            passwordSalt: salt,
            passwordHash: hash,
            // Keep hard reset requirement for users who never completed first login setup.
            mustChangePassword: Boolean(u.firstLoginPending),
            shouldChangePassword: !Boolean(u.firstLoginPending),
          };
        });

        tx.writeJson(USERS_STORE_KEY, nextUsers);
        return { ok: true };
      });

      if (!resetResult.ok) {
        if (resetResult.reason === "not-found") {
          res.status(404).json({ error: t("auth.userNotFound") });
          return;
        }
        res.status(400).json({ error: t("auth.cannotModifyAdmin") });
        return;
      }

      res.json({ ok: true, generatedPassword });
    } catch (error) {
      debugLog("Reset user password failed:", error);
      res.status(500).json({ error: t("auth.failedResetUserPassword") });
    }
  }));
}

function defaultGlobalConfig() {
  return {
    tmdbApiKey: "",
  };
}

async function writeGlobalConfig(config) {
  const safeConfig = {
    tmdbApiKey: String(config?.tmdbApiKey || "").trim(),
  };
  writeJsonStore(GLOBAL_CONFIG_STORE_KEY, safeConfig);
}

async function readGlobalConfig() {
  const value = readJsonStore(GLOBAL_CONFIG_STORE_KEY, defaultGlobalConfig());
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultGlobalConfig();
  }

  return {
    tmdbApiKey: String(value.tmdbApiKey || "").trim(),
  };
}