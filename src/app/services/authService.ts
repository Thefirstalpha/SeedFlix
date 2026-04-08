import { API_BASE_URL } from "../config/tmdb";

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthResponse {
  authenticated?: boolean;
  user?: AuthUser;
  settings?: UserSettings;
  mustChangePassword: boolean;
  mustConfigureTmdb: boolean;
  mustConfigureTorrent: boolean;
  mustConfigureIndexer: boolean;
  needsInitialSetup: boolean;
}

export interface UserSettings {
  profile: {
    username: string;
  };
  security: {
    lastPasswordChangeAt?: string;
  };
  apiKeys?: {
    tmdb?: string;
  };
  placeholders: {
    notifications?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    torrent?: {
      url?: string;
      port?: string;
      authRequired?: boolean;
      username?: string;
      password?: string;
      moviesFolder?: string;
      seriesFolder?: string;
    };
    indexer?: {
      url?: string;
      token?: string;
      defaultQuality?: string;
    };
  };
}

export interface IndexerTestResponse {
  ok: boolean;
  message: string;
  endpoint?: string;
}

export interface TorrentTestResponse {
  ok: boolean;
  message: string;
  endpoint?: string;
}

const AUTH_BASE = `${API_BASE_URL}/auth`;
const SETTINGS_BASE = `${API_BASE_URL}/settings`;

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export async function getCurrentAuth(): Promise<AuthResponse> {
  try {
    const response = await fetch(`${AUTH_BASE}/me`, {
      credentials: "include",
    });
    return await parseJson<AuthResponse>(response);
  } catch {
    return {
      authenticated: false,
      mustChangePassword: false,
      mustConfigureTmdb: false,
      mustConfigureTorrent: false,
      mustConfigureIndexer: false,
      needsInitialSetup: false,
    };
  }
}

export async function login(username: string, password: string) {
  const response = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJson<AuthResponse>(response);
}

export async function logout() {
  const response = await fetch(`${AUTH_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson<{ ok: true }>(response);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await fetch(`${AUTH_BASE}/change-password`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return parseJson<{ ok: true }>(response);
}

export async function getSettings() {
  const response = await fetch(SETTINGS_BASE, {
    credentials: "include",
  });
  return parseJson<UserSettings>(response);
}

export async function updateSettings(settings: UserSettings) {
  const response = await fetch(SETTINGS_BASE, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return parseJson<UserSettings>(response);
}

export async function resetSettings() {
  const response = await fetch(`${SETTINGS_BASE}/reset`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson<{ ok: true; loggedOut: true }>(response);
}

export async function testIndexerConnection(url: string, token: string) {
  const response = await fetch(`${API_BASE_URL}/indexer/test`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, token }),
  });
  return parseJson<IndexerTestResponse>(response);
}

export async function testTorrentConnection(payload: {
  url: string;
  port: string;
  authRequired: boolean;
  username: string;
  password: string;
}) {
  const response = await fetch(`${API_BASE_URL}/torrent/test`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<TorrentTestResponse>(response);
}
