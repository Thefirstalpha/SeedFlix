/**
 * downloadWatcher.ts
 * Routine de surveillance des téléchargements Transmission.
 * Tourne en arrière-plan et envoie une notification quand un torrent suivi par
 * SeedFlix passe à l'état "terminé" (leftUntilDone === 0).
 */
import { db } from './db';
import { addNotification } from './notification';
import { getDownloadsTransmission, getTransmissionSettings } from './transmission';
import { Logger } from '../logger';

const POLL_INTERVAL_MS = 30_000;

// userId → Set de hashStrings déjà notifiés (ou déjà terminés au démarrage)
const notifiedHashes = new Map<number, Set<string>>();

// Premier tour par userId : sert uniquement à peupler le Set sans notifier
const initializedUsers = new Set<number>();

function getAllUserIds(): number[] {
    const rows = db
        .prepare('SELECT DISTINCT user_id FROM auth_users')
        .all() as { user_id: number }[];
    return rows.map(r => r.user_id);
}

async function pollUser(userId: number): Promise<void> {
    const settings = getTransmissionSettings(userId);
    if (!settings?.host) return;

    let torrents;
    try {
        torrents = await getDownloadsTransmission(userId, {});
    } catch {
        return; // Transmission inaccessible → on skip silencieusement
    }

    if (!notifiedHashes.has(userId)) {
        notifiedHashes.set(userId, new Set());
    }
    const done = notifiedHashes.get(userId)!;

    const isFirstRun = !initializedUsers.has(userId);

    for (const torrent of torrents) {
        const hash = torrent.hashString;
        if (!hash) continue;

        const isComplete = torrent.leftUntilDone === 0 || torrent.isFinished;

        if (isComplete && !done.has(hash)) {
            done.add(hash);
            if (!isFirstRun) {
                // Envoyer la notification
                addNotification(userId, {
                    title: 'Téléchargement terminé',
                    message: torrent.name,
                    type: 'success',
                    data: {
                        torrentId: torrent.id,
                        hashString: hash,
                        totalSize: torrent.totalSize,
                    },
                });
                console.log(`[DownloadWatcher] Notification envoyée pour "${torrent.name}" (user ${userId})`);
            }
        }
    }

    if (isFirstRun) {
        initializedUsers.add(userId);
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
