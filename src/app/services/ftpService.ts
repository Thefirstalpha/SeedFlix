// Service pour la gestion du stockage FTP côté frontend

export interface FtpConfig {
    host: string;
    port: number;
    secure: boolean;
    authRequired: boolean;
    username?: string;
    rootFolder: string;
    storageLimit: number | null;
}

export interface FtpFileInfo {
    name: string;
    type: number; // 0=file, 1=directory, 2=symlink, -1=unknown
    size: number;
    rawModifiedAt: string;
    isDirectory: boolean;
    isFile: boolean;
    isSymbolicLink: boolean;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export async function getFtpConfig(): Promise<FtpConfig | null> {
    const res = await fetch('/api/ftp/config');
    if (!res.ok) throw new Error('Erreur récupération config FTP');
    const data = await res.json();
    return data.config ?? null;
}

export async function saveFtpConfig(config: Partial<FtpConfig> & { password?: string }) {
    const res = await fetch('/api/ftp/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur sauvegarde config FTP');
    return data;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export async function listDirectory(path: string): Promise<FtpFileInfo[]> {
    const res = await fetch(`/api/ftp/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Erreur listing FTP');
    const data = await res.json();
    return data.items;
}

// ─── Gestion des fichiers ─────────────────────────────────────────────────────

export async function makeDirectory(path: string): Promise<void> {
    const res = await fetch('/api/ftp/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error('Erreur création dossier FTP');
}

export async function deleteFile(path: string): Promise<void> {
    const res = await fetch('/api/ftp/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error('Erreur suppression fichier FTP');
}

export async function deleteDirectory(path: string): Promise<void> {
    const res = await fetch('/api/ftp/directory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
    });
    if (!res.ok) throw new Error('Erreur suppression dossier FTP');
}

export async function deleteBatch(items: { path: string; isDirectory: boolean }[]): Promise<{ failed: { path: string; error: string }[] }> {
    const res = await fetch('/api/ftp/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur suppression groupée FTP');
    return data;
}

export async function renameItem(oldPath: string, newPath: string): Promise<void> {
    const res = await fetch('/api/ftp/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
    });
    if (!res.ok) throw new Error('Erreur renommage FTP');
}

export async function moveItems(paths: string[], destinationDir: string): Promise<{ failed: { path: string; error: string }[] }> {
    const res = await fetch('/api/ftp/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths, destinationDir }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erreur déplacement FTP');
    return data;
}

// ─── Transfert ────────────────────────────────────────────────────────────────

export function getDownloadUrl(path: string): string {
    return `/api/ftp/download?path=${encodeURIComponent(path)}`;
}

export function getStreamUrl(path: string): string {
    return `/api/ftp/stream?path=${encodeURIComponent(path)}`;
}

export function getTranscodeUrl(path: string, options?: { startTime?: number; force?: boolean }): string {
    const params = new URLSearchParams({ path });
    if (options?.startTime && options.startTime > 0) {
        params.set('startTime', String(options.startTime));
    }
    if (options?.force) {
        params.set('force', 'true');
    }
    return `/api/ftp/transcode?${params.toString()}`;
}

export function getM3uPlaylistUrl(path: string): string {
    return `/api/ftp/playlist.m3u?path=${encodeURIComponent(path)}`;
}

export type FtpMediaType = 'video' | 'audio' | 'image' | 'text' | null;

export function isDirectPlayableVideo(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return ['mp4', 'webm', 'm4v'].includes(ext);
}

export function getFtpMediaType(filename: string): FtpMediaType {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (['mp4', 'mkv', 'webm', 'ogv', 'mov', 'm4v', 'avi', 'ts'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) return 'audio';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (['txt', 'log', 'json', 'srt', 'vtt', 'nfo', 'md'].includes(ext)) return 'text';
    return null;
}

export async function uploadFile(remotePath: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/ftp/upload?path=${encodeURIComponent(remotePath)}`);
        if (onProgress) {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
            };
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload échoué: ${xhr.statusText}`)));
        xhr.onerror = () => reject(new Error('Erreur réseau lors de l\'upload FTP'));
        xhr.send(file);
    });
}

// ─── Stockage ─────────────────────────────────────────────────────────────────

export async function getStorageUsage(): Promise<{ used: number; limit: number | null }> {
    const res = await fetch('/api/ftp/storage');
    if (!res.ok) throw new Error('Erreur récupération utilisation stockage FTP');
    const data = await res.json();
    return { used: data.used, limit: data.limit };
}

export async function getFileInfo(path: string): Promise<{ size: number | null; lastModified: string | null }> {
    const res = await fetch(`/api/ftp/info?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error('Erreur récupération info fichier FTP');
    return await res.json();
}


