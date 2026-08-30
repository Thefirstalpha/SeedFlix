import { getTmdbLanguageParam } from '../config/tmdb';
import type { Movie } from '../types/movie';
import type { Series } from '../types/series';
import { convertTMDBToMovie } from './movieService';
import { convertTMDBToSeries } from './seriesService';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export type MultiSearchResultItem =
  | { type: 'movie'; data: Movie }
  | { type: 'series'; data: Series };

export interface MultiSearchPageResult {
  items: MultiSearchResultItem[];
  movies: Movie[];
  series: Series[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export type TmdbVideo = {
    id: string;
    iso_639_1: string;
    iso_3166_1: string;
    key: string;
    name: string;
    site: string;
    size: number;
    type: string;
    official: boolean;
    published_at: string;
};

export function extractTrailers(videos: TmdbVideo[], preferredLanguage: string = 'fr'): TmdbVideo[] {
    if (!Array.isArray(videos)) return [];

    // Filter YouTube trailers & teasers
    const validVideos = videos.filter(
        (v) =>
            v?.site === 'YouTube' &&
            v.key &&
            (v.type === 'Trailer' || v.type === 'Teaser') &&
            v.iso_639_1 === preferredLanguage,
    );

    // Deduplicate by YouTube key
    const seenKeys = new Set<string>();
    const uniqueVideos = validVideos.filter((v) => {
        if (seenKeys.has(v.key)) return false;
        seenKeys.add(v.key);
        return true;
    });

    return uniqueVideos.sort((a, b) => {
        // 1. Trailer over Teaser
        if (a.type !== b.type) {
            return a.type === 'Trailer' ? -1 : 1;
        }

        // 2. Official first
        if (a.official !== b.official) {
            return a.official ? -1 : 1;
        }

        // 3. Language preference: FR/EN prioritizing preferred language
        const langOrder = (lang: string) => {
            const normalized = (lang || '').toLowerCase();
            if (normalized === preferredLanguage.toLowerCase()) return 4;
            if (preferredLanguage === 'fr' && normalized === 'en') return 3;
            if (preferredLanguage === 'en' && normalized === 'fr') return 3;
            if (normalized === 'fr' || normalized === 'en') return 2;
            return 1;
        };

        const langDiff = langOrder(b.iso_639_1) - langOrder(a.iso_639_1);
        if (langDiff !== 0) return langDiff;

        // 4. Quality (1080 > 720 > 480)
        if ((a.size || 0) !== (b.size || 0)) {
            return (b.size || 0) - (a.size || 0);
        }

        // 5. Name score
        const nameScore = (name: string) => {
            const lowerName = (name || '').toLowerCase();
            if (lowerName.includes('official') || lowerName.includes('officielle')) return 3;
            if (lowerName.includes('trailer') || lowerName.includes('bande-annonce')) return 2;
            if (lowerName.includes('teaser')) return 1;
            return 0;
        };
        const nameDiff = nameScore(b.name) - nameScore(a.name);
        if (nameDiff !== 0) return nameDiff;

        // 6. Date: more recent first
        const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return dateB - dateA;
    });
}

export function pickBestTrailer(videos: TmdbVideo[], preferredLanguage: string = 'fr'): TmdbVideo | undefined {
    const trailers = extractTrailers(videos, preferredLanguage);
    return trailers[0];
}

export async function getTmdbVideos(
    tmdbId: number,
    type: 'movie' | 'series',
): Promise<{ id: number; results: TmdbVideo[] }> {
    const response = await fetch(`${API_BASE_URL}/tmdb/${type}/videos/${tmdbId}`);

    if (!response.ok) {
        throw new Error('Failed to fetch TMDB videos');
    }
    return response.json();
}

export async function searchMultiPage(
    query: string,
    page = 1,
    uiLanguage = 'fr',
): Promise<MultiSearchPageResult> {
    const tmdbLanguage = getTmdbLanguageParam(uiLanguage);

    if (!query.trim()) {
        return {
            items: [],
            movies: [],
            series: [],
            page: 1,
            totalPages: 1,
            totalResults: 0,
        };
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/tmdb/multi/search?language=${encodeURIComponent(tmdbLanguage)}&query=${encodeURIComponent(
                query,
            )}&page=${page}`,
        );

        if (!response.ok) {
            throw new Error('Failed to search multi');
        }

        const data = await response.json();
        const items: MultiSearchResultItem[] = [];
        const movies: Movie[] = [];
        const series: Series[] = [];

        for (const result of data.results || []) {
            if (result.media_type === 'movie') {
                const movie = convertTMDBToMovie(result);
                movies.push(movie);
                items.push({ type: 'movie', data: movie });
            } else if (result.media_type === 'tv') {
                const show = convertTMDBToSeries(result);
                series.push(show);
                items.push({ type: 'series', data: show });
            }
        }

        return {
            items,
            movies,
            series,
            page: data.page || 1,
            totalPages: data.total_pages || 1,
            totalResults: data.total_results || 0,
        };
    } catch (error) {
        console.error('Error searching multi:', error);
        return {
            items: [],
            movies: [],
            series: [],
            page,
            totalPages: 1,
            totalResults: 0,
        };
    }
}

export interface TmdbCollectionPart {
    id: number;
    title: string;
    original_title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    vote_average: number;
    vote_count: number;
}

export interface TmdbCollectionDetails {
    id: number;
    name: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    parts: TmdbCollectionPart[];
}

export interface TmdbPersonCredit {
    id: number;
    media_type: 'movie' | 'tv';
    title?: string;
    name?: string;
    poster_path: string | null;
    vote_average: number;
    character?: string;
    job?: string;
    release_date?: string;
    first_air_date?: string;
}

export interface TmdbPersonDetails {
    id: number;
    name: string;
    biography: string;
    profile_path: string | null;
    birthday: string | null;
    place_of_birth: string | null;
    known_for_department: string;
    combined_credits?: {
        cast: TmdbPersonCredit[];
        crew: TmdbPersonCredit[];
    };
}

export async function getMediaRecommendations(
    id: number,
    type: 'movie' | 'series',
    uiLanguage = 'fr',
): Promise<Array<Movie | Series>> {
    const tmdbLanguage = getTmdbLanguageParam(uiLanguage);
    try {
        const response = await fetch(
            `${API_BASE_URL}/tmdb/${type}/recommendations/${id}?language=${encodeURIComponent(tmdbLanguage)}`,
        );
        if (!response.ok) return [];
        const data = await response.json();
        const results: Array<Movie | Series> = [];
        for (const item of data.results || []) {
            if (type === 'movie') {
                results.push(convertTMDBToMovie(item));
            } else {
                results.push(convertTMDBToSeries(item));
            }
        }
        return results;
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        return [];
    }
}

export async function getMovieCollection(
    collectionId: number,
    uiLanguage = 'fr',
): Promise<TmdbCollectionDetails | null> {
    const tmdbLanguage = getTmdbLanguageParam(uiLanguage);
    try {
        const response = await fetch(
            `${API_BASE_URL}/tmdb/collection/${collectionId}?language=${encodeURIComponent(tmdbLanguage)}`,
        );
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Error fetching collection:', error);
        return null;
    }
}

export async function getPersonDetails(
    personId: number,
    uiLanguage = 'fr',
): Promise<TmdbPersonDetails | null> {
    const tmdbLanguage = getTmdbLanguageParam(uiLanguage);
    try {
        const response = await fetch(
            `${API_BASE_URL}/tmdb/person/${personId}?language=${encodeURIComponent(tmdbLanguage)}`,
        );
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Error fetching person details:', error);
        return null;
    }
}