/**
 * downloadWatcher.ts
 * Routine de surveillance des téléchargements Transmission.
 * Tourne en arrière-plan et envoie une notification quand un torrent suivi par
 * SeedFlix passe à l'état "terminé" (leftUntilDone === 0).
 */
import { db } from './db';
import { addNotification } from './notification';
import {
  getDownloadsTransmission,
  getManagedTorrents,
  getTransmissionSettings,
  markManagedTorrentCompleted,
  ManagedTorrentEntry,
} from './transmission.ts';

const POLL_INTERVAL_MS = 30_000;

function getAllUserIds(): number[] {
  const rows = db.prepare('SELECT DISTINCT user_id FROM auth_users').all() as { user_id: number }[];
  return rows.map((r) => r.user_id);
}

async function pollUser(userId: number): Promise<void> {
  const settings = getTransmissionSettings(userId);
  if (!settings?.host) return;

  const managedEntries = getManagedTorrents(userId);
  if (!managedEntries.length) {
    return;
  }

  const managedByHash = new Map<string, ManagedTorrentEntry>(
    managedEntries.map((entry: ManagedTorrentEntry) => [entry.hash, entry]),
  );

  let torrents;
  try {
    torrents = await getDownloadsTransmission(userId, { includeAll: true });
  } catch {
    return; // Transmission inaccessible → on skip silencieusement
  }

  for (const torrent of torrents) {
    const hash = String(torrent.hashString || '')
      .trim()
      .toLowerCase();
    if (!hash) continue;

    const managed = managedByHash.get(hash);
    if (!managed || managed.completedNotifiedAt) continue;

    const isComplete = torrent.leftUntilDone === 0 || torrent.isFinished;

    if (isComplete) {
      addNotification(userId, {
        title: 'Téléchargement terminé',
        message: torrent.name,
        type: 'success',
        data: {
          torrentId: torrent.id,
          hashString: hash,
          totalSize: torrent.totalSize,
          torrentLink: managed.link,
        },
      });
      markManagedTorrentCompleted(userId, hash);
      console.log(`[DownloadWatcher] Notification envoyée pour "${torrent.name}" (user ${userId})`);
    }
  }
}

async function poll(): Promise<void> {
  console.log('[DownloadWatcher] Lancement du poll des téléchargements Transmission');
  const userIds = getAllUserIds();
  await Promise.allSettled(userIds.map(pollUser));
}

export function startDownloadWatcher(): void {
  console.log('[DownloadWatcher] Démarrage de la surveillance des téléchargements');
  // Premier passage immédiat pour initialiser les états
  poll().catch(() => {});
  setInterval(() => poll().catch(() => {}), POLL_INTERVAL_MS);
}
