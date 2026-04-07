import { API_BASE_URL } from "../config/tmdb";

export interface TorrentAddResponse {
  ok: boolean;
  message: string;
  duplicate?: boolean;
  torrent?: {
    id?: number;
    name?: string;
    hashString?: string;
  } | null;
}

export interface TorrentDownloadItem {
  id: number;
  name: string;
  status: number;
  statusLabel: string;
  progress: number;
  rateDownload: number;
  eta: number;
  totalSize: number;
  downloadDir: string;
  addedDate: number;
  isFinished: boolean;
  leftUntilDone: number;
  peersConnected: number;
  error: number;
  errorString: string;
}

export interface TorrentDownloadsResponse {
  ok: boolean;
  torrents: TorrentDownloadItem[];
  activeCount: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export async function addTorrentToClient(
  torrentUrl: string,
  mediaType: "movie" | "series" = "movie"
) {
  const response = await fetch(`${API_BASE_URL}/torrent/add`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ torrentUrl, mediaType }),
  });

  return parseJson<TorrentAddResponse>(response);
}

export async function getTorrentDownloads() {
  const response = await fetch(`${API_BASE_URL}/torrent/downloads`, {
    credentials: "include",
  });

  return parseJson<TorrentDownloadsResponse>(response);
}
