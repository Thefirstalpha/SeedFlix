export interface Series {
  id: number;
  title: string;
  year: number;
  rating: number;
  genre: string;
  poster: string;
}

export interface SeriesSeason {
  id: number;
  seasonNumber: number;
  name: string;
  overview: string;
  poster: string;
  airDate?: string;
  episodeCount: number;
}

export interface SeriesEpisode {
  id: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate?: string;
  runtime?: number;
  rating: number;
  still?: string;
}

export interface SeriesDetails extends Series {
  originalTitle?: string;
  plot: string;
  backdrop?: string;
  voteCount?: number;
  firstAirDate?: string;
  status?: string;
  creators: string[];
  networks: string[];
  seasons: SeriesSeason[];
}

export interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
}

export interface TMDBSeriesDetails extends TMDBSeries {
  genres: { id: number; name: string }[];
  seasons: {
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string;
    episode_count: number;
  }[];
  created_by: { id: number; name: string }[];
  networks: { id: number; name: string }[];
  status: string;
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
    crew: { id: number; name: string; job: string }[];
  };
}

export interface TMDBSeriesSeasonDetails {
  id: number;
  name: string;
  season_number: number;
  episodes: {
    id: number;
    episode_number: number;
    name: string;
    overview: string;
    air_date: string;
    runtime?: number;
    vote_average: number;
    still_path: string | null;
  }[];
}

export interface TMDBSeriesSearchResponse {
  page: number;
  results: TMDBSeries[];
  total_pages: number;
  total_results: number;
}

export const TMDB_TV_GENRES: { [key: number]: string } = {
  10759: "Action & Aventure",
  16: "Animation",
  35: "Comédie",
  80: "Crime",
  99: "Documentaire",
  18: "Drame",
  10751: "Familial",
  10762: "Enfants",
  9648: "Mystère",
  10763: "News",
  10764: "Réalité",
  10765: "Science-Fiction",
  10766: "Soap",
  10767: "Talk-show",
  10768: "Guerre & Politique",
  37: "Western"
};
