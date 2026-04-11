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
  shouldChangePassword: boolean;
  legalAccepted: boolean;
  needsInitialSetup: boolean;
}

export interface UserSettings {
  appInfo?: {
    imageTag?: string;
  };
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

export interface TmdbApiKeyTestResponse {
  ok: boolean;
  message: string;
}

const AUTH_BASE = `${API_BASE_URL}/auth`;
const SETTINGS_BASE = `${API_BASE_URL}/settings`;

async function parseJson<T>(response: Response, fallbackError = "Request failed"): Promise<T> {
  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(fallbackError);
      }

      throw new Error("Réponse invalide du serveur");
    }
  }

  if (!response.ok) {
    const errorMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : fallbackError;
    throw new Error(errorMessage);
  }

  return data as T;
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
      legalAccepted: false,
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

export async function acceptLegal() {
  const response = await fetch(`${AUTH_BASE}/accept-legal`, {
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

export async function getGlobalSettings() {
  const response = await fetch(`${SETTINGS_BASE}/global`, {
    credentials: "include",
  });
  return parseJson<{ tmdbApiKey: string }>(response);
}

export async function updateGlobalSettings(payload: { tmdbApiKey: string }) {
  const response = await fetch(`${SETTINGS_BASE}/global`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ tmdbApiKey: string }>(response);
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

export async function testTmdbApiKey(apiKey: string) {
  const response = await fetch(`${API_BASE_URL}/tmdb/test-key`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  return parseJson<TmdbApiKeyTestResponse>(response, "Clé API invalide");
}

// ─────────────────────────────────────────────────────────────────────────────
// User Management
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
}

export interface CreatedUserResponse extends User {
  generatedPassword: string;
}

export async function listUsers() {
  const response = await fetch(`${API_BASE_URL}/users`, {
    credentials: "include",
  });
  return parseJson<User[]>(response, "Impossible de charger la liste des utilisateurs");
}

export async function createUser(username: string) {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return parseJson<CreatedUserResponse>(response, "Impossible de créer l'utilisateur");
}

export async function deleteUser(userId: number) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: "DELETE",
    credentials: "include",
  });
  return parseJson<{ ok: true }>(response, "Impossible de supprimer l'utilisateur");
}

export async function resetUserPassword(userId: number) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-password`, {
    method: "POST",
    credentials: "include",
  });
  return parseJson<{ ok: true; generatedPassword: string }>(response, "Impossible de réinitialiser le mot de passe");
}
