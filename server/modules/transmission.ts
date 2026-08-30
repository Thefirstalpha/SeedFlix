import { TransmissionSettings } from '../../common/settings';
import { TorrentDownloadItem, TorrentStatsResponse } from '../../common/torrent';
import { readStore, runInTransaction } from './db';
import { ErrorCode } from './errors';
import { messages } from './i18n';
import { getIndexerSettings } from './indexer';
import { getUser, updateUser } from './user';

const transmissionRpcPath = '/transmission/rpc';
const transmissionTimeoutMs = 8000;
const transmissionManagedTorrentsStore = 'transmission.app-torrents';

export interface ManagedTorrentEntry {
  hash: string;
  link: string;
  name: string;
  addedAt: string;
  completedNotifiedAt: string | null;
}

const transmissionStatusLabels: Record<number, string> = {
  0: 'Stopped',
  1: 'Queued to check files',
  2: 'Checking files',
  3: 'Queued to download',
  4: 'Downloading',
  5: 'Queued to seed',
  6: 'Seeding',
};

export function normalizeTorrentHash(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
}

function toManagedTorrentEntry(input: Record<string, unknown>): ManagedTorrentEntry | null {
  const hash = normalizeTorrentHash(input.hash);
  const link = String(input.link).trim();
  if (!hash || !link) {
    return null;
  }

  const name = String(input.name || '').trim();
  const addedAt = String(input.addedAt || new Date().toISOString());
  const completedNotifiedAtRaw = input.completedNotifiedAt;
  const completedNotifiedAt = completedNotifiedAtRaw ? String(completedNotifiedAtRaw) : null;

  return {
    hash,
    link,
    name,
    addedAt,
    completedNotifiedAt,
  };
}

export function getManagedTorrents(userId: number): ManagedTorrentEntry[] {
  const raw = readStore(transmissionManagedTorrentsStore, userId);
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: ManagedTorrentEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const normalized = toManagedTorrentEntry(item as Record<string, unknown>);
    if (normalized) {
      entries.push(normalized);
    }
  }

  return entries;
}

function writeManagedTorrents(userId: number, entries: ManagedTorrentEntry[]) {
  runInTransaction(({ writeStore }) => {
    writeStore(transmissionManagedTorrentsStore, userId, entries as unknown as Record<string, any>);
  });
}

export function registerManagedTorrent(userId: number, hash: string, link: string, name: string) {
  const normalizedHash = normalizeTorrentHash(hash);
  const normalizedLink = String(link ?? '').trim();
  if (!normalizedHash || !normalizedLink) {
    return;
  }

  const now = new Date().toISOString();
  const existing = getManagedTorrents(userId);
  const current = existing.find((entry) => entry.hash === normalizedHash);
  const nextEntry: ManagedTorrentEntry = {
    hash: normalizedHash,
    link: normalizedLink,
    name: String(name || current?.name || '').trim(),
    addedAt: current?.addedAt || now,
    completedNotifiedAt: current?.completedNotifiedAt || null,
  };

  const next = [...existing.filter((entry) => entry.hash !== normalizedHash), nextEntry];
  writeManagedTorrents(userId, next);
}

export function unmanageTorrentForUser(userId: number, hash: string): boolean {
  const normalizedHash = normalizeTorrentHash(hash);
  if (!normalizedHash) {
    return false;
  }

  const existing = getManagedTorrents(userId);
  const next = existing.filter((entry) => entry.hash !== normalizedHash);
  if (next.length === existing.length) {
    return false;
  }

  writeManagedTorrents(userId, next);
  return true;
}

export function markManagedTorrentCompleted(userId: number, hash: string): boolean {
  const normalizedHash = normalizeTorrentHash(hash);
  if (!normalizedHash) {
    return false;
  }

  const existing = getManagedTorrents(userId);
  let updated = false;
  const now = new Date().toISOString();
  const next = existing.map((entry) => {
    if (entry.hash !== normalizedHash || entry.completedNotifiedAt) {
      return entry;
    }
    updated = true;
    return {
      ...entry,
      completedNotifiedAt: now,
    };
  });

  if (updated) {
    writeManagedTorrents(userId, next);
  }

  return updated;
}

export async function testTransmission(settings: TransmissionSettings) {
  return await executeTransmissionRpc(settings, { method: 'session-get' });
}

