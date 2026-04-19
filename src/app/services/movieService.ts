import { API_BASE_URL, getTmdbImageUrl, getTmdbLanguageParam } from '../config/tmdb';
import type { Movie, TMDBMovie, TMDBMovieDetails, TMDBSearchResponse } from '../types/movie';
import { TMDB_GENRES } from '../types/movie';

export interface MoviePageResult {
  movies: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface GenreItem {
  id: number;
  name: string;
}

export interface TorznabMovieResult {
  title: string;
  link: string;
  downloadUrl?: string;
  tmdbId?: string | null;
  guid?: string;
  pubDate?: string;
  size?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
  attributes?: Record<string, string>;
}

export interface TorznabMovieSearchResponse {
  ok: boolean;
  query: string;
  sourceTitle?: string | null;
  items: TorznabMovieResult[];
}

export interface DiscoverFilters {
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  originalLanguage?: string;
}

const MOCK_PAGE_SIZE = 8;

const GENRE_MAP: { [key: number]: string } = {
  28: 'Action',
  12: 'Aventure',
  16: 'Animation',
  35: 'Comédie',
  80: 'Crime',
  99: 'Documentaire',
  18: 'Drame',
  10751: 'Familial',
  14: 'Fantastique',
  36: 'Histoire',
  27: 'Horreur',
  10402: 'Musique',
  9648: 'Mystère',
  10749: 'Romance',
  878: 'Science-Fiction',
  10770: 'Téléfilm',
  53: 'Thriller',
  10752: 'Guerre',
  37: 'Western',
};

const TMDB_LANGUAGE_MAP: Record<string, string> = {
  fr: 'Francais',
  en: 'Anglais',
  ja: 'Japonais',
  ko: 'Coreen',
  es: 'Espagnol',
  it: 'Italien',
  de: 'Allemand',
  pt: 'Portugais',
  ru: 'Russe',
  zh: 'Chinois',
};

function mapTmdbLanguage(code: string | undefined) {
  const normalized = String(code || '')
    .toLowerCase()
    .trim();
  if (!normalized) {
    return 'Inconnu';
  }

  return TMDB_LANGUAGE_MAP[normalized] || normalized.toUpperCase();
}

// Convertir un film TMDB en notre format Movie
function convertTMDBToMovie(tmdbMovie: TMDBMovie): Movie {
  const year = tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : 0;
  const genre =
    tmdbMovie.genre_ids && tmdbMovie.genre_ids.length > 0
      ? GENRE_MAP[tmdbMovie.genre_ids[0]] || 'Inconnu'
      : 'Inconnu';

  return {
    id: tmdbMovie.id,
    title: tmdbMovie.title,
    originalTitle: tmdbMovie.original_title,
    year,
    rating: Math.round(tmdbMovie.vote_average * 10) / 10,
    language: mapTmdbLanguage(tmdbMovie.original_language),
    genre,
    poster: getTmdbImageUrl(tmdbMovie.poster_path),
    backdrop: getTmdbImageUrl(tmdbMovie.backdrop_path, 'original'),
    director: 'Non disponible',
    actors: [],
    plot: tmdbMovie.overview || 'Aucun synopsis disponible.',
    duration: 'Non disponible',
    releaseDate: tmdbMovie.release_date,
    voteCount: tmdbMovie.vote_count,
  };
}

function paginateMovies(movies: Movie[], page: number): MoviePageResult {
  const safePage = Math.max(1, page);
  const totalResults = movies.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / MOCK_PAGE_SIZE));
  const startIndex = (safePage - 1) * MOCK_PAGE_SIZE;
  const pageMovies = movies.slice(startIndex, startIndex + MOCK_PAGE_SIZE);

  return {
    movies: pageMovies,
    page: safePage,
    totalPages,
    totalResults,
  };
}

