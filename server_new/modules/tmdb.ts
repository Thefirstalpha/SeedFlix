import { ErrorCode } from "./errors";
import { messages } from "./i18n";
import { getTmdbApiKey, updateGlobalConfig } from "./setting";

const tmdbBaseUrl = 'https://api.themoviedb.org/3';

export enum TmdbType {
    movie = 'movie',
    series = 'tv',
}


function buildFilters(query: Record<string, any>, type: string) {
    const withGenres = Number(query.with_genres);
    const voteAverageGte = Number(query.vote_average_gte);
    const withOriginalLanguage = String(query.with_original_language || '').trim();

    let filters: Record<string, any> = {
        page: Number(query.page || 1),
        language: String(query.language || 'fr-FR'),
        sort_by: 'popularity.desc',
    };

    if (Number.isFinite(withGenres)) {
        filters.with_genres = withGenres;
    }

    if (Number.isFinite(voteAverageGte) && voteAverageGte > 0) {
        filters['vote_average.gte'] = voteAverageGte;
    }

    if (withOriginalLanguage) {
        filters.with_original_language = withOriginalLanguage;
    }

    if (type === 'movie') {
        const primaryReleaseDateGte = String(query.primary_release_date_gte || '');
        const primaryReleaseDateLte = String(query.primary_release_date_lte || '');

        if (primaryReleaseDateGte) {
            filters['primary_release_date.gte'] = primaryReleaseDateGte;
        }

        if (primaryReleaseDateLte) {
            filters['primary_release_date.lte'] = primaryReleaseDateLte;
        }
    } else {
        const firstAirDateGte = String(query.first_air_date_gte || '');
        const firstAirDateLte = String(query.first_air_date_lte || '');

        if (firstAirDateGte) {
            filters['first_air_date.gte'] = firstAirDateGte;
        }

        if (firstAirDateLte) {
            filters['first_air_date.lte'] = firstAirDateLte;
        }
    }

    return filters;
}

export const configureTmdbApiKey = async (apiKey: string) => {
    if (!apiKey) {
        throw new ErrorCode(messages.tmdb.apiKeyNotSet);
    }
    // Test the API key by making a simple request
    const url = new URL(`${tmdbBaseUrl}/authentication`);
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!response.ok) {
        throw new ErrorCode(messages.tmdb.invalidResponse);
    }
    // If the key is valid, save it in the global config
    updateGlobalConfig({ tmdbApiKey: apiKey });
}

export const proxyTmdb = async (path: string, filters: Record<string, any>) => {
    const apiKey = await getTmdbApiKey();
    if (!apiKey)
        throw new ErrorCode(messages.tmdb.apiKeyNotSet);
    const url = new URL(`${tmdbBaseUrl}${path}`);
    for (const [key, value] of Object.entries(filters)) {
        url.searchParams.set(key, value);
    }
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!response.ok) {
        throw new ErrorCode(messages.tmdb.invalidResponse);
    }
    const data = await response.json();
    return data;
}

function hasActiveDiscoverFilters(filters: Record<string, any>, type: TmdbType) {
  return Boolean(
    filters.with_genres ||
    filters['vote_average.gte'] ||
    filters.with_original_language ||
    (type === TmdbType.movie
      ? filters['primary_release_date.gte'] || filters['primary_release_date.lte']
      : filters['first_air_date.gte'] || filters['first_air_date.lte']),
  );
}

export function buildPopularRequest(mediaType: TmdbType, query: Record<string, any>) {
  const filters = buildFilters(query, mediaType);
  const apiPath = `/discover/${mediaType}`
  const popularPath = `/${mediaType}/popular`

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


export function buildGenresRequest(mediaType: TmdbType, query: Record<string, any>) {
  return {
    path: `/genre/${mediaType}/list`,
    query: { language: String(query.language || 'fr-FR') },
  };
}

export function buildDetailsRequest(mediaType: TmdbType, id : number, query: Record<string, any>) {
  return {
    path: `/${mediaType}/${id}`,
    query: {
      language: String(query.language || 'fr-FR'),
      append_to_response: 'credits',
    },
  };
}

export function buildSeasonRequest(id : number, seasonNumber: Number, query: Record<string, any>) {
  return {
    path: `/tv/${id}/season/${seasonNumber}`,
    query: {
      language: String(query.language || 'fr-FR'),
    },
  };
}


export function buildSearchRequest(mediaType: TmdbType, query: Record<string, any>) {
  const apiPath = mediaType === 'movie' ? '/search/movie' : '/search/tv';
  return {
    path: apiPath,
    query: {
      query: String(query.query || '').trim(),
      page: Number(query.page || 1),
      language: String(query.language || 'fr-FR'),
    },
  };
}