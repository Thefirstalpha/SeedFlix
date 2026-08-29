import { Response } from 'express';
import { UserStatusBar } from '../../common/user';
import { TorrentDownloadItem, TorrentStatsResponse } from '../../common/torrent';
import { getNotifications } from './notification';
import { getWishlist } from './wishlist';
import { getDownloadsTransmission, getTransmissionStats } from './transmission';

export type SSEEventName = 'statusBar' | 'downloads' | 'notification' | 'heartbeat';

// Map of userId -> Set of active Express Response streams
const clients = new Map<number, Set<Response>>();

let heartbeatInterval: NodeJS.Timeout | null = null;

function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    for (const [userId, resSet] of clients.entries()) {
      for (const res of resSet) {
        try {
          res.write(': heartbeat\n\n');
        } catch {
          resSet.delete(res);
        }
      }
      if (resSet.size === 0) {
        clients.delete(userId);
      }
    }
  }, 20_000);
}

export function addClient(userId: number, res: Response) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId)!.add(res);
  ensureHeartbeat();
}

export function removeClient(userId: number, res: Response) {
  const resSet = clients.get(userId);
  if (resSet) {
    resSet.delete(res);
    if (resSet.size === 0) {
      clients.delete(userId);
    }
  }
}

export function getClientCount(userId?: number): number {
  if (userId !== undefined) {
    return clients.get(userId)?.size ?? 0;
  }
  let total = 0;
  for (const set of clients.values()) {
    total += set.size;
  }
  return total;
}

export function emitToUser(userId: number, event: SSEEventName, data: unknown) {
  const resSet = clients.get(userId);
  if (!resSet || resSet.size === 0) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const deadResponses: Response[] = [];

  for (const res of resSet) {
    try {
      res.write(payload);
    } catch {
      deadResponses.push(res);
    }
  }

  for (const dead of deadResponses) {
    resSet.delete(dead);
  }
  if (resSet.size === 0) {
    clients.delete(userId);
  }
}

export async function buildUserStatusBar(userId: number): Promise<UserStatusBar> {
  // Téléchargements actifs
  let downloads = 0;
  try {
    const torrents = await getDownloadsTransmission(userId, {});
    downloads = torrents.filter((t) => t.leftUntilDone > 0 && !t.isFinished).length;
  } catch {
    /* Transmission non configuré ou inaccessible */
  }

  // Wishlist
  let wishlist = 0;
  try {
    const items = await getWishlist(userId);
    wishlist = items.length;
  } catch {
    /* ignore */
  }

  // Notifications non lues + dernière notification
  const { notifications: notifList, unreadCount } = getNotifications(userId, {
    limit: 1,
    unreadOnly: true,
  });
  const latest = notifList[0] ?? null;

  return {
    downloads,
    wishlist,
    notifications: unreadCount,
    latestNotification: latest
      ? { id: latest.id, title: latest.title, message: latest.message, type: latest.type }
      : null,
  };
}

export async function emitStatusBar(userId: number) {
  if (!clients.has(userId)) return;
  try {
    const statusBar = await buildUserStatusBar(userId);
    emitToUser(userId, 'statusBar', statusBar);
  } catch (err) {
    console.error(`Failed to emit statusBar to user ${userId}:`, err);
  }
}

export function emitNotification(userId: number, notification: unknown, unreadCount: number) {
  emitToUser(userId, 'notification', { notification, unreadCount });
  void emitStatusBar(userId);
}

export async function emitDownloads(
  userId: number,
  torrents?: TorrentDownloadItem[],
  stats?: TorrentStatsResponse,
) {
  if (!clients.has(userId)) return;

  let currentTorrents = torrents;
  let currentStats = stats;

  try {
    if (!currentTorrents) {
      currentTorrents = await getDownloadsTransmission(userId, { includeAll: true });
    }
    if (!currentStats) {
      currentStats = await getTransmissionStats(userId).catch(() => undefined);
    }
    emitToUser(userId, 'downloads', {
      torrents: currentTorrents,
      stats: currentStats,
    });
  } catch {
    /* Transmission inaccessible */
  }
}

