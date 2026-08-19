
import { WishListItem } from "../../common/wishlist";
import { readStore, runInTransaction } from "./db";
import { buildDetailsRequest, proxyTmdb, TmdbType } from "./tmdb";




export async function getWishlist(userId: number): Promise<WishListItem[]> {
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
            const genre = String(item.genre || '');
            const rating = Number(item.rating || 0);
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
                    const episodes = Array.isArray((value as any)?.episodes) ? (value as any).episodes.map(Number).filter((num: number) => !isNaN(num)) : [];
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
                    genre,
                    rating,
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
    

    await runInTransaction(async ({ writeStore }) => {
        let whishlist = await getWishlist(userId);
        let existingItem: WishListItem | undefined = whishlist.find((item: WishListItem) => item.tmdb === tmdbId && item.type === type);
        if (existingItem) {
            if (type === 'series') {
                if (seasonNumber !== undefined) {
                    if (!existingItem.seasons) {
                        existingItem.seasons = {}
                    }
                    if (episodeNumber !== undefined) {
                        if (existingItem.seasons[seasonNumber] === undefined) {
                            existingItem.seasons[seasonNumber] = {
                                season_number: seasonNumber,
                                all_episodes: false,
                                episodes: [episodeNumber]
                            }
                        } else if (!existingItem.seasons[seasonNumber].all_episodes) {
                            if (episodeNumber !== undefined && !existingItem.seasons[seasonNumber].episodes.includes(episodeNumber)) {
                                existingItem.seasons[seasonNumber].episodes.push(episodeNumber);
                            }
                        }
                    } else {
                        if (existingItem.seasons[seasonNumber] !== undefined) {
                            existingItem.seasons[seasonNumber] = {
                                season_number: seasonNumber,
                                all_episodes: true,
                                episodes: []
                            }
                        }
                    }
                } else {
                    existingItem.all_seasons = true;
                    existingItem.seasons = {};
                }
            }
            writeStore('whishlist', userId, whishlist);
        } else {

            let item: WishListItem = {
                tmdb: results.id,
                type: type,
                title: type === 'movie' ? results.title : results.name,
                releaseDate: type === 'movie' ? results.release_date : results.first_air_date,
                genre: (results.genres && results.genres.length > 0 ? results.genres[0].name : ''),
                rating: results.vote_average,
                addedAt: new Date().toISOString(),
                poster_path: results.poster_path,
                original_title: type === 'movie' ? results.original_title : results.original_name,
                all_seasons: false,
                seasons: {}
            };
            if (type === 'series') {
                if (seasonNumber !== undefined) {
                    if (episodeNumber !== undefined) {
                        item.seasons[seasonNumber] = {
                            season_number: seasonNumber,
                            all_episodes: false,
                            episodes: [episodeNumber]
                        }
                    } else {
                        item.seasons[seasonNumber] = {
                            season_number: seasonNumber,
                            all_episodes: true,
                            episodes: []
                        }
                    }
                } else {
                    item.all_seasons = true;
                }
            }
            whishlist.push(item);
            writeStore('whishlist', userId, whishlist);
        }
    });
}

export async function deleteWishlist(userId: number, tmdbId: number, type?: string, seasonNumber?: number, episodeNumber?: number) {
    await runInTransaction(async ({ writeStore }) => {
        let whishlist = await getWishlist(userId);
        if (type === 'series' && (seasonNumber !== undefined || episodeNumber !== undefined)) {
            const item = whishlist.find((item: WishListItem) => item.tmdb === tmdbId && item.type === 'series');
            if (item) {
                if (seasonNumber !== undefined) {
                    if (episodeNumber !== undefined) {
                        const season = item.seasons[seasonNumber];
                        if (season) {
                            if (!season.all_episodes) {
                                season.episodes = season.episodes.filter(ep => ep !== episodeNumber);
                                if (season.episodes.length === 0) {
                                    delete item.seasons[seasonNumber];
                                }
                            }
                        }
                    } else {
                        delete item.seasons[seasonNumber];
                    }
                    if (item.seasons && Object.keys(item.seasons).length === 0) {
                        whishlist = whishlist.filter((item: WishListItem) => !(item.tmdb === tmdbId));
                    }
                }
            }
        } else {
            whishlist = whishlist.filter((item: WishListItem) => !(item.tmdb === tmdbId));
        }
        writeStore('whishlist', userId, whishlist);
    });
}