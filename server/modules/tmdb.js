import { tmdbApiKey as defaultTmdbApiKey, tmdbBaseUrl } from "../config.js";
import { debugLog } from "../logger.js";
import { getTranslator } from "../i18n.js";
import { withAdmin, withAuth, getGlobalTmdbApiKey } from "./auth.js";

async function getTmdbApiKey() {
  const globalKey = await getGlobalTmdbApiKey();
  if (globalKey) {
    return globalKey;
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

function buildPopularRequest(mediaType, req) {
  const filters = readDiscoverFilters(req.query, mediaType);
  const apiPath = mediaType === "movie" ? "/discover/movie" : "/discover/tv";
  const popularPath = mediaType === "movie" ? "/movie/popular" : "/tv/popular";

  return hasActiveDiscoverFilters(filters, mediaType)
    ? { path: apiPath, query: filters }
    : {
        path: popularPath,
        query: {
          page: filters.page,
          language: filters.language,
        },
      };
}

function buildGenresRequest(mediaType, req) {
  const apiPath = mediaType === "movie" ? "/genre/movie/list" : "/genre/tv/list";
  return {
    path: apiPath,
    query: { language: String(req.query.language || "fr-FR") },
  };
}

function buildDiscoverRequest(mediaType, req) {
  const apiPath = mediaType === "movie" ? "/discover/movie" : "/discover/tv";
  return {
    path: apiPath,
    query: readDiscoverFilters(req.query, mediaType),
  };
}

function buildSearchRequest(mediaType, req, res, t) {
  const query = String(req.query.query || "").trim();
  if (!query) {
    res.status(400).json({ error: t("tmdb.queryRequired") });
    return null;
  }

  const apiPath = mediaType === "movie" ? "/search/movie" : "/search/tv";
  return {
    path: apiPath,
    query: {
      query,
      page: Number(req.query.page || 1),
      language: String(req.query.language || "fr-FR"),
    },
  };
}

function buildDetailsRequest(mediaType, req, res, t) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    const errorKey = mediaType === "movie" ? "tmdb.invalidMovieId" : "tmdb.invalidSeriesId";
    res.status(400).json({ error: t(errorKey) });
    return null;
  }

  const apiPath = mediaType === "movie" ? `/movie/${id}` : `/tv/${id}`;
  return {
    path: apiPath,
    query: {
      language: String(req.query.language || "fr-FR"),
      append_to_response: "credits",
    },
  };
}

function buildSeasonRequest(req, res, t) {
  const id = Number(req.params.id);
  const seasonNumber = Number(req.params.seasonNumber);
  if (!Number.isFinite(id) || !Number.isFinite(seasonNumber)) {
    res.status(400).json({ error: t("tmdb.invalidSeriesIdOrSeason") });
    return null;
  }

  return {
    path: `/tv/${id}/season/${seasonNumber}`,
    query: {
      language: String(req.query.language || "fr-FR"),
    },
  };
}

export function registerTmdbRoutes(app) {
  app.post("/api/tmdb/test-key", withAdmin(async (req, res, auth) => {
    const t = getTranslator(req);
    try {
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
  }));

  function registerTmdbGetProxyRoute(routePath, options) {
    app.get(routePath, withAuth(async (req, res) => {
      const t = getTranslator(req);
      const apiKey = await getTmdbApiKey();
      if (!assertTmdbKey(apiKey, res, t)) {
        return;
      }

      try {
        const request = options.buildRequest({ req, res, t });
        if (!request) {
          return;
        }

        const url = buildTmdbUrl(request.path, apiKey, request.query || {});
        const { response, data } = await fetchTmdb(url, apiKey, t("tmdb.invalidResponse"));
        res.status(response.status).json(data);
      } catch (error) {
        debugLog(`${options.debugContext} failed:`, error);
        res.status(500).json({ error: t(options.errorKey) });
      }
    }));
  }

  registerTmdbGetProxyRoute("/api/movies/popular", {
    debugContext: "Popular movies proxy",
    errorKey: "tmdb.fetchPopularMoviesFailed",
    buildRequest: ({ req }) => buildPopularRequest("movie", req),
  });

  registerTmdbGetProxyRoute("/api/movies/genres", {
    debugContext: "Movie genres proxy",
    errorKey: "tmdb.fetchMovieGenresFailed",
    buildRequest: ({ req }) => buildGenresRequest("movie", req),
  });

  registerTmdbGetProxyRoute("/api/movies/discover", {
    debugContext: "Discover movies proxy",
    errorKey: "tmdb.discoverMoviesFailed",
    buildRequest: ({ req }) => buildDiscoverRequest("movie", req),
  });

  registerTmdbGetProxyRoute("/api/movies/search", {
    debugContext: "Search movies proxy",
    errorKey: "tmdb.searchMoviesFailed",
    buildRequest: ({ req, res, t }) => buildSearchRequest("movie", req, res, t),
  });

  registerTmdbGetProxyRoute("/api/movies/:id", {
    debugContext: "Movie details proxy",
    errorKey: "tmdb.fetchMovieDetailsFailed",
    buildRequest: ({ req, res, t }) => buildDetailsRequest("movie", req, res, t),
  });

  registerTmdbGetProxyRoute("/api/series/popular", {
    debugContext: "Popular series proxy",
    errorKey: "tmdb.fetchPopularSeriesFailed",
    buildRequest: ({ req }) => buildPopularRequest("series", req),
  });

  registerTmdbGetProxyRoute("/api/series/genres", {
    debugContext: "Series genres proxy",
    errorKey: "tmdb.fetchSeriesGenresFailed",
    buildRequest: ({ req }) => buildGenresRequest("series", req),
  });

  registerTmdbGetProxyRoute("/api/series/discover", {
    debugContext: "Discover series proxy",
    errorKey: "tmdb.discoverSeriesFailed",
    buildRequest: ({ req }) => buildDiscoverRequest("series", req),
  });

  registerTmdbGetProxyRoute("/api/series/search", {
    debugContext: "Search series proxy",
    errorKey: "tmdb.searchSeriesFailed",
    buildRequest: ({ req, res, t }) => buildSearchRequest("series", req, res, t),
  });

  registerTmdbGetProxyRoute("/api/series/:id", {
    debugContext: "Series details proxy",
    errorKey: "tmdb.fetchSeriesDetailsFailed",
    buildRequest: ({ req, res, t }) => buildDetailsRequest("series", req, res, t),
  });

  registerTmdbGetProxyRoute("/api/series/:id/seasons/:seasonNumber", {
    debugContext: "Season details proxy",
    errorKey: "tmdb.fetchSeasonDetailsFailed",
    buildRequest: ({ req, res, t }) => buildSeasonRequest(req, res, t),
  });
}