// Récupérer les films populaires
export async function getPopularMoviesPage(
  page = 1,
  filters: DiscoverFilters = {},
  uiLanguage = 'fr',
): Promise<MoviePageResult> {
  const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

  const params = new URLSearchParams({
    language: tmdbLanguage,
    page: String(page),
  });

  if (Number.isFinite(filters.genreId)) {
    params.set('with_genres', String(filters.genreId));
  }
  if (Number.isFinite(filters.yearFrom)) {
    params.set('primary_release_date_gte', `${filters.yearFrom}-01-01`);
  }
  if (Number.isFinite(filters.yearTo)) {
    params.set('primary_release_date_lte', `${filters.yearTo}-12-31`);
  }
  if (Number.isFinite(filters.minRating) && (filters.minRating || 0) > 0) {
    params.set('vote_average_gte', String(filters.minRating));
  }
  if (filters.originalLanguage) {
    params.set('with_original_language', filters.originalLanguage);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tmdb/movie/popular?${params.toString()}`);

    if (!response.ok) {
      throw new Error('Failed to fetch popular movies');
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return paginateMovies(getMockMovies(), page);
  }
}

export async function getMovieGenres(uiLanguage = 'fr'): Promise<GenreItem[]> {
  const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

  try {
    const response = await fetch(
      `${API_BASE_URL}/tmdb/movie/genres?language=${encodeURIComponent(tmdbLanguage)}`,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch movie genres');
    }

    const data = await response.json();
    return Array.isArray(data?.genres) ? data.genres : [];
  } catch (error) {
    console.error('Error fetching movie genres:', error);
    return Object.entries(TMDB_GENRES).map(([id, name]) => ({
      id: Number(id),
      name,
    }));
  }
}

export async function discoverMoviesPage(
  page = 1,
  filters: DiscoverFilters = {},
  uiLanguage = 'fr',
): Promise<MoviePageResult> {
  const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

  const params = new URLSearchParams({
    language: tmdbLanguage,
    page: String(page),
  });

  if (Number.isFinite(filters.genreId)) {
    params.set('with_genres', String(filters.genreId));
  }
  if (Number.isFinite(filters.yearFrom)) {
    params.set('primary_release_date_gte', `${filters.yearFrom}-01-01`);
  }
  if (Number.isFinite(filters.yearTo)) {
    params.set('primary_release_date_lte', `${filters.yearTo}-12-31`);
  }
  if (Number.isFinite(filters.minRating) && (filters.minRating || 0) > 0) {
    params.set('vote_average_gte', String(filters.minRating));
  }
  if (filters.originalLanguage) {
    params.set('with_original_language', filters.originalLanguage);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/tmdb/movie/discover?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to discover movies');
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error('Error discovering movies:', error);
    return getPopularMoviesPage(page, {}, uiLanguage);
  }
}

// Compatibilité: conserver la version non paginée
export async function getPopularMovies(uiLanguage = 'fr'): Promise<Movie[]> {
  const response = await getPopularMoviesPage(1, {}, uiLanguage);
  return response.movies;
}

// Rechercher des films
export async function searchMoviesPage(
  query: string,
  page = 1,
  uiLanguage = 'fr',
): Promise<MoviePageResult> {
  const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

  if (!query.trim()) {
    return getPopularMoviesPage(page, {}, uiLanguage);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/tmdb/movie/search?language=${encodeURIComponent(tmdbLanguage)}&query=${encodeURIComponent(query)}&page=${page}`,
    );

    if (!response.ok) {
      throw new Error('Failed to search movies');
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error('Error searching movies:', error);
    return {
      movies: [],
      page,
      totalPages: 1,
      totalResults: 0,
    };
  }
}

// Compatibilité: conserver la version non paginée
export async function searchMovies(query: string, uiLanguage = 'fr'): Promise<Movie[]> {
  const response = await searchMoviesPage(query, 1, uiLanguage);
  return response.movies;
}

// Récupérer les détails d'un film
export async function getMovieById(id: number, uiLanguage = 'fr'): Promise<Movie | null> {
  const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

  try {
    const response = await fetch(
      `${API_BASE_URL}/tmdb/movie/details/${id}?language=${encodeURIComponent(tmdbLanguage)}`,
    );

    if (!response.ok) {
      throw new Error('Failed to fetch movie details');
    }

    const data: TMDBMovieDetails = await response.json();

    // Extraire le réalisateur
    const director =
      data.credits?.crew.find((person) => person.job === 'Director')?.name || 'Non disponible';

    // Extraire les acteurs principaux (top 5)
    const actors = data.credits?.cast.slice(0, 5).map((actor) => actor.name) || [];

    // Convertir la durée
    const hours = Math.floor(data.runtime / 60);
    const minutes = data.runtime % 60;
    const duration = `${hours}h ${minutes}min`;

    // Obtenir le genre principal
    const genre = data.genres && data.genres.length > 0 ? data.genres[0].name : 'Inconnu';

    return {
      id: data.id,
      title: data.title,
      originalTitle: data.original_title,
      year: data.release_date ? new Date(data.release_date).getFullYear() : 0,
      rating: Math.round(data.vote_average * 10) / 10,
      language: mapTmdbLanguage(data.original_language),
      genre,
      poster: getTmdbImageUrl(data.poster_path),
      backdrop: getTmdbImageUrl(data.backdrop_path, 'original'),
      director,
      actors,
      plot: data.overview || 'Aucun synopsis disponible.',
      duration,
      releaseDate: data.release_date,
      voteCount: data.vote_count,
    };
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return null;
  }
}

export async function searchMovieReleases(
  query: string,
  limit = 12,
  tmdbId?: number | string,
): Promise<TorznabMovieSearchResponse> {
  const tmdbPart =
    tmdbId !== undefined && tmdbId !== null ? `&tmdbId=${encodeURIComponent(String(tmdbId))}` : '';

  const response = await fetch(
    `${API_BASE_URL}/indexer/search?query=${encodeURIComponent(query)}&limit=${limit}${tmdbPart}`,
    {
      credentials: 'include',
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Recherche via l'indexer impossible");
  }

  return {
    ok: Boolean(data?.ok),
    query: String(data?.query || query),
    sourceTitle: data?.sourceTitle ? String(data.sourceTitle) : null,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

// Données de secours (mock) pour quand l'API n'est pas configurée
function getMockMovies(): Movie[] {
  return [
  ];
}
