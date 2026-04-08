export interface TorznabSearchItem {
  title: string;
  link: string;
  guid?: string;
  pubDate?: string;
  size?: number | null;
  seeders?: number | null;
}

export interface TorznabSearchData {
  query: string;
  searchedAt: string;
  status: "ok" | "error" | "skipped";
  message: string;
  items: TorznabSearchItem[];
}

export interface Movie {
  id: number;
  title: string;
  year: number;
  rating: number;
  language?: string;
  genre: string;
  poster: string;
  director: string;
  actors: string[];
  plot: string;
  duration: string;
  backdrop?: string;
  originalTitle?: string;
  releaseDate?: string;
  voteCount?: number;
  torznab?: TorznabSearchData;
}

// TMDB API Response Types
export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  original_language?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number;
  genres: { id: number; name: string }[];
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// Genre mapping
export const TMDB_GENRES: { [key: number]: string } = {
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
