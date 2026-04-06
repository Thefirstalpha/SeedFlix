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
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");
    const url = buildTmdbUrl("/movie/popular", { page, language });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Popular movies proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch popular movies" });
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
    const page = Number(req.query.page || 1);
    const language = String(req.query.language || "fr-FR");
    const url = buildTmdbUrl("/tv/popular", { page, language });
    const { response, data } = await fetchTmdb(url);
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Popular series proxy failed:", error);
    res.status(500).json({ error: "Failed to fetch popular series" });
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

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
