import { API_BASE_URL } from "../config/tmdb";
import type {
  SeriesWishlistEntry,
  SeriesWishlistStatus,
  SeriesWishlistType,
} from "../types/seriesWishlist";

const BASE = `${API_BASE_URL}/series-wishlist`;

export async function getSeriesWishlist(): Promise<SeriesWishlistEntry[]> {
  try {
    const response = await fetch(BASE);
    if (!response.ok) throw new Error("Failed to fetch series wishlist");
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getSeriesWishlistStatus(
  seriesId: number
): Promise<SeriesWishlistStatus> {
  try {
    const response = await fetch(`${BASE}/series/${seriesId}/status`);
    if (!response.ok) throw new Error("Failed to fetch series wishlist status");
    return await response.json();
  } catch {
    return { seriesInWishlist: false, seasonsInWishlist: [], episodesInWishlist: [] };
  }
}

export async function addToSeriesWishlist(
  entry: Omit<SeriesWishlistEntry, "entryId">
): Promise<void> {
  await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function removeFromSeriesWishlist(entryId: string): Promise<void> {
  await fetch(`${BASE}/entry/${encodeURIComponent(entryId)}`, {
    method: "DELETE",
  });
}

export async function removeMultipleFromSeriesWishlist(
  entryIds: string[]
): Promise<void> {
  await fetch(`${BASE}/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entryIds }),
  });
}

export async function getSeriesWishlistCount(): Promise<number> {
  const wishlist = await getSeriesWishlist();
  return wishlist.length;
}