async function postTransmissionRpc(
  url: URL,
  headers: Record<string, string>,
  sessionId?: string,
  payload?: any,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transmissionTimeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'X-Transmission-Session-Id': sessionId } : {}),
        ...headers,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function getTransmissionSettings(userId: number): TransmissionSettings | null {
  const raw = getUser(userId)?.settings?.transmission || null;
  if (!raw) {
    return null;
  }
  return {
    host: String(raw.host || ''),
    port: Number(raw.port || 0),
    authRequired: Boolean(raw.authRequired || false),
    username: String(raw.username || ''),
    password: String(raw.password || ''),
    moviesFolder: String(raw.moviesFolder || ''),
    seriesFolder: String(raw.seriesFolder || ''),
  };
}

export async function configureTransmission(userId: number, settings: TransmissionSettings) {
  const currentSettings = getTransmissionSettings(userId);
  let effectivePassword = settings.password;
  if (
    settings.authRequired &&
    (!settings.password ||
      settings.password.trim() === '' ||
      settings.password === '***********' ||
      settings.password.includes('•'))
  ) {
    effectivePassword = currentSettings?.password || '';
  }

  const effectiveSettings: TransmissionSettings = {
    ...settings,
    password: effectivePassword,
  };

  const response = await executeTransmissionRpc(effectiveSettings, { method: 'session-get' });
  if (!response.ok) {
    if (response.status === 401) {
      throw new ErrorCode(messages.settings.transmission.authFailed);
    } else {
      throw new ErrorCode(`${response.status} ${response.statusText}`);
    }
  }
  const user = getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.settings.transmission = effectiveSettings;
  updateUser(user);
}

function createAuthHeaders(settings: TransmissionSettings): Record<string, string> {
  if (!settings.authRequired) return {};

  if (!settings.username || !settings.password)
    throw new ErrorCode(messages.settings.transmission.authFailed);

  const credentials = Buffer.from(`${settings.username}:${settings.password}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
  };
}

async function executeTransmissionRpc(settings: TransmissionSettings, payload: any) {
  const url = buildTransmissionRpcUrl(settings);
  const headers = createAuthHeaders(settings);
  const firstResponse = await postTransmissionRpc(url, headers, undefined, payload);

  if (firstResponse.status === 409) {
    const sessionId = firstResponse.headers.get('X-Transmission-Session-Id');
    if (!sessionId) {
      throw new ErrorCode("Transmission n'a pas fourni d'identifiant de session RPC");
    }

    return postTransmissionRpc(url, headers, sessionId, payload);
  }

  return firstResponse;
}

function buildTransmissionRpcUrl(settings: TransmissionSettings): URL {
  let url;

  try {
    url = new URL(String(settings.host || '').trim());
  } catch {
    throw new ErrorCode(messages.settings.transmission.invalidUrl);
  }

  if (settings.port) {
    url.port = String(settings.port).trim();
  }

  if (!url.pathname || url.pathname === '/') {
    url.pathname = transmissionRpcPath;
  } else if (!url.pathname.endsWith(transmissionRpcPath)) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}${transmissionRpcPath}`;
  }

  url.search = '';
  return url;
}

export async function getDownloadsTransmission(
  userId: number,
  filter: Record<string, any>,
): Promise<TorrentDownloadItem[]> {
  const includeAll =
    String(filter?.includeAll || '')
      .trim()
      .toLowerCase() === 'true';
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const response = await executeTransmissionRpc(settings, {
    method: 'torrent-get',
    arguments: {
      fields: [
        'id',
        'hashString',
        'name',
        'status',
        'percentDone',
        'rateDownload',
        'rateUpload',
        'eta',
        'totalSize',
        'downloadDir',
        'addedDate',
        'isFinished',
        'leftUntilDone',
        'error',
        'errorString',
        'peersConnected',
        'uploadRatio',
        'uploadedEver',
      ],
    },
  });
  const data: any = await response.json();
  const rawTorrents = Array.isArray(data?.arguments?.torrents) ? data.arguments.torrents : [];
  const managedHashes = new Set(getManagedTorrents(userId).map((entry) => entry.hash));

  const torrents: TorrentDownloadItem[] = rawTorrents
    .map((torrent: Record<string, any>): TorrentDownloadItem => {
      const hash = normalizeTorrentHash(torrent?.hashString);
      const managedBySeedflix = Boolean(hash && managedHashes.has(hash));

      const data: TorrentDownloadItem = {
        id: torrent.id,
        hashString: torrent.hashString,
        name: torrent.name,
        status: torrent.status,
        statusLabel: transmissionStatusLabels[torrent.status] || 'Unknown',
        progress: Math.round(Number(torrent.percentDone || 0) * 1000) / 10,
        rateDownload: Number(torrent.rateDownload || 0),
        rateUpload: Number(torrent.rateUpload || 0),
        eta: Number(torrent.eta || 0),
        totalSize: Number(torrent.totalSize || 0),
        downloadDir: torrent.downloadDir,
        addedDate: torrent.addedDate,
        isFinished: Boolean(torrent.isFinished),
        leftUntilDone: Number(torrent.leftUntilDone || 0),
        peersConnected: Number(torrent.peersConnected || 0),
        error: Number(torrent.error || 0),
        errorString: torrent.errorString || '',
        managedBySeedflix,
        uploadRatio: Number(torrent.uploadRatio || 0),
        uploadedEver: Number(torrent.uploadedEver || 0),
      };
      return data;
    })
    .filter((torrent: TorrentDownloadItem) => (includeAll ? true : torrent.managedBySeedflix));
  return torrents;
}

