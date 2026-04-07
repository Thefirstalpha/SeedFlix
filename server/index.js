import "dotenv/config";
import express from "express";
import cors from "cors";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const app = express();
const port = Number(process.env.PORT || 4000);
const tmdbApiKey = process.env.TMDB_API_KEY;
const tmdbBaseUrl = "https://api.themoviedb.org/3";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const wishlistFilePath = path.join(dataDir, "wishlist.json");
const seriesWishlistFilePath = path.join(dataDir, "seriesWishlist.json");
const usersFilePath = path.join(dataDir, "users.json");
const sessionsFilePath = path.join(dataDir, "sessions.json");
const authCookieName = "catalogfinder_session";
const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;

app.use(cors());
app.use(express.json());

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

function defaultUserRecord() {
  const { salt, hash } = hashPassword("admin123");
  return {
    id: 1,
    username: "admin",
    passwordSalt: salt,
    passwordHash: hash,
    settings: {
      profile: {
        username: "admin",
      },
      security: {
        lastPasswordChangeAt: new Date().toISOString(),
      },
      placeholders: {
        notifications: {},
        preferences: {},
      },
    },
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

async function ensureUsersStore() {
  await ensureJsonStore(usersFilePath, [defaultUserRecord()]);
  const users = await readUsers();
  if (users.length === 0) {
    await writeUsers([defaultUserRecord()]);
  }
}

async function ensureSessionsStore() {
  await ensureJsonStore(sessionsFilePath, []);
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
  await ensureUsersStore();
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
}

async function readSessions() {
  await ensureSessionsStore();
  const content = await fs.readFile(sessionsFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSessions(sessions) {
  await ensureSessionsStore();
  await fs.writeFile(sessionsFilePath, JSON.stringify(sessions, null, 2), "utf-8");
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

async function ensureWishlistStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(wishlistFilePath);
  } catch {
    await fs.writeFile(wishlistFilePath, "[]", "utf-8");
  }
}

async function readWishlist() {
  await ensureWishlistStore();
  const content = await fs.readFile(wishlistFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWishlist(wishlist) {
  await ensureWishlistStore();
  await fs.writeFile(
    wishlistFilePath,
    JSON.stringify(wishlist, null, 2),
    "utf-8"
  );
}

function normalizeMovie(movie) {
  if (!movie || typeof movie !== "object") {
    return null;
  }

  const id = Number(movie.id);
  if (!Number.isFinite(id)) {
    return null;
  }

  return {
    id,
    title: String(movie.title || ""),
    year: Number(movie.year || 0),
    rating: Number(movie.rating || 0),
    genre: String(movie.genre || "Inconnu"),
    poster: String(movie.poster || ""),
    director: String(movie.director || "Non disponible"),
    actors: Array.isArray(movie.actors)
      ? movie.actors.map((actor) => String(actor))
      : [],
    plot: String(movie.plot || ""),
    duration: String(movie.duration || "Non disponible"),
    backdrop: movie.backdrop ? String(movie.backdrop) : undefined,
    originalTitle: movie.originalTitle
      ? String(movie.originalTitle)
      : undefined,
    releaseDate: movie.releaseDate ? String(movie.releaseDate) : undefined,
    voteCount: Number.isFinite(Number(movie.voteCount))
      ? Number(movie.voteCount)
      : undefined,
  };
}

function assertTmdbKey(req, res) {
  if (!tmdbApiKey) {
    res.status(500).json({
      error: "TMDB_API_KEY is missing on server",
    });
    return false;
  }

  return true;
}

function buildTmdbUrl(path, query = {}) {
  const url = new URL(`${tmdbBaseUrl}${path}`);
  url.searchParams.set("api_key", tmdbApiKey);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchTmdb(url) {
  const response = await fetch(url);
  const data = await response.json();
  return { response, data };
}

function readDiscoverFilters(query, type) {
  const withGenres = Number(query.with_genres);
  const voteAverageGte = Number(query.vote_average_gte);

  const filters = {
    page: Number(query.page || 1),
    language: String(query.language || "fr-FR"),
    sort_by: "popularity.desc",
  };

  if (Number.isFinite(withGenres)) {
    filters.with_genres = withGenres;
  }
  if (Number.isFinite(voteAverageGte)) {
    filters.vote_average_gte = voteAverageGte;
  }

  if (type === "movie") {
    const primaryReleaseDateGte = String(query.primary_release_date_gte || "");
    const primaryReleaseDateLte = String(query.primary_release_date_lte || "");
    if (primaryReleaseDateGte) {
      filters.primary_release_date_gte = primaryReleaseDateGte;
    }
    if (primaryReleaseDateLte) {
      filters.primary_release_date_lte = primaryReleaseDateLte;
    }
  } else {
    const firstAirDateGte = String(query.first_air_date_gte || "");
    const firstAirDateLte = String(query.first_air_date_lte || "");
    if (firstAirDateGte) {
      filters.first_air_date_gte = firstAirDateGte;
    }
    if (firstAirDateLte) {
      filters.first_air_date_lte = firstAirDateLte;
    }
  }

  return filters;
}

function hasActiveDiscoverFilters(filters, type) {
  return Boolean(
    filters.with_genres ||
      filters.vote_average_gte ||
      (type === "movie"
        ? filters.primary_release_date_gte || filters.primary_release_date_lte
        : filters.first_air_date_gte || filters.first_air_date_lte)
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: sanitizeUser(auth.user),
      settings: auth.user.settings,
    });
  } catch (error) {
    console.error("Auth me failed:", error);
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
      settings: user.settings,
    });
  } catch (error) {
    console.error("Login failed:", error);
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
    console.error("Logout failed:", error);
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
    console.error("Change password failed:", error);
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
    console.error("Read settings failed:", error);
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
    console.error("Update settings failed:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

app.get("/api/wishlist", async (_req, res) => {
  try {
    const wishlist = await readWishlist();
    res.json(wishlist);
  } catch (error) {
    console.error("Read wishlist failed:", error);
    res.status(500).json({ error: "Failed to read wishlist" });
  }
});

app.post("/api/wishlist", async (req, res) => {
  try {
    const movie = normalizeMovie(req.body);
    if (!movie) {
      res.status(400).json({ error: "Invalid movie payload" });
      return;
    }

    const wishlist = await readWishlist();
    const alreadyExists = wishlist.some((item) => item.id === movie.id);
    if (!alreadyExists) {
      wishlist.push(movie);
      await writeWishlist(wishlist);
    }

    res.status(201).json({ ok: true, exists: alreadyExists });
  } catch (error) {
    console.error("Add wishlist movie failed:", error);
    res.status(500).json({ error: "Failed to add movie to wishlist" });
  }
});

app.delete("/api/wishlist/:id", async (req, res) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isFinite(movieId)) {
      res.status(400).json({ error: "Invalid movie id" });
      return;
    }

    const wishlist = await readWishlist();
    const updatedWishlist = wishlist.filter((movie) => movie.id !== movieId);
    await writeWishlist(updatedWishlist);
    res.json({ ok: true });
  } catch (error) {
    console.error("Remove wishlist movie failed:", error);
    res.status(500).json({ error: "Failed to remove movie from wishlist" });
  }
});

app.delete("/api/wishlist", async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))
      : [];

    const idsSet = new Set(ids);
    const wishlist = await readWishlist();
    const updatedWishlist = wishlist.filter((movie) => !idsSet.has(movie.id));
    await writeWishlist(updatedWishlist);

    res.json({ ok: true });
  } catch (error) {
    console.error("Remove multiple wishlist movies failed:", error);
    res.status(500).json({ error: "Failed to remove wishlist movies" });
  }
});

