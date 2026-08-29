import { Client, FileInfo } from 'basic-ftp';
import { Readable, Writable } from 'node:stream';
import { FtpSettings } from '../../common/settings';
import { runInTransaction } from './db';
import { getUser, updateUser } from './user';

// ─── Configuration ───────────────────────────────────────────────────────────

export async function configureFtp(userId: number, settings: FtpSettings) {
  const user = getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }
  user.settings.ftp = settings;
  updateUser(user);
}

export function getFtpSettings(userId: number): FtpSettings {
  const user = getUser(userId);
  if (!user) throw new Error('User not found');
  if (!user.settings.ftp) throw new Error('FTP non configuré');
  return user.settings.ftp;
}

// ─── Client helper ───────────────────────────────────────────────────────────

async function createClient(settings: FtpSettings): Promise<Client> {
  const client = new Client();
  client.ftp.verbose = false;
  await client.access({
    host: settings.host,
    port: settings.port || 21,
    user: settings.authRequired ? settings.username || '' : 'anonymous',
    password: settings.authRequired ? settings.password || '' : 'anonymous@',
    secure: settings.secure ?? false,
  });
  return client;
}

async function withClient<T>(
  userId: number,
  fn: (client: Client, settings: FtpSettings) => Promise<T>,
): Promise<T> {
  const settings = getFtpSettings(userId);
  const client = await createClient(settings);
  try {
    return await fn(client, settings);
  } finally {
    client.close();
  }
}

// ─── Operations ──────────────────────────────────────────────────────────────

/** Teste la connexion avec des settings fournis directement (non sauvegardés). */
export async function testFtpConnectionWithSettings(
  settings: FtpSettings,
): Promise<{ ok: boolean; error?: string }> {
  const client = await createClient(settings).catch((err: any) => {
    throw err;
  });
  try {
    await client.list(settings.rootFolder || '/');
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  } finally {
    client.close();
  }
}

/** Teste la connexion avec la configuration enregistrée. */
export async function testFtpConnection(userId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await withClient(userId, async (client, settings) => {
      await client.list(settings.rootFolder || '/');
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/** Liste le contenu d'un répertoire distant. */
export async function listDirectory(userId: number, remotePath: string): Promise<FileInfo[]> {
  return withClient(userId, (client) => client.list(remotePath));
}

/** Crée un répertoire distant (récursif). */
export async function makeDirectory(userId: number, remotePath: string): Promise<void> {
  await withClient(userId, (client) => client.ensureDir(remotePath));
}

/** Supprime un fichier distant. */
export async function removeFile(userId: number, remotePath: string): Promise<void> {
  await withClient(userId, (client) => client.remove(remotePath));
}

/** Supprime un répertoire distant (récursif). */
export async function removeDirectory(userId: number, remotePath: string): Promise<void> {
  await withClient(userId, (client) => client.removeDir(remotePath));
}

/** Supprime plusieurs éléments en réutilisant une seule connexion. */
export async function removeBatch(
  userId: number,
  items: { path: string; isDirectory: boolean }[],
): Promise<{ failed: { path: string; error: string }[] }> {
  const failed: { path: string; error: string }[] = [];
  await withClient(userId, async (client) => {
    for (const item of items) {
      try {
        if (item.isDirectory) {
          await client.removeDir(item.path);
        } else {
          await client.remove(item.path);
        }
      } catch (err: any) {
        failed.push({ path: item.path, error: err.message });
      }
    }
  });
  return { failed };
}

/** Renomme ou déplace un élément. */
export async function rename(userId: number, oldPath: string, newPath: string): Promise<void> {
  await withClient(userId, (client) => client.rename(oldPath, newPath));
}

/** Déplace plusieurs éléments vers un dossier destination en réutilisant une seule connexion. */
export async function moveBatch(
  userId: number,
  sourcePaths: string[],
  destinationDir: string,
): Promise<{ failed: { path: string; error: string }[] }> {
  const failed: { path: string; error: string }[] = [];
  const dest = destinationDir.endsWith('/') ? destinationDir : `${destinationDir}/`;
  await withClient(userId, async (client) => {
    for (const src of sourcePaths) {
      const basename = src.split('/').findLast(Boolean) ?? src;
      const target = `${dest}${basename}`;
      try {
        await client.rename(src, target);
      } catch (err: any) {
        failed.push({ path: src, error: err.message });
      }
    }
  });
  return { failed };
}

/** Retourne la taille d'un fichier distant en octets. */
export async function getFileSize(userId: number, remotePath: string): Promise<number> {
  return withClient(userId, (client) => client.size(remotePath));
}

/** Retourne la date de modification d'un fichier distant. */
export async function getLastModified(userId: number, remotePath: string): Promise<Date> {
  return withClient(userId, (client) => client.lastMod(remotePath));
}

/** Télécharge un fichier distant vers un stream de sortie. */
export async function downloadToStream(
  userId: number,
  remotePath: string,
  dest: Writable,
): Promise<void> {
  await withClient(userId, (client) => client.downloadTo(dest, remotePath));
}

/** Upload depuis un stream vers un chemin distant. */
export async function uploadFromStream(
  userId: number,
  source: Readable,
  remotePath: string,
): Promise<void> {
  await withClient(userId, (client) => client.uploadFrom(source, remotePath));
}

/** Retourne l'utilisation disque du dossier racine (en octets). */
export async function getStorageUsage(
  userId: number,
): Promise<{ used: number; limit: number | null }> {
  const settings = getFtpSettings(userId);
  const rootFolder = settings.rootFolder || '/';

  async function sumDir(client: Client, path: string): Promise<number> {
    const items = await client.list(path);
    let total = 0;
    for (const item of items) {
      if (item.isDirectory) {
        total += await sumDir(client, `${path}/${item.name}`);
      } else {
        total += item.size ?? 0;
      }
    }
    return total;
  }

  const used = await withClient(userId, (client) => sumDir(client, rootFolder));
  return {
    used,
    limit:
      settings.storageLimit !== null ? (settings.storageLimit ?? 0) * 1024 * 1024 * 1024 : null,
  };
}
