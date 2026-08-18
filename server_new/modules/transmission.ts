import { TransmissionSettings } from "../../common/settings";
import { TorrentDownloadItem } from "../../common/torrent";
import { runInTransaction } from "./db";
import { ErrorCode } from "./errors";
import { messages } from "./i18n";
import { getIndexerSettings } from "./indexer";
import { getUser } from "./user";

const transmissionRpcPath = '/transmission/rpc';
const transmissionTimeoutMs = 8000;

const transmissionStatusLabels: Record<number, string> = {
    0: 'Stopped',
    1: 'Queued to check files',
    2: 'Checking files',
    3: 'Queued to download',
    4: 'Downloading',
    5: 'Queued to seed',
    6: 'Seeding',
};



async function postTransmissionRpc(url: URL, headers: Record<string, string>, sessionId: string | undefined, body: any) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), transmissionTimeoutMs);

    try {
        return await fetch(url, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...headers,
                ...(sessionId ? { 'X-Transmission-Session-Id': sessionId } : {}),
            },
            body: JSON.stringify(body),
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
    const response = await executeTransmissionRpc(settings, { method: 'session-get' });
    if (!response.ok) {
        if (response.status === 401) {
            throw new ErrorCode(messages.settings.transmission.authFailed);
        } else {
            throw new ErrorCode(`${response.status} ${response.statusText}`);
        }
    }
    return runInTransaction(async ({ writeStore }) => {
        const user = getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        user.settings.transmission = settings;
        await writeStore('user', userId, user);
    });
}


function createAuthHeaders(settings: TransmissionSettings): Record<string, string> {
    if (!settings.authRequired)
        return {};

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


export async function getDownloadsTransmission(userId: number, filter: Record<string, any>): Promise<TorrentDownloadItem[]> {

    const includeAll =
        String(filter?.includeAll || '')
            .trim()
            .toLowerCase() === 'true';
    const settings = getTransmissionSettings(userId);
    if (!settings)
        throw new ErrorCode(messages.settings.transmission.authFailed);
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
            ],
        },
    });
    const data = await response.json();
    const rawTorrents = Array.isArray(data?.arguments?.torrents) ? data.arguments.torrents : [];

    const torrents: TorrentDownloadItem[] = rawTorrents
        .map((torrent: Record<string, any>): TorrentDownloadItem => {
            //const hash = String(torrent?.hashString || '')
            //  .trim()
            //  .toLowerCase();
            //const managedBySeedflix = Boolean(hash && allowedHashes.has(hash));
            const managedBySeedflix = true;

            const data: TorrentDownloadItem = {
                id: torrent.id,
                hashString: torrent.hashString,
                name: torrent.name,
                status: torrent.status,
                statusLabel: transmissionStatusLabels[torrent.status] || 'Unknown',
                progress: Math.round(Number(torrent.percentDone || 0) * 1000) / 10,
                rateDownload: Number(torrent.rateDownload || 0),
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
            };
            return data;
        })
        .filter((torrent: TorrentDownloadItem) => (includeAll ? true : torrent.managedBySeedflix));
    return torrents;
};


export async function performTransmissionAction(action: string, userId: number, torrentId: number) {
    const settings = getTransmissionSettings(userId);
    if (!settings)
        throw new ErrorCode(messages.settings.transmission.authFailed);

    const response = await executeTransmissionRpc(settings, {
        method: action,
        arguments: {
            ids: [torrentId],
        },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.result !== 'success')
        throw new ErrorCode(messages.settings.transmission.actionFailed);


};

function isMagnetLink(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .startsWith('magnet:?');
}

async function fetchTorrentMetainfo(torrentUrl) {
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

export async function startDownload(userId: number, guid: string, mediaType: string) {
    const settings = getTransmissionSettings(userId);
    if (!settings)
        throw new ErrorCode(messages.settings.transmission.authFailed);
    const downloadDir = mediaType === 'movie' ? settings.moviesFolder : settings.seriesFolder;
    
    const indexerSettings = getIndexerSettings(userId);
    if (!indexerSettings)
        throw new ErrorCode(messages.settings.failedLoadSettings);
    const url = new URL(indexerSettings.url);
    if(indexerSettings.token)
        url.searchParams.set('apikey', indexerSettings.token);
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

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.result !== 'success')
        throw new ErrorCode(messages.settings.transmission.actionFailed);


};