import type { Movie, TMDBMovie, TMDBMovieDetails, TMDBSearchResponse } from "../types/movie";
import { TMDB_GENRES } from "../types/movie";
import { API_BASE_URL, getTmdbImageUrl } from "../config/tmdb";

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
}

const MOCK_PAGE_SIZE = 8;

const GENRE_MAP: { [key: number]: string } = {
  28: "Action",
  12: "Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  14: "Fantastique",
  36: "Histoire",
  27: "Horreur",
  10402: "Musique",
  9648: "Mystère",
  10749: "Romance",
  878: "Science-Fiction",
  10770: "Téléfilm",
  53: "Thriller",
  10752: "Guerre",
  37: "Western"
};

// Convertir un film TMDB en notre format Movie
function convertTMDBToMovie(tmdbMovie: TMDBMovie): Movie {
  const year = tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : 0;
  const genre = tmdbMovie.genre_ids && tmdbMovie.genre_ids.length > 0 
    ? GENRE_MAP[tmdbMovie.genre_ids[0]] || "Inconnu"
    : "Inconnu";

  return {
    id: tmdbMovie.id,
    title: tmdbMovie.title,
    originalTitle: tmdbMovie.original_title,
    year,
    rating: Math.round(tmdbMovie.vote_average * 10) / 10,
    genre,
    poster: getTmdbImageUrl(tmdbMovie.poster_path),
    backdrop: getTmdbImageUrl(tmdbMovie.backdrop_path, 'original'),
    director: "Non disponible",
    actors: [],
    plot: tmdbMovie.overview || "Aucun synopsis disponible.",
    duration: "Non disponible",
    releaseDate: tmdbMovie.release_date,
    voteCount: tmdbMovie.vote_count
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
    totalResults
  };
}

// Récupérer les films populaires
export async function getPopularMoviesPage(
  page = 1,
  filters: DiscoverFilters = {}
): Promise<MoviePageResult> {
  const params = new URLSearchParams({
    language: "fr-FR",
    page: String(page),
  });

  if (Number.isFinite(filters.genreId)) {
    params.set("with_genres", String(filters.genreId));
  }
  if (Number.isFinite(filters.yearFrom)) {
    params.set("primary_release_date_gte", `${filters.yearFrom}-01-01`);
  }
  if (Number.isFinite(filters.yearTo)) {
    params.set("primary_release_date_lte", `${filters.yearTo}-12-31`);
  }
  if (Number.isFinite(filters.minRating) && (filters.minRating || 0) > 0) {
    params.set("vote_average_gte", String(filters.minRating));
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/movies/popular?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch popular movies');
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results
    };
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return paginateMovies(getMockMovies(), page);
  }
}

export async function getMovieGenres(): Promise<GenreItem[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/movies/genres?language=fr-FR`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch movie genres");
    }

    const data = await response.json();
    return Array.isArray(data?.genres) ? data.genres : [];
  } catch (error) {
    console.error("Error fetching movie genres:", error);
    return Object.entries(TMDB_GENRES).map(([id, name]) => ({
      id: Number(id),
      name,
    }));
  }
}

export async function discoverMoviesPage(
  page = 1,
  filters: DiscoverFilters = {}
): Promise<MoviePageResult> {
  const params = new URLSearchParams({
    language: "fr-FR",
    page: String(page),
  });

  if (Number.isFinite(filters.genreId)) {
    params.set("with_genres", String(filters.genreId));
  }
  if (Number.isFinite(filters.yearFrom)) {
    params.set("primary_release_date_gte", `${filters.yearFrom}-01-01`);
  }
  if (Number.isFinite(filters.yearTo)) {
    params.set("primary_release_date_lte", `${filters.yearTo}-12-31`);
  }
  if (Number.isFinite(filters.minRating) && (filters.minRating || 0) > 0) {
    params.set("vote_average_gte", String(filters.minRating));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/movies/discover?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to discover movies");
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error("Error discovering movies:", error);
    return getPopularMoviesPage(page);
  }
}

// Compatibilité: conserver la version non paginée
export async function getPopularMovies(): Promise<Movie[]> {
  const response = await getPopularMoviesPage(1);
  return response.movies;
}

// Rechercher des films
export async function searchMoviesPage(query: string, page = 1): Promise<MoviePageResult> {
  if (!query.trim()) {
    return getPopularMoviesPage(page);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/movies/search?language=fr-FR&query=${encodeURIComponent(query)}&page=${page}`
    );

    if (!response.ok) {
      throw new Error('Failed to search movies');
    }

    const data: TMDBSearchResponse = await response.json();
    return {
      movies: data.results.map(convertTMDBToMovie),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results
    };
  } catch (error) {
    console.error('Error searching movies:', error);
    return {
      movies: [],
      page,
      totalPages: 1,
      totalResults: 0
    };
  }
}

