import { API_BASE_URL } from "../config/tmdb";

export interface AuthUser {
  id: number;
  username: string;
}

export interface UserSettings {
  profile: {
    username: string;
  };
  security: {
    lastPasswordChangeAt?: string;
  };
  placeholders: {
    notifications?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    torrent?: {
      url?: string;
      port?: string;
      authRequired?: boolean;
      username?: string;
      moviesFolder?: string;
      seriesFolder?: string;
    };
    indexer?: {
      url?: string;
      token?: string;
    };
  };
}

interface AuthMeResponse {
  authenticated: boolean;
  user?: AuthUser;
  settings?: UserSettings;
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

export async function getCurrentAuth(): Promise<AuthMeResponse> {
  try {
    const response = await fetch(`${AUTH_BASE}/me`, {
      credentials: "include",
    });
    return await parseJson<AuthMeResponse>(response);
  } catch {
    return { authenticated: false };
  }
}

export async function login(username: string, password: string) {
  const response = await fetch(`${AUTH_BASE}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return parseJson<{ user: AuthUser; settings: UserSettings }>(response);
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
