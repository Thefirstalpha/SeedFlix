import { TorrentDownloadsResponse, TorrentStatsResponse } from '../../../common/torrent';
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


async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

export async function addTorrentToClient(
  guid: string,
  mediaType: 'movie' | 'series' = 'movie'
) {
  const response = await fetch(`${API_BASE_URL}/transmission/add`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guid, mediaType }),
  });

  return parseJson<TorrentAddResponse>(response);
}

export async function getTorrentDownloads(includeAll = false): Promise<TorrentDownloadsResponse> {
  const params = new URLSearchParams();
  if (includeAll) {
    params.set('includeAll', 'true');
  }

  const response = await fetch(`${API_BASE_URL}/transmission/downloads?${params.toString()}`, {
    credentials: 'include',
  });

  return parseJson<TorrentDownloadsResponse>(response);
}
export async function getTorrentStats(): Promise<TorrentStatsResponse> {
  const response = await fetch(`${API_BASE_URL}/transmission/stats`, {
    credentials: 'include',
  });

  return parseJson<TorrentStatsResponse>(response);
}

export async function pauseTorrent(id: number) {
  const response = await fetch(`${API_BASE_URL}/transmission/pause/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function resumeTorrent(id: number) {
  const response = await fetch(`${API_BASE_URL}/transmission/resume/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    }
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function deleteTorrent(id: number, deleteData = false) {
  const response = await fetch(`${API_BASE_URL}/transmission/delete/${id}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deleteData }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export async function unmanageTorrent(hash: string) {
  const response = await fetch(`${API_BASE_URL}/transmission/unmanage`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash }),
  });

  return parseJson<{ ok: boolean; message: string }>(response);
}

export interface TurtleModeStats {
  altSpeedEnabled: boolean;
  altSpeedDown: number;
  altSpeedUp: number;
  speedLimitDownEnabled: boolean;
  speedLimitDown: number;
  speedLimitUpEnabled: boolean;
  speedLimitUp: number;
}

export async function getTurtleMode(): Promise<TurtleModeStats> {
  const response = await fetch(`${API_BASE_URL}/transmission/turtle`, {
    credentials: 'include',
  });
  return parseJson<TurtleModeStats>(response);
}

export async function setTurtleMode(enabled: boolean): Promise<{ altSpeedEnabled: boolean }> {
  const response = await fetch(`${API_BASE_URL}/transmission/turtle`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ enabled }),
  });
  return parseJson<{ altSpeedEnabled: boolean }>(response);
}

export interface TorrentFileDetail {
  index: number;
  name: string;
  bytesCompleted: number;
  length: number;
  wanted: boolean;
  priority: number;
}

export async function getTorrentFiles(torrentId: number): Promise<TorrentFileDetail[]> {
  const response = await fetch(`${API_BASE_URL}/transmission/torrent/${torrentId}/files`, {
    credentials: 'include',
  });
  const data = await parseJson<{ files: TorrentFileDetail[] }>(response);
  return data.files || [];
}

export async function setTorrentFilesWanted(
  torrentId: number,
  wanted: number[],
  unwanted: number[],
): Promise<void> {
  await fetch(`${API_BASE_URL}/transmission/torrent/${torrentId}/files`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ wanted, unwanted }),
  });
}

export async function moveTorrentQueue(
  torrentId: number,
  action: 'up' | 'down' | 'top' | 'bottom',
): Promise<void> {
  await fetch(`${API_BASE_URL}/transmission/torrent/${torrentId}/queue`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action }),
  });
}
