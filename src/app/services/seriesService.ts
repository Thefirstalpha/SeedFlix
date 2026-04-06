import { API_BASE_URL, getTmdbImageUrl } from "../config/tmdb";
import type {
  Series,
  SeriesDetails,
  SeriesEpisode,
  TMDBSeries,
  TMDBSeriesDetails,
  TMDBSeriesSeasonDetails,
  TMDBSeriesSearchResponse,
} from "../types/series";

export interface SeriesPageResult {
  series: Series[];
  page: number;
  totalPages: number;
  totalResults: number;
}

const TV_GENRE_MAP: { [key: number]: string } = {
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
  37: "Western",
};

function convertTMDBToSeries(tmdbSeries: TMDBSeries): Series {
  const year = tmdbSeries.first_air_date
    ? new Date(tmdbSeries.first_air_date).getFullYear()
    : 0;
  const genre =
    tmdbSeries.genre_ids && tmdbSeries.genre_ids.length > 0
      ? TV_GENRE_MAP[tmdbSeries.genre_ids[0]] || "Inconnu"
      : "Inconnu";

  return {
    id: tmdbSeries.id,
    title: tmdbSeries.name,
    year,
    rating: Math.round(tmdbSeries.vote_average * 10) / 10,
    genre,
    poster: getTmdbImageUrl(tmdbSeries.poster_path),
  };
}

function convertTMDBToSeriesDetails(tmdbSeries: TMDBSeriesDetails): SeriesDetails {
  const year = tmdbSeries.first_air_date
    ? new Date(tmdbSeries.first_air_date).getFullYear()
    : 0;
  const genre =
    tmdbSeries.genres && tmdbSeries.genres.length > 0
      ? tmdbSeries.genres[0].name
      : "Inconnu";

  return {
    id: tmdbSeries.id,
    title: tmdbSeries.name,
    originalTitle: tmdbSeries.original_name,
    year,
    rating: Math.round(tmdbSeries.vote_average * 10) / 10,
    genre,
    poster: getTmdbImageUrl(tmdbSeries.poster_path),
    backdrop: getTmdbImageUrl(tmdbSeries.backdrop_path, "original"),
    plot: tmdbSeries.overview || "Aucun synopsis disponible.",
    voteCount: tmdbSeries.vote_count,
    firstAirDate: tmdbSeries.first_air_date,
    status: tmdbSeries.status,
    creators: (tmdbSeries.created_by || []).map((creator) => creator.name),
    networks: (tmdbSeries.networks || []).map((network) => network.name),
    seasons: (tmdbSeries.seasons || [])
      .filter((season) => season.season_number >= 0)
      .map((season) => ({
        id: season.id,
        seasonNumber: season.season_number,
        name: season.name,
        overview: season.overview || "Aucune description disponible.",
        poster: getTmdbImageUrl(season.poster_path),
        airDate: season.air_date,
        episodeCount: season.episode_count,
      })),
  };
}

function convertTMDBToEpisodes(
  seasonDetails: TMDBSeriesSeasonDetails
): SeriesEpisode[] {
  return (seasonDetails.episodes || []).map((episode) => ({
    id: episode.id,
    episodeNumber: episode.episode_number,
    name: episode.name,
    overview: episode.overview || "Aucune description disponible.",
    airDate: episode.air_date,
    runtime: episode.runtime,
    rating: Math.round((episode.vote_average || 0) * 10) / 10,
    still: episode.still_path
      ? getTmdbImageUrl(episode.still_path)
      : undefined,
  }));
}

function getMockSeries(): Series[] {
  return [
    {
      id: 900001,
      title: "Chroniques du Néon",
      year: 2026,
      rating: 8.4,
      genre: "Science-Fiction",
      poster:
        "https://images.unsplash.com/photo-1515630278258-407f66498911?auto=format&fit=crop&w=800&q=80",
    },
    {
      id: 900002,
      title: "Brigade Nocturne",
      year: 2025,
      rating: 7.9,
      genre: "Crime",
      poster:
        "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=800&q=80",
    },
  ];
}

export async function getPopularSeriesPage(page = 1): Promise<SeriesPageResult> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/series/popular?language=fr-FR&page=${page}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch popular series");
    }

    const data: TMDBSeriesSearchResponse = await response.json();
    return {
      series: data.results.map(convertTMDBToSeries),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error("Error fetching popular series:", error);
    return {
      series: page === 1 ? getMockSeries() : [],
      page,
      totalPages: 1,
      totalResults: page === 1 ? getMockSeries().length : 0,
    };
  }
}

export async function searchSeriesPage(query: string, page = 1): Promise<SeriesPageResult> {
  if (!query.trim()) {
    return getPopularSeriesPage(page);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/series/search?language=fr-FR&query=${encodeURIComponent(
        query
      )}&page=${page}`
    );

    if (!response.ok) {
      throw new Error("Failed to search series");
    }

    const data: TMDBSeriesSearchResponse = await response.json();
    return {
      series: data.results.map(convertTMDBToSeries),
      page: data.page,
      totalPages: data.total_pages,
      totalResults: data.total_results,
    };
  } catch (error) {
    console.error("Error searching series:", error);
    return {
      series: [],
      page,
      totalPages: 1,
      totalResults: 0,
    };
  }
}

export async function getSeriesById(id: number): Promise<SeriesDetails | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/series/${id}?language=fr-FR`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch series details");
    }

    const data: TMDBSeriesDetails = await response.json();
    return convertTMDBToSeriesDetails(data);
  } catch (error) {
    console.error("Error fetching series details:", error);
    return null;
  }
}

export async function getSeriesSeasonEpisodes(
  seriesId: number,
  seasonNumber: number
): Promise<SeriesEpisode[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/series/${seriesId}/seasons/${seasonNumber}?language=fr-FR`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch season episodes");
    }

    const data: TMDBSeriesSeasonDetails = await response.json();
    return convertTMDBToEpisodes(data);
  } catch (error) {
    console.error("Error fetching season episodes:", error);
    return [];
  }
}
