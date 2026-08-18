
export interface IndexerMovieResponse {
  ok: boolean;
  items: IndexerMovieResult[];
}

export interface IndexerSeriesResponse {
  ok: boolean;
  items: IndexerSeriesResult[];
}


export interface IndexerMovieResult {
  title: string;
  link: string;
  downloadUrl?: string;
  tmdbId?: string | null;
  guid: string;
  pubDate?: string;
  size?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
}


export interface IndexerSeriesResult {
  title: string;
  link: string;
  downloadUrl?: string;
  tmdbId?: string | null;
  guid: string;
  pubDate?: string;
  size?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
  attributes?: Record<string, string>;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}