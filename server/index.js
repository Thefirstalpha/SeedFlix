import "dotenv/config";
import express from "express";
import cors from "cors";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 4000);
const tmdbApiKey = process.env.TMDB_API_KEY;
const tmdbBaseUrl = "https://api.themoviedb.org/3";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const wishlistFilePath = path.join(dataDir, "wishlist.json");
const seriesWishlistFilePath = path.join(dataDir, "seriesWishlist.json");

app.use(cors());
app.use(express.json());

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
