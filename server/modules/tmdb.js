import { tmdbApiKey as defaultTmdbApiKey, tmdbBaseUrl } from "../config.js";
import { debugLog } from "../logger.js";
import { getAuthenticatedUser, requireAuth } from "./auth.js";

async function getTmdbApiKey(req) {
  const auth = await getAuthenticatedUser(req);
  const userKey = auth?.user?.settings?.apiKeys?.tmdb?.trim();

  if (userKey) {
    return userKey;
  }

  return defaultTmdbApiKey || "";
}

function assertTmdbKey(apiKey, res) {
  if (!apiKey) {
    res.status(500).json({
      error: "TMDB_API_KEY is not configured. Please set it in Settings.",
    });
    return false;
  }

  return true;
}

function isTmdbApiKey(apiKey) {
  return /^[a-f0-9]{32}$/i.test(apiKey);
}

function buildTmdbUrl(path, apiKey, query = {}) {
  const url = new URL(`${tmdbBaseUrl}${path}`);

  if (isTmdbApiKey(apiKey)) {
    url.searchParams.set("api_key", apiKey);
  }

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value));
  }

  return url;
}

async function fetchTmdb(url, apiKey) {
  const headers = {};

  if (apiKey && !isTmdbApiKey(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {
        error: "Réponse invalide de TMDB",
        raw: text,
      };
    }
  }

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

export function registerTmdbRoutes(app) {
  app.post("/api/tmdb/test-key", async (req, res) => {
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const apiKey = String(req.body?.apiKey || "").trim();
      if (!apiKey) {
        res.status(400).json({ error: "La clé API TMDB est requise" });
        return;
      }

      const url = buildTmdbUrl("/configuration", apiKey);
      const { response, data } = await fetchTmdb(url, apiKey);

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: data?.status_message || data?.error || "Clé API TMDB invalide",
        });
        return;
      }

      res.json({
        ok: true,
        message: "Clé API TMDB valide",
      });
    } catch (error) {
      debugLog("TMDB key test failed:", error);
      res.status(500).json({ error: "Impossible de tester la clé API TMDB" });
    }
  });

  app.get("/api/movies/popular", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const filters = readDiscoverFilters(req.query, "movie");
      const url = hasActiveDiscoverFilters(filters, "movie")
        ? buildTmdbUrl("/discover/movie", apiKey, filters)
        : buildTmdbUrl("/movie/popular", apiKey, {
            page: filters.page,
            language: filters.language,
          });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Popular movies proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch popular movies" });
    }
  });

  app.get("/api/movies/genres", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const language = String(req.query.language || "fr-FR");
      const url = buildTmdbUrl("/genre/movie/list", apiKey, { language });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Movie genres proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch movie genres" });
    }
  });

  app.get("/api/movies/discover", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
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

      const url = buildTmdbUrl("/discover/movie", apiKey, query);
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Discover movies proxy failed:", error);
      res.status(500).json({ error: "Failed to discover movies" });
    }
  });

  app.get("/api/movies/search", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
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

      const url = buildTmdbUrl("/search/movie", apiKey, {
        query,
        page,
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Search movies proxy failed:", error);
      res.status(500).json({ error: "Failed to search movies" });
    }
  });

  app.get("/api/movies/:id", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const id = Number(req.params.id);
      const language = String(req.query.language || "fr-FR");

      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid movie id" });
        return;
      }

      const url = buildTmdbUrl(`/movie/${id}`, apiKey, {
        language,
        append_to_response: "credits",
      });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Movie details proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch movie details" });
    }
  });

  app.get("/api/series/popular", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const filters = readDiscoverFilters(req.query, "series");
      const url = hasActiveDiscoverFilters(filters, "series")
        ? buildTmdbUrl("/discover/tv", apiKey, filters)
        : buildTmdbUrl("/tv/popular", apiKey, {
            page: filters.page,
            language: filters.language,
          });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Popular series proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch popular series" });
    }
  });

  app.get("/api/series/genres", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const language = String(req.query.language || "fr-FR");
      const url = buildTmdbUrl("/genre/tv/list", apiKey, { language });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Series genres proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch series genres" });
    }
  });

  app.get("/api/series/discover", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
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

      const url = buildTmdbUrl("/discover/tv", apiKey, query);
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Discover series proxy failed:", error);
      res.status(500).json({ error: "Failed to discover series" });
    }
  });

  app.get("/api/series/search", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
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

      const url = buildTmdbUrl("/search/tv", apiKey, {
        query,
        page,
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Search series proxy failed:", error);
      res.status(500).json({ error: "Failed to search series" });
    }
  });

  app.get("/api/series/:id", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
      return;
    }

    try {
      const id = Number(req.params.id);
      const language = String(req.query.language || "fr-FR");

      if (!Number.isFinite(id)) {
        res.status(400).json({ error: "Invalid series id" });
        return;
      }

      const url = buildTmdbUrl(`/tv/${id}`, apiKey, {
        language,
        append_to_response: "credits",
      });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Series details proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch series details" });
    }
  });

  app.get("/api/series/:id/seasons/:seasonNumber", async (req, res) => {
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res)) {
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

      const url = buildTmdbUrl(`/tv/${id}/season/${seasonNumber}`, apiKey, {
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey);
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Season details proxy failed:", error);
      res.status(500).json({ error: "Failed to fetch season details" });
    }
  });
}
