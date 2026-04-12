import { API_BASE_URL } from '../config/tmdb';

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
  hashString: string;
  managedBySeedflix?: boolean;
}

export interface TorrentDownloadsResponse {
  ok: boolean;
  torrents: TorrentDownloadItem[];
  activeCount: number;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

export async function addTorrentToClient(
  torrentUrl: string,
  mediaType: 'movie' | 'series' = 'movie',
  targetKey?: string,
) {
  const response = await fetch(`${API_BASE_URL}/torrent/add`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ torrentUrl, mediaType, targetKey }),
  });

  return parseJson<TorrentAddResponse>(response);
}

export async function getTorrentDownloads(includeAll = false) {
  const params = new URLSearchParams();
  if (includeAll) {
    params.set('includeAll', 'true');
  }

  const response = await fetch(`${API_BASE_URL}/torrent/downloads?${params.toString()}`, {
    credentials: 'include',
  });

  return parseJson<TorrentDownloadsResponse>(response);
}

export async function pauseTorrent(id: number) {
  const response = await fetch(`${API_BASE_URL}/torrent/pause`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function resumeTorrent(id: number) {
  const response = await fetch(`${API_BASE_URL}/torrent/resume`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function cleanTorrent(hash: string) {
  const response = await fetch(`${API_BASE_URL}/torrent/clean`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function unmanageTorrent(hash: string) {
  const response = await fetch(`${API_BASE_URL}/torrent/unmanage`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}