app.get("/api/wishlist/:id", async (req, res) => {
  try {
    const movieId = Number(req.params.id);
    if (!Number.isFinite(movieId)) {
      res.status(400).json({ error: "Invalid movie id" });
      return;
    }

    const wishlist = await readWishlist();
    const exists = wishlist.some((movie) => movie.id === movieId);
    res.json({ exists });
  } catch (error) {
    console.error("Check wishlist movie failed:", error);
    res.status(500).json({ error: "Failed to check wishlist movie" });
  }
});

app.get("/api/movies/popular", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const filters = readDiscoverFilters(req.query, "movie");
    const url = hasActiveDiscoverFilters(filters, "movie")
      ? buildTmdbUrl("/discover/movie", filters)
      : buildTmdbUrl("/movie/popular", {
          page: filters.page,
          language: filters.language,
        });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Popular movies proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch popular movies" });
  }
});

app.get("/api/movies/genres", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const language = String(req.query.language || "fr-FR");
    const url = buildTmdbUrl("/genre/movie/list", { language });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Movie genres proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch movie genres" });
  }
});

app.get("/api/movies/discover", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");
    const withGenres = Number(req.query.with_genres);
    const primaryReleaseDateGte = String(req.query.primary_release_date_gte || "");
    const primaryReleaseDateLte = String(req.query.primary_release_date_lte || "");
    const voteAverageGte = Number(req.query.vote_average_gte);

    const query = {
      page,
      language,
      sort_by: "popularity.desc",
    };

    if (Number.isFinite(withGenres)) {
      query.with_genres = withGenres;
    }
    if (primaryReleaseDateGte) {
      query.primary_release_date_gte = primaryReleaseDateGte;
    }
    if (primaryReleaseDateLte) {
      query.primary_release_date_lte = primaryReleaseDateLte;
    }
    if (Number.isFinite(voteAverageGte)) {
      query.vote_average_gte = voteAverageGte;
    }

    const url = buildTmdbUrl("/discover/movie", query);
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Discover movies proxy failed:", error);
    res.status(500).json({ error: "Failed to discover movies" });
  }
});

