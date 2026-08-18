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

