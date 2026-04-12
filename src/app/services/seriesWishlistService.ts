import { API_BASE_URL } from '../config/tmdb';
import type { SeriesWishlistEntry, SeriesWishlistStatus } from '../types/seriesWishlist';

const BASE = `${API_BASE_URL}/series-wishlist`;

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

export async function getSeriesWishlist(): Promise<SeriesWishlistEntry[]> {
  try {
    const data = await fetchJson<unknown>(BASE);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getSeriesWishlistStatus(seriesId: number): Promise<SeriesWishlistStatus> {
  try {
    return await fetchJson<SeriesWishlistStatus>(`${BASE}/series/${seriesId}/status`);
  } catch {
    return { seriesInWishlist: false, seasonsInWishlist: [], episodesInWishlist: [] };
  }
}

export async function addToSeriesWishlist(
  entry: Omit<SeriesWishlistEntry, 'entryId'>,
): Promise<void> {
  await sendJson(BASE, 'POST', entry);
}

export async function removeFromSeriesWishlist(entryId: string): Promise<void> {
  await sendJson(`${BASE}/entry/${encodeURIComponent(entryId)}`, 'DELETE');
}

export async function removeMultipleFromSeriesWishlist(entryIds: string[]): Promise<void> {
  await sendJson(`${BASE}/bulk`, 'DELETE', { entryIds });
}

export async function getSeriesWishlistCount(): Promise<number> {
  const wishlist = await getSeriesWishlist();
  return new Set(wishlist.map((entry) => entry.seriesId)).size;
}
