import { promises as fs } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  appImageTag,
  authCookieName,
  dataDir,
  defaultSettingsFilePath,
  appTorrentsFilePath,
  globalConfigFilePath,
  sessionDurationMs,
  sessionsFilePath,
  usersFilePath,
} from "../config.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";

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

async function ensureJsonStore(filePath, fallback) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf-8");
  }
}

async function readUsers() {
  await ensureJsonStore(usersFilePath, [defaultUserRecord()]);
  const content = await fs.readFile(usersFilePath, "utf-8");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await ensureJsonStore(usersFilePath, [defaultUserRecord()]);
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
}

async function readSessions() {
  await ensureJsonStore(sessionsFilePath, []);
  const content = await fs.readFile(sessionsFilePath, "utf-8");

  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSessions(sessions) {
  await ensureJsonStore(sessionsFilePath, []);
  await fs.writeFile(sessionsFilePath, JSON.stringify(sessions, null, 2), "utf-8");
}

async function readDefaultSettings() {
  await ensureJsonStore(defaultSettingsFilePath, buildDefaultSettings("admin"));
  const content = await fs.readFile(defaultSettingsFilePath, "utf-8");

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
  await ensureJsonStore(usersFilePath, [defaultUserRecord()]);
  const users = await readUsers();

  if (users.length === 0) {
    await writeUsers([defaultUserRecord()]);
  }
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

  return {
    mustChangePassword,
    mustConfigureTmdb,
    mustConfigureTorrent,
    mustConfigureIndexer,
    shouldChangePassword,
    needsInitialSetup:
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

  const sessions = await readSessions();
  const now = Date.now();
  const activeSessions = sessions.filter((session) => Number(session.expiresAt) > now);
  if (activeSessions.length !== sessions.length) {
    await writeSessions(activeSessions);
  }

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

      const users = await readUsers();
      const user = users.find((entry) => entry.username === username);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        res.status(401).json({ error: t("auth.invalidCredentials") });
        return;
      }

      const sessions = await readSessions();
      const now = Date.now();
      const token = randomBytes(24).toString("hex");
      const expiresAt = now + sessionDurationMs;
      const nextSessions = [
        ...sessions.filter((session) => Number(session.expiresAt) > now),
        { token, userId: user.id, expiresAt },
      ];
      await writeSessions(nextSessions);
      setSessionCookie(res, token, expiresAt);

      res.json({
        user: sanitizeUser(user),
        ...(await buildSetupStatus(user)),
        settings: user.settings,
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
        const sessions = await readSessions();
        await writeSessions(sessions.filter((session) => session.token !== sessionToken));
      }

      clearSessionCookie(res);
      res.json({ ok: true });
    } catch (error) {
      debugLog("Logout failed:", error);
      res.status(500).json({ error: t("auth.failedLogout") });
    }
  });

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

      if (!verifyPassword(currentPassword, auth.user.passwordSalt, auth.user.passwordHash)) {
        res.status(401).json({ error: t("auth.invalidCurrentPassword") });
        return;
      }

      const users = await readUsers();
      const { salt, hash } = hashPassword(newPassword);
      const nextUsers = users.map((user) => {
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
      await writeUsers(nextUsers);
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
      const users = await readUsers();
      const nextUsers = users.map((user) => {
        if (user.id !== auth.user.id) {
          return user;
        }

        return {
          ...user,
          settings: newSettings,
        };
      });
      await writeUsers(nextUsers);
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

      await writeUsers([resetUser]);
      await resetAllWishlists();
      await writeSessions([]);
      await writeGlobalConfig(defaultGlobalConfig());
      await fs.writeFile(appTorrentsFilePath, "{}", "utf-8");
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

      const users = await readUsers();
      if (users.some((user) => user.username === username)) {
        res.status(400).json({ error: t("auth.usernameAlreadyExists") });
        return;
      }

      const generatedPassword = generateSimpleUserPassword();
      const { salt, hash } = hashPassword(generatedPassword);
      const newId = Math.max(0, ...users.map((user) => user.id)) + 1;
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

      const nextUsers = [...users, newUser];
      await writeUsers(nextUsers);

      res.json({
        id: newUser.id,
        username: newUser.username,
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

      const users = await readUsers();
      const userToDelete = users.find((user) => user.id === userId);

      if (!userToDelete) {
        res.status(404).json({ error: t("auth.userNotFound") });
        return;
      }

      // Cannot delete admin user
      if (userToDelete.username === "admin") {
        res.status(400).json({ error: t("auth.cannotDeleteAdmin") });
        return;
      }

      const nextUsers = users.filter((user) => user.id !== userId);
      await writeUsers(nextUsers);

      // Also remove user sessions
      const sessions = await readSessions();
      const nextSessions = sessions.filter((session) => session.userId !== userId);
      await writeSessions(nextSessions);

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

      const users = await readUsers();
      const user = users.find((u) => u.id === userId);

      if (!user) {
        res.status(404).json({ error: t("auth.userNotFound") });
        return;
      }

      // Cannot reset admin password
      if (user.username === "admin") {
        res.status(400).json({ error: t("auth.cannotModifyAdmin") });
        return;
      }

      const generatedPassword = generateSimpleUserPassword();
      const { salt, hash } = hashPassword(generatedPassword);
      const nextUsers = users.map((u) => {
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

      await writeUsers(nextUsers);
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
  await ensureJsonStore(globalConfigFilePath, defaultGlobalConfig());
  const safeConfig = {
    tmdbApiKey: String(config?.tmdbApiKey || "").trim(),
  };
  await fs.writeFile(globalConfigFilePath, JSON.stringify(safeConfig, null, 2), "utf-8");
}

async function readGlobalConfig() {
  await ensureJsonStore(globalConfigFilePath, defaultGlobalConfig());
  const content = await fs.readFile(globalConfigFilePath, "utf-8");

  let parsed = defaultGlobalConfig();
  try {
    const value = JSON.parse(content);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parsed = {
        tmdbApiKey: String(value.tmdbApiKey || "").trim(),
      };
    }
  } catch {
    parsed = defaultGlobalConfig();
  }

  return parsed;
}