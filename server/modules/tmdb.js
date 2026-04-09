import { tmdbApiKey as defaultTmdbApiKey, tmdbBaseUrl } from "../config.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";
import { getAuthenticatedUser, requireAuth } from "./auth.js";

async function getTmdbApiKey(req) {
  const auth = await getAuthenticatedUser(req);
  const userKey = auth?.user?.settings?.apiKeys?.tmdb?.trim();

  if (userKey) {
    return userKey;
  }

  return defaultTmdbApiKey || "";
}

function assertTmdbKey(apiKey, res, t) {
  if (!apiKey) {
    res.status(500).json({
      error: t("tmdb.apiKeyNotConfigured"),
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

async function fetchTmdb(url, apiKey, invalidResponseMessage) {
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
        error: invalidResponseMessage,
        raw: text,
      };
    }
  }

  return { response, data };
}

function readDiscoverFilters(query, type) {
  const withGenres = Number(query.with_genres);
  const voteAverageGte = Number(query.vote_average_gte);
  const withOriginalLanguage = String(query.with_original_language || "").trim();

  const filters = {
    page: Number(query.page || 1),
    language: String(query.language || "fr-FR"),
    sort_by: "popularity.desc",
  };

  if (Number.isFinite(withGenres)) {
    filters.with_genres = withGenres;
  }

  if (Number.isFinite(voteAverageGte) && voteAverageGte > 0) {
    filters["vote_average.gte"] = voteAverageGte;
  }

  if (withOriginalLanguage) {
    filters.with_original_language = withOriginalLanguage;
  }

  if (type === "movie") {
    const primaryReleaseDateGte = String(query.primary_release_date_gte || "");
    const primaryReleaseDateLte = String(query.primary_release_date_lte || "");

    if (primaryReleaseDateGte) {
      filters["primary_release_date.gte"] = primaryReleaseDateGte;
    }

    if (primaryReleaseDateLte) {
      filters["primary_release_date.lte"] = primaryReleaseDateLte;
    }
  } else {
    const firstAirDateGte = String(query.first_air_date_gte || "");
    const firstAirDateLte = String(query.first_air_date_lte || "");

    if (firstAirDateGte) {
      filters["first_air_date.gte"] = firstAirDateGte;
    }

    if (firstAirDateLte) {
      filters["first_air_date.lte"] = firstAirDateLte;
    }
  }

  return filters;
}

function hasActiveDiscoverFilters(filters, type) {
  return Boolean(
    filters.with_genres ||
      filters["vote_average.gte"] ||
      filters.with_original_language ||
      (type === "movie"
        ? filters["primary_release_date.gte"] || filters["primary_release_date.lte"]
        : filters["first_air_date.gte"] || filters["first_air_date.lte"])
  );
}

export function registerTmdbRoutes(app) {
  app.post("/api/tmdb/test-key", async (req, res) => {
    const t = getTranslator(req);
    try {
      const auth = await requireAuth(req, res);
      if (!auth) {
        return;
      }

      const apiKey = String(req.body?.apiKey || "").trim();
      if (!apiKey) {
        res.status(400).json({ error: t("tmdb.apiKeyRequired") });
        return;
      }

      const url = buildTmdbUrl("/configuration", apiKey);
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          error: data?.status_message || data?.error || t("tmdb.invalidApiKey"),
        });
        return;
      }

      res.json({
        ok: true,
        message: t("tmdb.validApiKey"),
      });
    } catch (error) {
      debugLog("TMDB key test failed:", error);
      res.status(500).json({ error: t("tmdb.testApiKeyFailed") });
    }
  });

  app.get("/api/movies/popular", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
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
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Popular movies proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchPopularMoviesFailed") });
    }
  });

  app.get("/api/movies/genres", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const language = String(req.query.language || "fr-FR");
      const url = buildTmdbUrl("/genre/movie/list", apiKey, { language });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Movie genres proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchMovieGenresFailed") });
    }
  });

  app.get("/api/movies/discover", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const page = Number(req.query.page || 1);
      const language = String(req.query.language || "fr-FR");
      const withGenres = Number(req.query.with_genres);
      const withOriginalLanguage = String(req.query.with_original_language || "").trim();
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
      if (withOriginalLanguage) {
        query.with_original_language = withOriginalLanguage;
      }
      if (primaryReleaseDateGte) {
        query["primary_release_date.gte"] = primaryReleaseDateGte;
      }
      if (primaryReleaseDateLte) {
        query["primary_release_date.lte"] = primaryReleaseDateLte;
      }
      if (Number.isFinite(voteAverageGte) && voteAverageGte > 0) {
        query["vote_average.gte"] = voteAverageGte;
      }

      const url = buildTmdbUrl("/discover/movie", apiKey, query);
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Discover movies proxy failed:", error);
      res.status(500).json({ error: t("tmdb.discoverMoviesFailed") });
    }
  });

  app.get("/api/movies/search", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const query = String(req.query.query || "").trim();
      const page = Number(req.query.page || 1);
      const language = String(req.query.language || "fr-FR");

      if (!query) {
        res.status(400).json({ error: t("tmdb.queryRequired") });
        return;
      }

      const url = buildTmdbUrl("/search/movie", apiKey, {
        query,
        page,
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Search movies proxy failed:", error);
      res.status(500).json({ error: t("tmdb.searchMoviesFailed") });
    }
  });

  app.get("/api/movies/:id", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const id = Number(req.params.id);
      const language = String(req.query.language || "fr-FR");

      if (!Number.isFinite(id)) {
        res.status(400).json({ error: t("tmdb.invalidMovieId") });
        return;
      }

      const url = buildTmdbUrl(`/movie/${id}`, apiKey, {
        language,
        append_to_response: "credits",
      });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Movie details proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchMovieDetailsFailed") });
    }
  });

  app.get("/api/series/popular", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
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
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Popular series proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchPopularSeriesFailed") });
    }
  });

  app.get("/api/series/genres", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const language = String(req.query.language || "fr-FR");
      const url = buildTmdbUrl("/genre/tv/list", apiKey, { language });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Series genres proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchSeriesGenresFailed") });
    }
  });

  app.get("/api/series/discover", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const page = Number(req.query.page || 1);
      const language = String(req.query.language || "fr-FR");
      const withGenres = Number(req.query.with_genres);
      const withOriginalLanguage = String(req.query.with_original_language || "").trim();
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
      if (withOriginalLanguage) {
        query.with_original_language = withOriginalLanguage;
      }
      if (firstAirDateGte) {
        query["first_air_date.gte"] = firstAirDateGte;
      }
      if (firstAirDateLte) {
        query["first_air_date.lte"] = firstAirDateLte;
      }
      if (Number.isFinite(voteAverageGte) && voteAverageGte > 0) {
        query["vote_average.gte"] = voteAverageGte;
      }

      const url = buildTmdbUrl("/discover/tv", apiKey, query);
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Discover series proxy failed:", error);
      res.status(500).json({ error: t("tmdb.discoverSeriesFailed") });
    }
  });

  app.get("/api/series/search", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const query = String(req.query.query || "").trim();
      const page = Number(req.query.page || 1);
      const language = String(req.query.language || "fr-FR");

      if (!query) {
        res.status(400).json({ error: t("tmdb.queryRequired") });
        return;
      }

      const url = buildTmdbUrl("/search/tv", apiKey, {
        query,
        page,
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Search series proxy failed:", error);
      res.status(500).json({ error: t("tmdb.searchSeriesFailed") });
    }
  });

  app.get("/api/series/:id", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const id = Number(req.params.id);
      const language = String(req.query.language || "fr-FR");

      if (!Number.isFinite(id)) {
        res.status(400).json({ error: t("tmdb.invalidSeriesId") });
        return;
      }

      const url = buildTmdbUrl(`/tv/${id}`, apiKey, {
        language,
        append_to_response: "credits",
      });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Series details proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchSeriesDetailsFailed") });
    }
  });

  app.get("/api/series/:id/seasons/:seasonNumber", async (req, res) => {
    const t = getTranslator(req);
    const apiKey = await getTmdbApiKey(req);
    if (!assertTmdbKey(apiKey, res, t)) {
      return;
    }

    try {
      const id = Number(req.params.id);
      const seasonNumber = Number(req.params.seasonNumber);
      const language = String(req.query.language || "fr-FR");

      if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) {
        res.status(400).json({ error: t("tmdb.invalidSeriesIdOrSeason") });
        return;
      }

      const url = buildTmdbUrl(`/tv/${id}/season/${seasonNumber}`, apiKey, {
        language,
      });
      const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
      res.status(response.status).json(data);
    } catch (error) {
      debugLog("Season details proxy failed:", error);
      res.status(500).json({ error: t("tmdb.fetchSeasonDetailsFailed") });
    }
  });
}