app.get("/api/movies/search", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const query = String(req.query.query || "").trim();
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const url = buildTmdbUrl("/search/movie", {
      query,
      page,
      language,
    });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Search movies proxy failed:", error);
    res.status(500).json({ error: "Failed to search movies" });
  }
});

app.get("/api/movies/:id", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const id = Number(req.params.id);
    const language = String(req.query.language || "fr-FR");

    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid movie id" });
      return;
    }

    const url = buildTmdbUrl(`/movie/${id}`, {
      language,
      append_to_response: "credits",
    });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Movie details proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch movie details" });
  }
});

app.get("/api/series/popular", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const filters = readDiscoverFilters(req.query, "series");
    const url = hasActiveDiscoverFilters(filters, "series")
      ? buildTmdbUrl("/discover/tv", filters)
      : buildTmdbUrl("/tv/popular", {
          page: filters.page,
          language: filters.language,
        });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Popular series proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch popular series" });
  }
});

app.get("/api/series/genres", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const language = String(req.query.language || "fr-FR");
    const url = buildTmdbUrl("/genre/tv/list", { language });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Series genres proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch series genres" });
  }
});

app.get("/api/series/discover", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");
    const withGenres = Number(req.query.with_genres);
    const firstAirDateGte = String(req.query.first_air_date_gte || "");
    const firstAirDateLte = String(req.query.first_air_date_lte || "");
    const voteAverageGte = Number(req.query.vote_average_gte);

    const query = {
      page,
      language,
      sort_by: "popularity.desc",
    };

    if (Number.isFinite(withGenres)) {
      query.with_genres = withGenres;
    }
    if (firstAirDateGte) {
      query.first_air_date_gte = firstAirDateGte;
    }
    if (firstAirDateLte) {
      query.first_air_date_lte = firstAirDateLte;
    }
    if (Number.isFinite(voteAverageGte)) {
      query.vote_average_gte = voteAverageGte;
    }

    const url = buildTmdbUrl("/discover/tv", query);
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Discover series proxy failed:", error);
    res.status(500).json({ error: "Failed to discover series" });
  }
});