export async function getTransmissionStats(userId: number): Promise<TorrentStatsResponse> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const response = await executeTransmissionRpc(settings, {
    method: 'session-stats',
  });
  const data: any = await response.json();
  return {
    activeTorrentCount: Number(data?.arguments?.activeTorrentCount || 0),
    pausedTorrentCount: Number(data?.arguments?.pausedTorrentCount || 0),
    torrentCount: Number(data?.arguments?.torrentCount || 0),
    downloadSpeed: Number(data?.arguments?.downloadSpeed || 0),
    uploadSpeed: Number(data?.arguments?.uploadSpeed || 0),
  };
}

export async function performTransmissionAction(
  action: string,
  userId: number,
  torrentId: number,
  extraArguments: Record<string, unknown> = {},
) {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);

  const response = await executeTransmissionRpc(settings, {
    method: action,
    arguments: {
      ids: [torrentId],
      ...extraArguments,
    },
  });

  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.result !== 'success')
    throw new ErrorCode(messages.settings.transmission.actionFailed);
}

function isMagnetLink(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .startsWith('magnet:?');
}

async function fetchTorrentMetainfo(torrentUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transmissionTimeoutMs);

  try {
    console.log(`Fetching torrent metainfo from URL: ${torrentUrl}`);
    const response = await fetch(torrentUrl, {
      headers: {
        Accept: 'application/x-bittorrent,application/octet-stream,*/*;q=0.1',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Impossible de télécharger le fichier torrent (${response.status})`);
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      throw new Error("Le lien fourni n'est pas un fichier torrent valide");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('Le fichier torrent est vide');
    }

    return buffer.toString('base64');
  } finally {
    clearTimeout(timeout);
  }
}

export async function startDownload(
  userId: number,
  guid: string,
  mediaType: string,
  options?: { tmdbId?: number | null; seasonNumber?: number | null; episodeNumber?: number | null },
) {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const downloadDir = mediaType === 'movie' ? settings.moviesFolder : settings.seriesFolder;

  const indexerSettings = getIndexerSettings(userId);
  if (!indexerSettings) throw new ErrorCode(messages.settings.failedLoadSettings);
  const url = new URL(indexerSettings.url);
  if (indexerSettings.token) url.searchParams.set('apikey', indexerSettings.token);
  url.searchParams.set('t', 'get');
  url.searchParams.set('id', guid);

  const response = await executeTransmissionRpc(settings, {
    method: 'torrent-add',
    arguments: {
      paused: false,
      'download-dir': downloadDir,
      ...(isMagnetLink(url.toString())
        ? { filename: url.toString() }
        : { metainfo: await fetchTorrentMetainfo(url.toString()) }),
    },
  });

  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.result !== 'success')
    throw new ErrorCode(messages.settings.transmission.actionFailed);

  const added =
    data?.arguments?.['torrent-added'] || data?.arguments?.['torrent-duplicate'] || null;
  const addedHash = normalizeTorrentHash(added?.hashString);
  if (addedHash) {
    registerManagedTorrent(userId, addedHash, url.toString(), String(added?.name || ''));
  }

  // Consume/cleanup wishlist and indexer results
  try {
    const { consumeWishlistItemForDownload } = await import('./wishlist');
    await consumeWishlistItemForDownload(
      userId,
      guid,
      mediaType === 'movie' ? 'movie' : 'series',
      options,
    );
  } catch (consumeErr) {
    console.error('Error consuming wishlist item on download:', consumeErr);
  }
}

export interface TransmissionSessionStats {
  altSpeedEnabled: boolean;
  altSpeedDown: number;
  altSpeedUp: number;
  speedLimitDownEnabled: boolean;
  speedLimitDown: number;
  speedLimitUpEnabled: boolean;
  speedLimitUp: number;
}

export async function getTurtleMode(userId: number): Promise<TransmissionSessionStats> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const response = await executeTransmissionRpc(settings, { method: 'session-get' });
  const data: any = await response.json().catch(() => null);
  const args = data?.arguments || {};
  return {
    altSpeedEnabled: Boolean(args['alt-speed-enabled']),
    altSpeedDown: Number(args['alt-speed-down'] || 0),
    altSpeedUp: Number(args['alt-speed-up'] || 0),
    speedLimitDownEnabled: Boolean(args['speed-limit-down-enabled']),
    speedLimitDown: Number(args['speed-limit-down'] || 0),
    speedLimitUpEnabled: Boolean(args['speed-limit-up-enabled']),
    speedLimitUp: Number(args['speed-limit-up'] || 0),
  };
}

export async function setTurtleMode(userId: number, enabled: boolean): Promise<boolean> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const response = await executeTransmissionRpc(settings, {
    method: 'session-set',
    arguments: {
      'alt-speed-enabled': Boolean(enabled),
    },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.result !== 'success') {
    throw new ErrorCode(messages.settings.transmission.actionFailed);
  }
  return Boolean(enabled);
}

export interface TorrentFileDetail {
  index: number;
  name: string;
  bytesCompleted: number;
  length: number;
  wanted: boolean;
  priority: number;
}

export async function getTorrentFiles(
  userId: number,
  torrentId: number,
): Promise<TorrentFileDetail[]> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);
  const response = await executeTransmissionRpc(settings, {
    method: 'torrent-get',
    arguments: {
      ids: [torrentId],
      fields: ['id', 'name', 'files', 'fileStats'],
    },
  });
  const data: any = await response.json().catch(() => null);
  const torrent = data?.arguments?.torrents?.[0];
  if (!torrent) {
    throw new ErrorCode('Torrent introuvable');
  }

  const files = Array.isArray(torrent.files) ? torrent.files : [];
  const fileStats = Array.isArray(torrent.fileStats) ? torrent.fileStats : [];

  return files.map((file: any, index: number) => ({
    index,
    name: String(file.name || ''),
    bytesCompleted: Number(file.bytesCompleted || 0),
    length: Number(file.length || 0),
    wanted: fileStats[index] ? Boolean(fileStats[index].wanted) : true,
    priority: fileStats[index] ? Number(fileStats[index].priority || 0) : 0,
  }));
}

export async function setTorrentFilesWanted(
  userId: number,
  torrentId: number,
  wantedIndices: number[],
  unwantedIndices: number[],
): Promise<void> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);

  const args: Record<string, any> = { ids: [torrentId] };
  if (wantedIndices.length > 0) args['files-wanted'] = wantedIndices;
  if (unwantedIndices.length > 0) args['files-unwanted'] = unwantedIndices;

  const response = await executeTransmissionRpc(settings, {
    method: 'torrent-set',
    arguments: args,
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.result !== 'success') {
    throw new ErrorCode(messages.settings.transmission.actionFailed);
  }
}

export async function moveTorrentQueue(
  userId: number,
  torrentId: number,
  action: 'up' | 'down' | 'top' | 'bottom',
): Promise<void> {
  const settings = getTransmissionSettings(userId);
  if (!settings) throw new ErrorCode(messages.settings.transmission.authFailed);

  const methodMap: Record<string, string> = {
    up: 'queue-move-up',
    down: 'queue-move-down',
    top: 'queue-move-top',
    bottom: 'queue-move-bottom',
  };

  const method = methodMap[action] || 'queue-move-up';
  const response = await executeTransmissionRpc(settings, {
    method,
    arguments: { ids: [torrentId] },
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || data?.result !== 'success') {
    throw new ErrorCode(messages.settings.transmission.actionFailed);
  }
}
