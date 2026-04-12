import { API_BASE_URL } from '../config/tmdb';

export interface IndexerResultItem {
  indexerStateKey: string;
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

export interface IndexerResultTarget {
  targetKey: string;
  targetType: 'movie' | 'series' | 'season' | 'episode' | string;
  mediaId: number | null;
  title: string;
  label: string;
  updatedAt: string;
  items: IndexerResultItem[];
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response');
  }
  return JSON.parse(text);
}

async function postIndexerAction(
  path: string,
  payload: Record<string, unknown>,
  fallbackError: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`${fallbackError}: ${response.status}`);
  }
}

export async function getIndexerResults(): Promise<IndexerResultTarget[]> {
  const response = await fetch(`${API_BASE_URL}/indexer-results`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch indexer results: ${response.status}`);
  }

  const data = await parseJson<{ ok: boolean; targets: IndexerResultTarget[] }>(response);
  return Array.isArray(data?.targets) ? data.targets : [];
}

export async function rejectIndexerResult(
  targetKey: string,
  indexerStateKey: string,
): Promise<void> {
  await postIndexerAction(
    '/indexer-results/reject',
    { targetKey, indexerStateKey },
    'Failed to reject indexer result',
  );
}

export async function rejectAllIndexerResults(
  targetKey: string,
  indexerStateKeys: string[],
): Promise<void> {
  if (!Array.isArray(indexerStateKeys) || indexerStateKeys.length === 0) {
    return;
  }

  await postIndexerAction(
    '/indexer-results/reject-all',
    { targetKey, indexerStateKeys },
    'Failed to reject all indexer results',
  );
}

export async function validateIndexerResult(
  targetKey: string,
  indexerStateKey: string,
): Promise<void> {
  await postIndexerAction(
    '/indexer-results/validate',
    { targetKey, indexerStateKey },
    'Failed to validate indexer result',
  );
}
