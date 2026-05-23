import { IndexerMovieResponse, IndexerMovieResult, IndexerSeriesResult } from "../../common/indexer";
import { IndexerSettings } from "../../common/settings";
import { runInTransaction } from "./db";
import { ErrorCode } from "./errors";
import { buildDetailsRequest, proxyTmdb, TmdbType } from "./tmdb";
import { checkTorznabConnection, searchTorznab } from "./torznab";
import { getUser } from "./user";

// Enum of quality options
const QUALITY_MAP: Record<string, string> = {
    '.2160p.': '2160p',
    '.1080p.': '1080p',
    '.720p.': '720p',
    '.480p.': '480p',
    '.sd.': '480p',
};

const SOURCE_MAP: Record<string, string> = {
    '.web-dl.': 'WEB',
    '.webrip.': 'WEBRip',
    '.hdrip.': 'HDRip',
    '.bdrip.': 'BDRip',
    '.dvdrip.': 'DVDRip',
    '.hdtv.': 'HDTV',
    '.sdtv.': 'SDTV',
    '.bluray.': 'BluRay',
    '.web.': 'WEB',
};

const LANGUAGE_MAP: Record<string, string> = {
    '.vff.': 'VFF',
    '.vf2.': 'VF2',
    '.vfq.': 'VFQ',
    '.vostfr.': 'VOSTFR',
    '.truefrench.': 'VFF',
    '.multi.': 'MULTI',
};

export function extractQuality(title: string): string | null {
    const normalized = String(title || '').toLowerCase();
    for (const option in QUALITY_MAP) {
        if (normalized.includes(option.toLowerCase())) {
            return QUALITY_MAP[option];
        }
    }
    return null;
}

export function extractSource(title: string): string | null {
    const normalized = String(title || '').toLowerCase();
    for (const option in SOURCE_MAP) {
        if (normalized.includes(option.toLowerCase())) {
            return SOURCE_MAP[option];
        }
    }
    return null;
}

export function extractLanguage(title: string): string | null {
    const normalized = String(title || '').toLowerCase();
    for (const option in LANGUAGE_MAP) {
        if (normalized.includes(option.toLowerCase())) {
            return LANGUAGE_MAP[option];
        }
    }
    return null;
}

export function extractSeasonNumber(title: string): number | null {
    const normalized = String(title || '').toLowerCase();
    const seasonMatch = normalized.match(/\.s(\d{1,2})\./);
    if (seasonMatch && seasonMatch[1]) {
        return Number(seasonMatch[1].padStart(2, '0'));
    }
    return null;
}

export function extractEpisodeNumber(title: string): number | null {
    const normalized = String(title || '').toLowerCase();
    const episodeMatch = normalized.match(/\.e(\d{1,2})\./);
    if (episodeMatch && episodeMatch[1]) {
        return Number(episodeMatch[1].padStart(2, '0'));
    }
    return null;
}


export function getIndexerSettings(userId: number): IndexerSettings | null {
    const raw = getUser(userId)?.settings?.indexer || null;
    if (!raw) {
        return null;
    }
    return {
        url: String(raw.url || ''),
        token: raw.token !== undefined && raw.token !== null ? String(raw.token) : null,
        qualities: Array.isArray(raw.qualities) ? raw.qualities.map(String) : [],
        languages: Array.isArray(raw.languages) ? raw.languages.map(String) : [],
    };
}


export async function configureIndexer(userId: number, settings: IndexerSettings) {
    await checkTorznabConnection(settings).catch((error) => {
        throw new ErrorCode(`Failed to connect to Indexer: ${error.message}`);
    });
    return runInTransaction(async ({ writeStore }) => {
        const user = getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        user.settings.indexer = settings;
        await writeStore('user', userId, user);
    });
}

