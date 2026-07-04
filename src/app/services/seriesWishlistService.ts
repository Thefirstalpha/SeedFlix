import { WishListItem } from '../../../common/wishlist';
import { API_BASE_URL } from '../config/tmdb';
import type { SeriesWishlistEntry, SeriesWishlistStatus } from '../types/seriesWishlist';

const BASE = `${API_BASE_URL}/wishlist`;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Request failed');
  }
  return response.json() as Promise<T>;
}

async function sendJson(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<void> {
  await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function addToWishlist(tmdbId: number, season?: number, episode?: number): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'series',
      tmdbId: tmdbId,
      season: season,
      episode: episode,
    }),
  });
}

export async function removeFromWishlist(tmdbId: number, season?: number, episode?: number): Promise<void> {
  await fetch(`${API_BASE_URL}/wishlist`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'series',
      tmdbId: tmdbId,
      season: season,
      episode: episode,
    }),
  });
}

export async function getSeriesWishlist(): Promise<WishListItem[]> {
  try {
    const data = await fetchJson<unknown>(BASE);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getSeriesWishlistStatus(seriesId: number): Promise<WishListItem | undefined> {
  try {
    const data = await fetchJson<any>(`${BASE}/${seriesId}`);
    if (data && typeof data === 'object' && 'exists' in data && typeof data.exists === 'boolean') {
      return data.exists && 'content' in data ? (data.content as WishListItem) : undefined;
    }
  } catch {
    return undefined;
  }
}


export async function getSeriesWishlistCount(): Promise<number> {
  const wishlist = await getSeriesWishlist();
  return new Set(wishlist.map((entry) => entry.seriesId)).size;
}
