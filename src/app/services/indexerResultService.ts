import { IndexerMovieResult, IndexerSeriesResult } from '../../../common/indexer';
import { API_BASE_URL } from '../config/tmdb';

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

export async function getIndexerMovieResults(): Promise<IndexerMovieResult[]> {
  const response = await fetch(`${API_BASE_URL}/indexer/results/movies`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch indexer results: ${response.status}`);
  }

  const data = await parseJson<{ ok: boolean; items: IndexerMovieResult[] }>(response);
  return Array.isArray(data?.items) ? data.items : [];
}

export async function getIndexerSeriesResults(): Promise<IndexerSeriesResult[]> {
  const response = await fetch(`${API_BASE_URL}/indexer/results/series`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch indexer results: ${response.status}`);
  }

  const data = await parseJson<{ ok: boolean; items: IndexerSeriesResult[] }>(response);
  return Array.isArray(data?.items) ? data.items : [];
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
  type: 'movie' | 'series',
  guid: string,
  key: string,
): Promise<void> {
  await postIndexerAction(
    '/indexer/results/validate',
    { type, guid, key },
    'Failed to validate indexer result',
  );
}
