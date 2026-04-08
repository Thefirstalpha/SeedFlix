import { promises as fs } from "node:fs";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import {
  authCookieName,
  dataDir,
  defaultSettingsFilePath,
  appTorrentsFilePath,
  sessionDurationMs,
  sessionsFilePath,
  usersFilePath,
} from "../config.js";
import { debugLog } from "../logger.js";

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
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
      notifications: {},
      preferences: {},
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
    settings: buildDefaultSettings("admin"),
  };
}

function isLegacyDefaultAdmin(user) {
  return (
    user?.username === "admin" &&
    verifyPassword("admin123", user.passwordSalt, user.passwordHash)
  );
}

function isCurrentDefaultAdmin(user) {
  return (
    user?.username === "admin" &&
    verifyPassword("admin", user.passwordSalt, user.passwordHash)
  );
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

async function normalizeUsersStore() {
  const users = await readUsers();
  let hasChanges = false;

  const nextUsers = users.map((user) => {
    if (!user || typeof user !== "object") {
      return user;
    }

    if (isLegacyDefaultAdmin(user)) {
      const { salt, hash } = hashPassword("admin");
      hasChanges = true;
      return {
        ...user,
        passwordSalt: salt,
        passwordHash: hash,
        mustChangePassword: true,
      };
    }

    if (isCurrentDefaultAdmin(user) && user.mustChangePassword !== true) {
      hasChanges = true;
      return {
        ...user,
        mustChangePassword: true,
      };
    }

    if (user.mustChangePassword === undefined) {
      hasChanges = true;
      return {
        ...user,
        mustChangePassword: false,
      };
    }

    return user;
  });

  if (hasChanges) {
    await writeUsers(nextUsers);
    return nextUsers;
  }

  return users;
}

async function ensureUsersStore() {
  await ensureJsonStore(usersFilePath, [defaultUserRecord()]);
  const users = await normalizeUsersStore();

  if (users.length === 0) {
    await writeUsers([defaultUserRecord()]);
  }
}

function isTmdbConfigured(user) {
  return Boolean(user?.settings?.apiKeys?.tmdb?.trim());
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
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  return auth;
}

export { getAuthenticatedUser, requireAuth };

export function registerAuthRoutes(app) {
  app.get("/api/auth/me", async (req, res) => {
    try {
      const auth = await getAuthenticatedUser(req);
      if (!auth) {
        res.json({ authenticated: false, mustChangePassword: false });
        return;
      }

      res.json({
        authenticated: true,
        user: sanitizeUser(auth.user),
        mustChangePassword: Boolean(auth.user.mustChangePassword),
        mustConfigureTmdb: !isTmdbConfigured(auth.user),
        settings: auth.user.settings,
      });
    } catch (error) {
      debugLog("Auth me failed:", error);
      res.status(500).json({ error: "Failed to read session" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      await ensureUsersStore();
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");

      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      const users = await readUsers();
      const user = users.find((entry) => entry.username === username);
      if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
        res.status(401).json({ error: "Identifiants invalides" });
        return;
      }

      const sessions = await readSessions();
      const token = randomBytes(24).toString("hex");
      const expiresAt = Date.now() + sessionDurationMs;
      const nextSessions = [
        ...sessions.filter((session) => session.userId !== user.id),
        { token, userId: user.id, expiresAt },
      ];
      await writeSessions(nextSessions);
      setSessionCookie(res, token, expiresAt);

      res.json({
        user: sanitizeUser(user),
        mustChangePassword: Boolean(user.mustChangePassword),
        mustConfigureTmdb: !isTmdbConfigured(user),
        settings: user.settings,
      });
    } catch (error) {
      debugLog("Login failed:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
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
      res.status(500).json({ error: "Failed to log out" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const currentPassword = String(req.body?.currentPassword || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current and new passwords are required" });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères" });
        return;
      }

      if (!verifyPassword(currentPassword, auth.user.passwordSalt, auth.user.passwordHash)) {
        res.status(401).json({ error: "Mot de passe actuel invalide" });
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
      debugLog("Change password failed:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      res.json(auth.user.settings || {});
    } catch (error) {
      debugLog("Read settings failed:", error);
      res.status(500).json({ error: "Failed to load settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const newSettings = req.body;
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
      res.json(newSettings);
    } catch (error) {
      debugLog("Update settings failed:", error);
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.post("/api/settings/reset", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const { writeSeriesWishlist, writeWishlist } = await import("./wishlist.js");

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
      await writeWishlist([]);
      await writeSeriesWishlist([]);
      await writeSessions([]);
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
      res.status(500).json({ error: "Failed to reset settings" });
    }
  });
}