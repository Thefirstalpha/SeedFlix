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

export async function rejectIndexerResult(guid: string): Promise<void> {
  if (!guid) return;
  await postIndexerAction(
    '/indexer/results/reject',
    { guid },
    'Failed to reject indexer result',
  );
}

export async function rejectAllIndexerResults(guids: string[]): Promise<void> {
  if (!Array.isArray(guids) || guids.length === 0) {
    return;
  }

  await postIndexerAction(
    '/indexer/results/reject-all',
    { guids },
    'Failed to reject all indexer results',
  );
}

export async function validateIndexerResult(
  guid: string,
): Promise<void> {
  await rejectIndexerResult(guid);
}