app.get("/api/series/search", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const query = String(req.query.query || "").trim();
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");

    if (!query) {
      res.status(400).json({ error: "query is required" });
      return;
    }

    const url = buildTmdbUrl("/search/tv", {
      query,
      page,
      language,
    });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Search series proxy failed:", error);
    res.status(500).json({ error: "Failed to search series" });
  }
});

app.get("/api/series/:id", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const id = Number(req.params.id);
    const language = String(req.query.language || "fr-FR");

    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid series id" });
      return;
    }

    const url = buildTmdbUrl(`/tv/${id}`, {
      language,
      append_to_response: "credits",
    });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Series details proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch series details" });
  }
});

app.get("/api/series/:id/seasons/:seasonNumber", async (req, res) => {
  if (!assertTmdbKey(req, res)) {
    return;
  }

  try {
    const id = Number(req.params.id);
    const seasonNumber = Number(req.params.seasonNumber);
    const language = String(req.query.language || "fr-FR");

    if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) {
      res.status(400).json({ error: "Invalid series id or season number" });
      return;
    }

    const url = buildTmdbUrl(`/tv/${id}/season/${seasonNumber}`, {
      language,
    });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Season details proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch season details" });
  }
});

// ─── Series Wishlist helpers ─────────────────────────────────────────────────

async function ensureSeriesWishlistStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(seriesWishlistFilePath);
  } catch {
    await fs.writeFile(seriesWishlistFilePath, "[]", "utf-8");
  }
}

