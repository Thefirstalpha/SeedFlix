import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { UserStatusBar } from '../../../common/user';
import { TorrentDownloadItem, TorrentStatsResponse } from '../../../common/torrent';
import { getUserStatusBar } from '../services/authService';
import { getTorrentDownloads, getTorrentStats } from '../services/torrentService';
import { toast } from 'sonner';
import { getSafeNotificationMessage } from '../utils/notificationSpoiler';

interface RealtimeContextValue {
  statusBar: UserStatusBar | null;
  downloads: TorrentDownloadItem[];
  stats: TorrentStatsResponse | null;
  isConnected: boolean;
  refreshStatusBar: () => Promise<void>;
  refreshDownloads: (includeAll?: boolean) => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, isAuthenticated, hasPendingSetup } = useAuth();
  const [statusBar, setStatusBar] = useState<UserStatusBar | null>(null);
  const [downloads, setDownloads] = useState<TorrentDownloadItem[]>([]);
  const [stats, setStats] = useState<TorrentStatsResponse | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const previousUnreadRef = useRef<number>(0);
  const hasHydratedRef = useRef<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const spoilerModeEnabled = Boolean(user?.settings?.spoilerMode);

  const refreshStatusBar = useCallback(async () => {
    try {
      const data = await getUserStatusBar();
      setStatusBar(data);
    } catch {
      // ignore
    }
  }, []);

  const refreshDownloads = useCallback(async (includeAll = false) => {
    try {
      const [dlRes, statsRes] = await Promise.all([
        getTorrentDownloads(includeAll).catch(() => ({ torrents: [], ok: false })),
        getTorrentStats().catch(() => null),
      ]);
      setDownloads(dlRes.torrents || []);
      if (statsRes) setStats(statsRes);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || hasPendingSetup) {
      setStatusBar(null);
      setDownloads([]);
      setStats(null);
      setIsConnected(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Initial load
    void refreshStatusBar();

    // Create SSE Connection
    let es: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      if (es) {
        es.close();
      }

      es = new EventSource('/api/events', { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.addEventListener('statusBar', (e: MessageEvent) => {
        try {
          const data: UserStatusBar = JSON.parse(e.data);
          setStatusBar(data);

          const nextUnread = data.notifications || 0;
          const prevUnread = previousUnreadRef.current;

          if (hasHydratedRef.current && nextUnread > prevUnread && window.location.pathname !== '/notifications') {
            const delta = nextUnread - prevUnread;
            const latest = data.latestNotification;
            if (latest) {
              const safeMsg = getSafeNotificationMessage(latest.message, spoilerModeEnabled);
              const toastTitle = delta > 1 ? `${delta} nouvelles notifications` : latest.title;
              const toastDesc = delta > 1 ? `${safeMsg} (et ${delta - 1} autre${delta - 1 > 1 ? 's' : ''})` : safeMsg;

              if (latest.type === 'success') toast.success(toastTitle, { description: toastDesc });
              else if (latest.type === 'error') toast.error(toastTitle, { description: toastDesc });
              else if (latest.type === 'warning') toast.warning(toastTitle, { description: toastDesc });
              else toast.info(toastTitle, { description: toastDesc });
            }
          }

          hasHydratedRef.current = true;
          previousUnreadRef.current = nextUnread;
          window.dispatchEvent(new CustomEvent('seedflix:notifications-updated', { detail: { count: nextUnread } }));
          window.dispatchEvent(new CustomEvent('seedflix:status-bar-updated', { detail: data }));
        } catch (err) {
          console.error('Error parsing statusBar SSE event:', err);
        }
      });

      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const notif = data.notification;
          if (notif && window.location.pathname !== '/notifications') {
            const safeMsg = getSafeNotificationMessage(notif.message, spoilerModeEnabled);
            if (notif.type === 'success') toast.success(notif.title, { description: safeMsg });
            else if (notif.type === 'error') toast.error(notif.title, { description: safeMsg });
            else if (notif.type === 'warning') toast.warning(notif.title, { description: safeMsg });
            else toast.info(notif.title, { description: safeMsg });
          }
          if (data.unreadCount !== undefined) {
            window.dispatchEvent(new CustomEvent('seedflix:notifications-updated', { detail: { count: data.unreadCount } }));
          }
        } catch (err) {
          console.error('Error parsing notification SSE event:', err);
        }
      });

      es.addEventListener('downloads', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.torrents)) {
            setDownloads(data.torrents);
          }
          if (data.stats) {
            setStats(data.stats);
          }
          window.dispatchEvent(new CustomEvent('seedflix:downloads-updated', { detail: data }));
        } catch (err) {
          console.error('Error parsing downloads SSE event:', err);
        }
      });

      es.onerror = () => {
        setIsConnected(false);
        if (es) {
          es.close();
          es = null;
        }
        // Auto-reconnect after 5 seconds
        retryTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    const handleWishlistRefresh = () => void refreshStatusBar();
    const handleNotificationsRefresh = () => void refreshStatusBar();

    window.addEventListener('seedflix:wishlist-refresh-request', handleWishlistRefresh);
    window.addEventListener('seedflix:notifications-refresh-request', handleNotificationsRefresh);

    return () => {
      window.removeEventListener('seedflix:wishlist-refresh-request', handleWishlistRefresh);
      window.removeEventListener('seedflix:notifications-refresh-request', handleNotificationsRefresh);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (es) {
        es.close();
        es = null;
      }
      eventSourceRef.current = null;
    };
  }, [isAuthenticated, hasPendingSetup, spoilerModeEnabled, refreshStatusBar]);

  const contextValue = React.useMemo<RealtimeContextValue>(() => ({
    statusBar,
    downloads,
    stats,
    isConnected,
    refreshStatusBar,
    refreshDownloads,
  }), [statusBar, downloads, stats, isConnected, refreshStatusBar, refreshDownloads]);

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return ctx;
}

