import { ErrorCode } from './errors';
import { messages } from './i18n';
import { getTmdbApiKey, updateGlobalConfig } from './setting';

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
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    throw new ErrorCode(messages.tmdb.invalidResponse);
  }
  // If the key is valid, save it in the global config
  updateGlobalConfig({ tmdbApiKey: apiKey });
};

export const proxyTmdb = async (path: string, filters: Record<string, any>): Promise<any> => {
  const apiKey = await getTmdbApiKey();
  if (!apiKey) throw new ErrorCode(messages.tmdb.apiKeyNotSet);
  const url = new URL(`${tmdbBaseUrl}${path}`);
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    throw new ErrorCode(messages.tmdb.invalidResponse);
  }
  const data = await response.json();
  return data;
};

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
  const apiPath = `/discover/${mediaType}`;
  const popularPath = `/${mediaType}/popular`;

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

export function buildDetailsRequest(mediaType: TmdbType, id: number, query: Record<string, any>) {
  return {
    path: `/${mediaType}/${id}`,
    query: {
      language: String(query.language || 'fr-FR'),
      append_to_response: 'credits',
    },
  };
}

export function buildVideosRequest(mediaType: TmdbType, id: number) {
  return {
    path: `/${mediaType}/${id}/videos`,
    query: {
      include_video_language: 'fr,en,null',
    },
  };
}

export function buildSeasonRequest(id: number, seasonNumber: number, query: Record<string, any>) {
  return {
    path: `/tv/${id}/season/${seasonNumber}`,
    query: {
      language: String(query.language || 'fr-FR'),
    },
  };
}

export function buildSearchRequest(mediaType: TmdbType | 'multi', query: Record<string, any>) {
  let apiPath: string;
  if (mediaType === 'multi') {
    apiPath = '/search/multi';
  } else if (mediaType === TmdbType.movie) {
    apiPath = '/search/movie';
  } else {
    apiPath = '/search/tv';
  }

  return {
    path: apiPath,
    query: {
      query: String(query.query || '').trim(),
      page: Number(query.page || 1),
      language: String(query.language || 'fr-FR'),
    },
  };
}

export function buildRecommendationsRequest(
  mediaType: TmdbType,
  id: number,
  query: Record<string, any>,
) {
  return {
    path: `/${mediaType}/${id}/recommendations`,
    query: {
      page: Number(query.page || 1),
      language: String(query.language || 'fr-FR'),
    },
  };
}

export function buildCollectionRequest(id: number, query: Record<string, any>) {
  return {
    path: `/collection/${id}`,
    query: {
      language: String(query.language || 'fr-FR'),
    },
  };
}

export function buildPersonRequest(id: number, query: Record<string, any>) {
  return {
    path: `/person/${id}`,
    query: {
      language: String(query.language || 'fr-FR'),
      append_to_response: 'combined_credits',
    },
  };
}

export interface NormalizedTmdbDetails {
  id: number;
  type: 'movie' | 'series';
  title: string;
  originalTitle: string;
  overview: string;
  releaseDate: string;
  year: number;
  rating: number;
  voteCount: number;
  genres: string[];
  posterPath: string | null;
  backdropPath: string | null;
  originalLanguage?: string;
  runtime?: number;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
}

export function transformTmdbDetails(raw: any, type: 'movie' | 'series'): NormalizedTmdbDetails {
  if (!raw || !raw.id) {
    throw new Error('Item not found in TMDB');
  }

  const isMovie = type === 'movie';
  const title = isMovie ? String(raw.title || '') : String(raw.name || '');
  const originalTitle = isMovie
    ? String(raw.original_title || '')
    : String(raw.original_name || '');
  const releaseDate = isMovie ? String(raw.release_date || '') : String(raw.first_air_date || '');
  const year = releaseDate ? new Date(releaseDate).getFullYear() : 0;
  const rating = Number.isFinite(Number(raw.vote_average))
    ? Math.round(Number(raw.vote_average) * 10) / 10
    : 0;
  const voteCount = Number(raw.vote_count || 0);
  const genres = Array.isArray(raw.genres)
    ? raw.genres.map((g: any) => String(g?.name || '')).filter(Boolean)
    : [];

  return {
    id: Number(raw.id),
    type,
    title,
    originalTitle,
    overview: String(raw.overview || ''),
    releaseDate,
    year,
    rating,
    voteCount,
    genres,
    posterPath: raw.poster_path ? String(raw.poster_path) : null,
    backdropPath: raw.backdrop_path ? String(raw.backdrop_path) : null,
    originalLanguage: raw.original_language ? String(raw.original_language) : undefined,
    ...(isMovie && raw.runtime !== undefined ? { runtime: Number(raw.runtime) } : {}),
    ...(!isMovie && raw.number_of_seasons !== undefined
      ? { numberOfSeasons: Number(raw.number_of_seasons) }
      : {}),
    ...(!isMovie && raw.number_of_episodes !== undefined
      ? { numberOfEpisodes: Number(raw.number_of_episodes) }
      : {}),
  };
}

export async function getTmdbDetails(
  tmdbId: number,
  type: 'movie' | 'series',
  language = 'fr-FR',
): Promise<NormalizedTmdbDetails> {
  const request = buildDetailsRequest(type === 'movie' ? TmdbType.movie : TmdbType.series, tmdbId, {
    language,
  });
  const results = await proxyTmdb(request.path, request.query);

  return transformTmdbDetails(results, type);
}