// Compatibilité: conserver la version non paginée
export async function searchMovies(query: string): Promise<Movie[]> {
  const response = await searchMoviesPage(query, 1);
  return response.movies;
}

// Récupérer les détails d'un film
export async function getMovieById(id: number): Promise<Movie | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/movies/${id}?language=fr-FR`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch movie details');
    }

    const data: TMDBMovieDetails = await response.json();
    
    // Extraire le réalisateur
    const director = data.credits?.crew.find(person => person.job === 'Director')?.name || "Non disponible";
    
    // Extraire les acteurs principaux (top 5)
    const actors = data.credits?.cast.slice(0, 5).map(actor => actor.name) || [];
    
    // Convertir la durée
    const hours = Math.floor(data.runtime / 60);
    const minutes = data.runtime % 60;
    const duration = `${hours}h ${minutes}min`;

    // Obtenir le genre principal
    const genre = data.genres && data.genres.length > 0 ? data.genres[0].name : "Inconnu";

    return {
      id: data.id,
      title: data.title,
      originalTitle: data.original_title,
      year: data.release_date ? new Date(data.release_date).getFullYear() : 0,
      rating: Math.round(data.vote_average * 10) / 10,
      genre,
      poster: getTmdbImageUrl(data.poster_path),
      backdrop: getTmdbImageUrl(data.backdrop_path, 'original'),
      director,
      actors,
      plot: data.overview || "Aucun synopsis disponible.",
      duration,
      releaseDate: data.release_date,
      voteCount: data.vote_count
    };
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return null;
  }
}

export async function searchMovieReleases(query: string, limit = 12): Promise<TorznabMovieSearchResponse> {
  const response = await fetch(
    `${API_BASE_URL}/indexer/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    {
      credentials: "include",
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Recherche tracker impossible");
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
    {
      id: 1,
      title: "Le Dernier Horizon",
      year: 2025,
      rating: 8.7,
      genre: "Science-Fiction",
      poster: "https://images.unsplash.com/photo-1578374173713-32f6ae6f3971?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2llbmNlJTIwZmljdGlvbiUyMG1vdmllfGVufDF8fHx8MTc3NTQzMzE2OXww&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Sarah Chen",
      actors: ["Tom Hardy", "Emma Stone", "Oscar Isaac"],
      plot: "Dans un futur lointain, l'humanité doit trouver une nouvelle planète habitable avant que la Terre ne devienne inhabitable. Une équipe d'explorateurs courageux se lance dans un voyage interstellaire périlleux pour sauver l'espèce humaine.",
      duration: "2h 28min"
    },
    {
      id: 2,
      title: "Ombres du Passé",
      year: 2024,
      rating: 7.9,
      genre: "Thriller",
      poster: "https://images.unsplash.com/photo-1662937600299-7cb9ff0b1061?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aHJpbGxlciUyMGRhcmslMjBjaW5lbWF8ZW58MXx8fHwxNzc1NDg3NTE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Michael Rodriguez",
      actors: ["Jessica Chastain", "Jake Gyllenhaal", "Idris Elba"],
      plot: "Une détective brillante doit résoudre une série de meurtres mystérieux qui semblent connectés à des événements de son propre passé. Plus elle s'approche de la vérité, plus elle réalise que le tueur la connaît intimement.",
      duration: "2h 15min"
    },
    {
      id: 3,
      title: "L'Épopée Fantastique",
      year: 2026,
      rating: 9.1,
      genre: "Aventure",
      poster: "https://images.unsplash.com/photo-1773518011746-4f1c46ddced1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZHZlbnR1cmUlMjBtb3ZpZSUyMGVwaWN8ZW58MXx8fHwxNzc1NDg3NTE0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Peter Jackson",
      actors: ["Chris Hemsworth", "Zendaya", "Benedict Cumberbatch"],
      plot: "Un jeune héros ordinaire découvre qu'il est le dernier d'une lignée de guerriers magiques. Il doit maîtriser ses pouvoirs et rassembler une équipe diverse pour empêcher un ancien mal de détruire tous les royaumes.",
      duration: "3h 05min"
    },
    {
      id: 4,
      title: "Rires et Émotions",
      year: 2025,
      rating: 7.5,
      genre: "Comédie",
      poster: "https://images.unsplash.com/photo-1606397591059-2bc4e008bf60?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb21hbnRpYyUyMGNvbWVkeSUyMG1vdmllfGVufDF8fHx8MTc3NTQ0MjU1OHww&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Judd Apatow",
      actors: ["Ryan Reynolds", "Sandra Bullock", "Kevin Hart"],
      plot: "Deux anciens meilleurs amis se retrouvent après 10 ans et décident de rattraper le temps perdu en accomplissant une liste de défis fous qu'ils avaient créée quand ils étaient adolescents.",
      duration: "1h 52min"
    },
    {
      id: 5,
      title: "Les Murmures de Minuit",
      year: 2024,
      rating: 8.3,
      genre: "Horreur",
      poster: "https://images.unsplash.com/photo-1630338679229-99fb150fbf88?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3Jyb3IlMjBtb3ZpZSUyMGRhcmt8ZW58MXx8fHwxNzc1NDE3ODkzfDA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Ari Aster",
      actors: ["Florence Pugh", "Toni Collette", "Bill Skarsgård"],
      plot: "Une famille emménage dans une vieille maison isolée et commence à entendre d'étranges murmures la nuit. Ils découvrent bientôt que la maison cache un terrible secret lié à des rituels anciens.",
      duration: "2h 18min"
    },
    {
      id: 6,
      title: "Le Cœur des Étoiles",
      year: 2025,
      rating: 8.0,
      genre: "Drame",
      poster: "https://images.unsplash.com/photo-1762356121454-877acbd554bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBkcmFtYSUyMGZpbG18ZW58MXx8fHwxNzc1NDg3NTEzfDA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Greta Gerwig",
      actors: ["Saoirse Ronan", "Timothée Chalamet", "Meryl Streep"],
      plot: "Une jeune astronome talentueuse doit choisir entre sa carrière prometteuse et sa famille qui traverse une période difficile. Un film émouvant sur les sacrifices et l'amour familial.",
      duration: "2h 10min"
    },
    {
      id: 7,
      title: "L'Envol Magique",
      year: 2026,
      rating: 8.8,
      genre: "Animation",
      poster: "https://images.unsplash.com/photo-1767557125491-b3483567d843?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbmltYXRpb24lMjBjYXJ0b29uJTIwY29sb3JmdWx8ZW58MXx8fHwxNzc1NDI0Nzc5fDA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Pete Docter",
      actors: ["Tom Hanks", "Scarlett Johansson", "Chris Pratt"],
      plot: "Un jeune oiseau qui a peur de voler doit surmonter ses craintes pour sauver sa famille d'une tempête imminente. Une aventure colorée et touchante pour toute la famille.",
      duration: "1h 35min"
    },
    {
      id: 8,
      title: "Code Rouge",
      year: 2025,
      rating: 7.7,
      genre: "Action",
      poster: "https://images.unsplash.com/photo-1765510296004-614b6cc204da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3ZpZSUyMHBvc3RlciUyMGFjdGlvbnxlbnwxfHx8fDE3NzU0ODc1MTN8MA&ixlib=rb-4.1.0&q=80&w=1080",
      director: "Christopher McQuarrie",
      actors: ["Tom Cruise", "Charlize Theron", "Jason Statham"],
      plot: "Un agent secret chevronné doit empêcher une organisation terroriste de déclencher une arme nucléaire dans une grande métropole. Une course contre la montre avec des cascades spectaculaires.",
      duration: "2h 22min"
    }
  ];
}
