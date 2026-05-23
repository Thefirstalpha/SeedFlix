import { get } from "node:http";
import { IndexerSettings, TransmissionSettings } from "../../common/settings";
import { createAuth } from "./auth";
import { db, readStore, runInTransaction } from "./db";
import { buildDetailsRequest, proxyTmdb, TmdbType } from "./tmdb";


interface WishListItem {
    tmdb: number;
    type: 'movie' | 'series';
    title: string;
    releaseDate: string;
    addedAt: string;
    poster_path: string | null;
    original_title: string;
    all_seasons: boolean;
    seasons: {
        [seasonNumber: number]: {
            season_number: number;
            all_episodes: boolean;
            episodes: number[];
        }
    }
}


export function getWishlist(userId: number): WishListItem[] {
    const whishlist = readStore('whishlist', userId);
    if (!whishlist || !Array.isArray(whishlist)) {
        return [];
    }
    let parsed: WishListItem[] = [];
    for (const item of whishlist) {
        if (typeof item === 'object' && item !== null) {
            const tmdb = Number(item.tmdb);
            const type = item.type === 'movie' ? 'movie' : item.type === 'series' ? 'series' : null;
            const title = String(item.title || '');
            const releaseDate = String(item.releaseDate || '');
            const addedAt = String(item.addedAt || '');
            const poster_path = item.poster_path !== undefined && item.poster_path !== null ? String(item.poster_path) : null;
            const original_title = String(item.original_title || '');
            const all_seasons = Boolean(item.all_seasons);
            let seasons: Record<number, { season_number: number, all_episodes: boolean, episodes: number[] }> = {};
            if (item.seasons && typeof item.seasons === 'object') {
                for (const [key, value] of Object.entries(item.seasons)) {
                    const seasonNumber = Number(key);
                    if (isNaN(seasonNumber) || typeof value !== 'object' || value === null) {
                        continue;
                    }
                    const all_episodes = Boolean((value as any).all_episodes);
                    const episodes = Array.isArray((value as any)?.episodes) ? (value as any).episodes.map(Number).filter(num => !isNaN(num)) : [];
                    seasons[seasonNumber] = {
                        season_number: seasonNumber,
                        all_episodes,
                        episodes
                    };
                }
            }

            if (!isNaN(tmdb) && type && title && releaseDate && addedAt && original_title) {
                parsed.push({
                    tmdb,
                    type,
                    title,
                    releaseDate,
                    addedAt,
                    poster_path,
                    original_title,
                    all_seasons,
                    seasons
                });
            }
        }
    }
    return parsed;
}

export async function addToWishlist(userId: number, tmdbId: number, type: 'movie' | 'series', seasonNumber?: number, episodeNumber?: number) {

    const request = buildDetailsRequest(type == 'movie' ? TmdbType.movie : TmdbType.series, tmdbId, {});
    const results = await proxyTmdb(request.path, request.query);
    
    if (!results || !results.id) {
        throw new Error('Item not found in TMDB');
    }
    const item : WishListItem = {
        tmdb: results.id,
        type,
}