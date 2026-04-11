export type SeriesWishlistType = "series" | "season" | "episode";

/**
 * entryId format:
 *   series  → "series_${seriesId}"
 *   season  → "season_${seriesId}_${seasonNumber}"
 *   episode → "episode_${seriesId}_${seasonNumber}_${episodeNumber}"
 */
export interface SeriesWishlistEntry {
  entryId: string;
  type: SeriesWishlistType;
  seriesId: number;
  seriesTitle: string;
  seriesPoster: string;
  year?: number;
  rating?: number;
  genre?: string;
  // season + episode
  seasonNumber?: number;
  seasonName?: string;
  // episode only
  episodeNumber?: number;
  episodeName?: string;
}

export interface SeriesWishlistStatus {
  seriesInWishlist: boolean;
  /** season numbers directly in wishlist (excludes series-level entries) */
  seasonsInWishlist: number[];
  /** episodes directly in wishlist (excludes series/season-level entries) */
  episodesInWishlist: { seasonNumber: number; episodeNumber: number }[];
}