async function readSeriesWishlist() {
  await ensureSeriesWishlistStore();
  const content = await fs.readFile(seriesWishlistFilePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSeriesWishlist(wishlist) {
  await ensureSeriesWishlistStore();
  await fs.writeFile(
    seriesWishlistFilePath,
    JSON.stringify(wishlist, null, 2),
    "utf-8"
  );
}

function normalizeSeriesEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const validTypes = ["series", "season", "episode"];
  const type = String(entry.type || "");
  if (!validTypes.includes(type)) return null;

  const seriesId = Number(entry.seriesId);
  if (!Number.isFinite(seriesId)) return null;

  const normalized = {
    type,
    seriesId,
    seriesTitle: String(entry.seriesTitle || ""),
    seriesPoster: String(entry.seriesPoster || ""),
  };

  if (type === "season" || type === "episode") {
    const seasonNumber = Number(entry.seasonNumber);
    if (!Number.isFinite(seasonNumber)) return null;
    normalized.seasonNumber = seasonNumber;
    normalized.seasonName = String(entry.seasonName || `Saison ${seasonNumber}`);
  }

  if (type === "episode") {
    const episodeNumber = Number(entry.episodeNumber);
    if (!Number.isFinite(episodeNumber)) return null;
    normalized.episodeNumber = episodeNumber;
    normalized.episodeName = String(entry.episodeName || "");
  }

  // Stable string entryId (no special URL chars)
  if (type === "series") {
    normalized.entryId = `series_${seriesId}`;
  } else if (type === "season") {
    normalized.entryId = `season_${seriesId}_${normalized.seasonNumber}`;
  } else {
    normalized.entryId = `episode_${seriesId}_${normalized.seasonNumber}_${normalized.episodeNumber}`;
  }

  return normalized;
}

// ─── Series Wishlist routes ───────────────────────────────────────────────────

app.get("/api/series-wishlist", async (_req, res) => {
  try {
    const wishlist = await readSeriesWishlist();
    res.json(wishlist);
  } catch (error) {
    console.error("Read series wishlist failed:", error);
    res.status(500).json({ error: "Failed to read series wishlist" });
  }
});

app.get("/api/series-wishlist/series/:seriesId/status", async (req, res) => {
  try {
    const seriesId = Number(req.params.seriesId);
    if (!Number.isFinite(seriesId)) {
      res.status(400).json({ error: "Invalid seriesId" });
      return;
    }

    const wishlist = await readSeriesWishlist();
    const entries = wishlist.filter((e) => e.seriesId === seriesId);

    res.json({
      seriesInWishlist: entries.some((e) => e.type === "series"),
      seasonsInWishlist: entries
        .filter((e) => e.type === "season")
        .map((e) => e.seasonNumber),
      episodesInWishlist: entries
        .filter((e) => e.type === "episode")
        .map((e) => ({ seasonNumber: e.seasonNumber, episodeNumber: e.episodeNumber })),
    });
  } catch (error) {
    console.error("Series wishlist status failed:", error);
    res.status(500).json({ error: "Failed to get wishlist status" });
  }
});

app.post("/api/series-wishlist", async (req, res) => {
  try {
    const entry = normalizeSeriesEntry(req.body);
    if (!entry) {
      res.status(400).json({ error: "Invalid series wishlist payload" });
      return;
    }

    let wishlist = await readSeriesWishlist();

    if (entry.type === "series") {
      // Remove all existing entries for this series, then add the series itself
      wishlist = wishlist.filter((e) => e.seriesId !== entry.seriesId);
      wishlist.push(entry);
    } else if (entry.type === "season") {
      // Remove all episode entries for this series+season (episodes superseded by season)
      wishlist = wishlist.filter(
        (e) =>
          !(
            e.seriesId === entry.seriesId &&
            e.type === "episode" &&
            e.seasonNumber === entry.seasonNumber
          )
      );
      // Only add if the series itself isn't already covering everything
      const coveringSeriesExists = wishlist.some(
        (e) => e.seriesId === entry.seriesId && e.type === "series"
      );
      if (!coveringSeriesExists) {
        // Remove duplicate season entry if present, then add
        wishlist = wishlist.filter((e) => e.entryId !== entry.entryId);
        wishlist.push(entry);
      }
    } else {
      // episode: only add if not already covered by series or season
      const covered = wishlist.some(
        (e) =>
          e.seriesId === entry.seriesId &&
          (e.type === "series" ||
            (e.type === "season" && e.seasonNumber === entry.seasonNumber))
      );
      if (!covered) {
        wishlist = wishlist.filter((e) => e.entryId !== entry.entryId);
        wishlist.push(entry);
      }
    }

    await writeSeriesWishlist(wishlist);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Add series wishlist entry failed:", error);
    res.status(500).json({ error: "Failed to add to series wishlist" });
  }
});

app.delete("/api/series-wishlist/entry/:entryId", async (req, res) => {
  try {
    const entryId = req.params.entryId;
    const wishlist = await readSeriesWishlist();
    const updated = wishlist.filter((e) => e.entryId !== entryId);
    await writeSeriesWishlist(updated);
    res.json({ ok: true });
  } catch (error) {
    console.error("Remove series wishlist entry failed:", error);
    res.status(500).json({ error: "Failed to remove series wishlist entry" });
  }
});

app.delete("/api/series-wishlist/bulk", async (req, res) => {
  try {
    const entryIds = Array.isArray(req.body?.entryIds)
      ? req.body.entryIds.map((id) => String(id))
      : [];
    const entryIdsSet = new Set(entryIds);
    const wishlist = await readSeriesWishlist();
    const updated = wishlist.filter((e) => !entryIdsSet.has(e.entryId));
    await writeSeriesWishlist(updated);
    res.json({ ok: true });
  } catch (error) {
    console.error("Bulk remove series wishlist entries failed:", error);
    res.status(500).json({ error: "Failed to remove series wishlist entries" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
