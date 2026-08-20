import { XMLParser } from 'fast-xml-parser';
import { ErrorCode } from './errors';
import { IndexerSettings } from '../../common/settings';

const torznabTimeoutMs = 8000;

async function fetchWithTimeout(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), torznabTimeoutMs);

  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/xml, text/xml;q=0.9, */*;q=0.1',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runTorznabQuery(settings: IndexerSettings, params: Record<string, string>) {
  const url = new URL(settings.url);
  if (settings.token) url.searchParams.set('apikey', settings.token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    console.log(`Torznab request failed: ${response.status} ${response.statusText}`);
    throw new ErrorCode(`Torznab request failed: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const xmlBody = parser.parse(text);
  if (xmlBody.error) {
    throw new ErrorCode(`Torznab error: ${xmlBody.error.code} ${xmlBody.error.description}`);
  }
  return xmlBody;
}

export async function checkTorznabConnection(settings: IndexerSettings) {
  return await runTorznabQuery(settings, { t: 'search' });
}

export async function searchTorznab(
  settings: IndexerSettings,
  query?: string,
  tmdbId?: number,
  limit = 100,
  offset = 0,
) {
  let params: Record<string, string> = {
    t: 'search',
    limit: String(limit),
    offset: String(Math.max(0, Number(offset) || 0)),
  };
  if (tmdbId) params['tmdbid'] = String(tmdbId);
  if (query) params['q'] = query;
  return await runTorznabQuery(settings, params);
}

export async function rssTorznab(
  settings: IndexerSettings,
  type: 'movie' | 'tvsearch',
  limit = 100,
  offset = 0,
) {
  let params: Record<string, string> = {
    t: type,
    limit: String(limit),
    offset: String(Math.max(0, Number(offset) || 0)),
  };
  return await runTorznabQuery(settings, params);
}
