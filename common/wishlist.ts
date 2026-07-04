export interface WishListSeasonItem {
  season_number: number;
  all_episodes: boolean;
  episodes: number[];
}

export interface WishListItem {
  tmdb: number;
  type: 'movie' | 'series';
  title: string;
  releaseDate: string;
  genre: string;
  rating: number;
  addedAt: string;
  poster_path: string | null;
  original_title: string;
  all_seasons: boolean;
  seasons: Record<number, WishListSeasonItem>;
}
