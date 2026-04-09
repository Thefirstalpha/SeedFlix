import { API_BASE_URL } from "../config/tmdb";

export interface TrackerResultItem {
  trackerStateKey: string;
  title: string;
  link: string;
  downloadUrl?: string;
  guid?: string;
  pubDate?: string | null;
  size?: number | null;
  sizeHuman?: string | null;
  seeders?: number | null;
  leechers?: number | null;
  quality?: string | null;
  language?: string | null;
  categories?: string[];
}

export interface TrackerResultTarget {
  targetKey: string;
  targetType: "movie" | "series" | "season" | "episode" | string;
  mediaId: number | null;
  title: string;
  label: string;
  updatedAt: string;
  items: TrackerResultItem[];
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error("Empty response");
  }
  return JSON.parse(text);
}

export async function getTrackerResults(): Promise<TrackerResultTarget[]> {
  const response = await fetch(`${API_BASE_URL}/tracker-results`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tracker results: ${response.status}`);
  }

  const data = await parseJson<{ ok: boolean; targets: TrackerResultTarget[] }>(response);
  return Array.isArray(data?.targets) ? data.targets : [];
}

export async function rejectTrackerResult(targetKey: string, trackerStateKey: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tracker-results/reject`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetKey, trackerStateKey }),
  });

  if (!response.ok) {
    throw new Error(`Failed to reject tracker result: ${response.status}`);
  }
}

export async function validateTrackerResult(targetKey: string, trackerStateKey: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tracker-results/validate`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ targetKey, trackerStateKey }),
  });

  if (!response.ok) {
    throw new Error(`Failed to validate tracker result: ${response.status}`);
  }
}