async function parseMovieIndexerResponse(xmlBody: any): Promise<IndexerMovieResult[]> {
    if (!xmlBody.rss || !xmlBody.rss.channel) {
        throw new ErrorCode('Invalid Indexer response format');
    }

    const itemBlocks = xmlBody.rss?.channel?.item || [];

    let results: IndexerMovieResult[] = [];

    for (const block of itemBlocks) {
        const title = block?.title;
        const link = block?.link;
        const guidMatch = block?.guid;
        const pubDateMatch = block?.pubDate;
        const attributes = block['torznab:attr'].reduce((acc, item) => {
            acc[item.name] = item.value;
            return acc;
        }, {});

        results.push({
            title: typeof title === 'string' ? title : '',
            link: typeof link === 'string' ? link : '',
            guid: typeof guidMatch === 'string' ? guidMatch : undefined,
            pubDate: typeof pubDateMatch === 'string' ? pubDateMatch : undefined,
            tmdbId: attributes.tmdbid || undefined,
            size: attributes.size ? Number(attributes.size) : undefined,
            sizeHuman: attributes.size ? humanFileSize(Number(attributes.size)) : undefined,
            seeders: attributes.seeders ? Number(attributes.seeders) : undefined,
            leechers: attributes.leechers ? Number(attributes.leechers) : undefined,
            quality: attributes.quality || extractQuality(title) || undefined,
            language: attributes.language || extractLanguage(title) || undefined,
            categories: attributes.categories ? String(attributes.categories).split(',').map(s => s.trim()) : undefined,
        });
    }

    return results;
}


async function parseSeriesIndexerResponse(xmlBody: any): Promise<IndexerSeriesResult[]> {
    if (!xmlBody.rss || !xmlBody.rss.channel) {
        throw new ErrorCode('Invalid Indexer response format');
    }

    const itemBlocks = xmlBody.rss?.channel?.item || [];

    let results: IndexerSeriesResult[] = [];

    for (const block of itemBlocks) {
        const title = block?.title;
        const link = block?.link;
        const guidMatch = block?.guid;
        const pubDateMatch = block?.pubDate;
        const attributes = block['torznab:attr'].reduce((acc, item) => {
            acc[item.name] = item.value;
            return acc;
        }, {});

        results.push({
            title: typeof title === 'string' ? title : '',
            link: typeof link === 'string' ? link : '',
            guid: typeof guidMatch === 'string' ? guidMatch : undefined,
            pubDate: typeof pubDateMatch === 'string' ? pubDateMatch : undefined,
            tmdbId: attributes.tmdbid || undefined,
            size: attributes.size ? Number(attributes.size) : undefined,
            sizeHuman: attributes.size ? humanFileSize(Number(attributes.size)) : undefined,
            seeders: attributes.seeders ? Number(attributes.seeders) : undefined,
            leechers: attributes.leechers ? Number(attributes.leechers) : undefined,
            quality: attributes.quality || extractQuality(title) || undefined,
            language: attributes.language || extractLanguage(title) || undefined,
            categories: attributes.categories ? String(attributes.categories).split(',').map(s => s.trim()) : undefined,
            seasonNumber: attributes.season ? Number(attributes.season) : extractSeasonNumber(title) || undefined,
            episodeNumber: attributes.episode ? Number(attributes.episode) : extractEpisodeNumber(title) || undefined,
        });
    }

    return results;
}

function humanFileSize(size: number): string {
    const i = size === 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
    const humanSize = Number((size / Math.pow(1024, i)).toFixed(2));
    const unit = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][i];
    return `${humanSize} ${unit}`;
}


export async function searchMovieIndexer(userId: number, movieId: number, limit = 100, offset = 0): Promise<IndexerMovieResult[]> {
    const settings = getIndexerSettings(userId);
    if (!settings) {
        throw new ErrorCode('Indexer settings not found');
    }

    const request = buildDetailsRequest(TmdbType.movie, movieId, {});
    const movie = await proxyTmdb(request.path, request.query);
    if (!movie || !movie.id) {
        throw new ErrorCode('Movie not found in TMDB');
    }
    const name = movie.original_title || movie.title;
    const response = await searchTorznab(settings, name, movieId, limit, offset);
    return await parseMovieIndexerResponse(response);
}


export async function searchSeriesIndexer(userId: number, seriesId: number, limit = 100, offset = 0, season?: number): Promise<IndexerSeriesResult[]> {
    const settings = getIndexerSettings(userId);
    if (!settings) {
        throw new ErrorCode('Indexer settings not found');
    }

    const request = buildDetailsRequest(TmdbType.series, seriesId, {});
    const series = await proxyTmdb(request.path, request.query);
    if (!series || !series.id) {
        throw new ErrorCode('Series not found in TMDB');
    }
    let name = series.original_name || series.name;
    if (season !== undefined)
        name = name.concat(` S${String(season).padStart(2, '0')}`);

    const response = await searchTorznab(settings, name, seriesId, limit, offset);
    return await parseSeriesIndexerResponse(response);
}