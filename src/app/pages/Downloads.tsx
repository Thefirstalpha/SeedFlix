import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Pause,
  Play,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Link,
  Trash2,
  FolderX,
  FolderTree,
  ArrowUp,
  ArrowDown,
  Unlink,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useI18n } from '../i18n/LanguageProvider';
import {
  getTorrentDownloads,
  pauseTorrent,
  resumeTorrent,
  deleteTorrent,
  unmanageTorrent,
  getTorrentStats,
  moveTorrentQueue,
} from '../services/torrentService';
import { TorrentDownloadItem, TorrentStatsResponse } from '../../../common/torrent';
import { TurtleModeButton } from '../components/downloads/TurtleModeButton';
import { TorrentFilesModal } from '../components/downloads/TorrentFilesModal';
import { toast } from 'sonner';

import { useRealtime } from '../context/RealtimeContext';

function formatRate(bytesPerSec: number) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return '0 B/s';
  }

  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSec;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

function formatAddedDate(timestamp: number, unknownLabel: string) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return unknownLabel;
  }

  try {
    return new Date(timestamp * 1000).toLocaleString();
  } catch {
    return unknownLabel;
  }
}

function formatEta(seconds: number, unknownLabel: string, finishedLabel: string) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return unknownLabel;
  }
  if (seconds === 0) {
    return finishedLabel;
  }

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }

  return `${s}s`;
}

// Go envoyés par jour depuis l'ajout : indique quels torrents rapportent le plus d'upload.
function computeUploadEfficiency(uploadedEver: number, addedDate: number): number | null {
  if (!Number.isFinite(addedDate) || addedDate <= 0) {
    return null;
  }

  const safeUploaded = Number.isFinite(uploadedEver) && uploadedEver > 0 ? uploadedEver : 0;
  const daysSinceAdded = Math.max((Date.now() / 1000 - addedDate) / 86400, 1 / 24);
  const uploadedGB = safeUploaded / 1024 ** 3;
  return uploadedGB / daysSinceAdded;
}

function DownloadCard({
  item,
  t,
  isComplete,
  isActiveDownload,
  actionInProgress,
  handlePause,
  handleResume,
  handleUnmanage,
  handleDelete,
  onRequestDeleteWithData,
  onRequestFiles,
  onMoveQueue,
}: Readonly<{
  item: TorrentDownloadItem;
  t: any;
  isComplete: (item: TorrentDownloadItem) => boolean;
  isActiveDownload: (item: TorrentDownloadItem) => boolean;
  actionInProgress: string | null;
  handlePause: (id: number) => void;
  handleResume: (id: number) => void;
  handleUnmanage: (hash: string) => void;
  handleDelete: (id: number) => void;
  onRequestDeleteWithData: (item: TorrentDownloadItem) => void;
  onRequestFiles: (item: TorrentDownloadItem) => void;
  onMoveQueue: (id: number, action: 'up' | 'down') => void;
}>) {
  const completed = isComplete(item);
  const isStopped = item.status === 0;
  const isActive = isActiveDownload(item);
  const isPaused = isStopped && !completed;
  const uploadEfficiency = computeUploadEfficiency(item.uploadedEver, item.addedDate);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const icon = (() => {
    if (completed) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
    }
    if (isPaused) {
      return <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />;
    }
    return <Loader2 className="w-4 h-4 text-cyan-400 flex-shrink-0 animate-spin" />;
  })();

  return (
    <Card
      key={item.id}
      className={`border-white/10 text-white transition-all ${completed
        ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border-emerald-500/30'
        : 'bg-white/5'
        }`}
    >
      <CardContent className="px-3 py-2.5 space-y-2 [&:last-child]:pb-2.5">
        {/* Ligne 1 : nom + icône */}
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium truncate flex-1">{item.name}</span>
          {item.error > 0 && item.errorString && (
            <span className="text-xs text-red-400 truncate max-w-[160px]" title={item.errorString}>
              ⚠ {item.errorString}
            </span>
          )}
        </div>

        {/* Barre de progression */}
        {!completed && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">{item.statusLabel}</span>
              <span className="font-semibold text-cyan-300">{item.progress.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
              />
            </div>
          </div>
        )}

        {/* Badges métriques */}
        <div className="flex flex-wrap gap-1.5">
          {completed && (
            <Badge className="border-emerald-500/50 bg-emerald-600/40 text-emerald-200 text-xs py-0 h-5">
              ✓ {t('downloads.finished')}
            </Badge>
          )}
          {completed && (
            <Badge variant="outline"
              className="text-xs py-0 h-5 border-emerald-500/40 text-emerald-300">
              {item.statusLabel}
            </Badge>
          )}
          {!completed && !isPaused && (
            <>
              <Badge variant="outline" className="border-lime-500/40 text-lime-300 text-xs py-0 h-5">
                {formatRate(item.rateDownload)}
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300 text-xs py-0 h-5">
                {formatEta(item.eta, t('downloads.unknown'), t('downloads.finished'))}
              </Badge>
            </>
          )}
          <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-xs py-0 h-5">
            {formatSize(item.totalSize)}
          </Badge>
          {!completed && (
            <Badge variant="outline" className="border-orange-500/40 text-orange-300 text-xs py-0 h-5">
              {formatSize(item.leftUntilDone)} restants
            </Badge>
          )}
          <Badge variant="outline" className="border-purple-500/40 text-purple-300 text-xs py-0 h-5">
            {t('downloads.peers')}: {item.peersConnected}
          </Badge>
          <Badge variant="outline" className="border-fuchsia-500/40 text-fuchsia-300 text-xs py-0 h-5">
            ratio {item.uploadRatio.toFixed(2)}
          </Badge>
          {uploadEfficiency !== null && (
            <Badge variant="outline" className="border-pink-500/40 text-pink-300 text-xs py-0 h-5"
              title={t('downloads.uploadEfficiencyHint')}>
              {t('downloads.uploadEfficiency', { value: uploadEfficiency.toFixed(2) })}
            </Badge>
          )}
          <Badge variant="outline" className="border-teal-500/40 text-teal-300 text-xs py-0 h-5">
            {formatAddedDate(item.addedDate, t('downloads.unknown'))}
          </Badge>
          <Badge variant="outline"
            className={`text-xs py-0 h-5 ${item.managedBySeedflix === false ? 'border-slate-400/40 text-slate-300' : 'border-cyan-500/40 text-cyan-300'}`}>
            {item.managedBySeedflix === false
              ? t('downloads.unmanagedBadge')
              : <><Link className="w-3 h-3" />SeedFlix</>}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {!completed && isActive && (
            <Button size="sm" onClick={() => handlePause(item.id)}
              disabled={actionInProgress === `pause-${item.id}`}
              title={t('downloads.pause')}
              className="h-7 px-2 text-xs border bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 border-amber-500/30">
              {actionInProgress === `pause-${item.id}`
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <><Pause className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">{t('downloads.pause')}</span></>}
            </Button>
          )}
          {!completed && isPaused && (
            <Button size="sm" onClick={() => handleResume(item.id)}
              disabled={actionInProgress === `resume-${item.id}`}
              title={t('downloads.resume')}
              className="h-7 px-2 text-xs border bg-cyan-600/40 hover:bg-cyan-600/60 text-cyan-200 border-cyan-500/30">
              {actionInProgress === `resume-${item.id}`
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <><Play className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">{t('downloads.resume')}</span></>}
            </Button>
          )}
          <Button size="sm" onClick={() => handleDelete(item.id)}
            disabled={actionInProgress === `delete-${item.id}`}
            title={t('downloads.remove')}
            className={`h-7 px-2 text-xs border transition-all ${(() => {
              if (actionInProgress === `delete-${item.id}`)
                return 'bg-red-600/10 text-red-300/50 border-red-500/10 cursor-wait'
              if (completed)
                return 'bg-red-600/40 hover:bg-red-600/60 text-red-200 border-red-500/30'
              return 'bg-red-600/20 hover:bg-red-600/40 text-red-300 border-red-500/20'
            })()
              }`}>
            {actionInProgress === `delete-${item.id}`
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <><Trash2 className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">{t('downloads.remove')}</span></>}
          </Button>
          <Button size="sm" onClick={() => onRequestDeleteWithData(item)}
            disabled={actionInProgress === `delete-${item.id}`}
            title={t('downloads.removeWithData')}
            className="h-7 px-2 text-xs border bg-red-950/40 hover:bg-red-950/60 text-red-300 border-red-500/20">
            <FolderX className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">{t('downloads.removeWithData')}</span>
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => onRequestFiles(item)}
            title="Inspecter et sélectionner les fichiers"
            className="h-7 px-2 text-xs border-purple-500/30 bg-purple-900/20 text-purple-200 hover:bg-purple-900/40 hover:text-white">
            <FolderTree className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">Fichiers</span>
          </Button>
          {!completed && (
            <div className="flex items-center gap-0.5 border border-white/10 rounded-md bg-white/5 p-0.5" title="Priorité dans la file">
              <Button size="icon" variant="ghost"
                onClick={() => onMoveQueue(item.id, 'up')}
                title="Monter dans la file"
                className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 rounded">
                <ArrowUp className="w-3 h-3" />
              </Button>
              <Button size="icon" variant="ghost"
                onClick={() => onMoveQueue(item.id, 'down')}
                title="Descendre dans la file"
                className="h-6 w-6 text-white/70 hover:text-white hover:bg-white/10 rounded">
                <ArrowDown className="w-3 h-3" />
              </Button>
            </div>
          )}
          <Button size="sm" variant="outline"
            onClick={() => setShowRawDetails((prev) => !prev)}
            title="Détails"
            className="h-7 px-2 text-xs border-white/20 bg-white/5 text-white/60 hover:bg-white/10">
            {showRawDetails
              ? <><ChevronUp className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">Détails</span></>
              : <><ChevronDown className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">Détails</span></>}
          </Button>
          {item.managedBySeedflix && (
            <Button size="sm" onClick={() => handleUnmanage(item.hashString || '')}
              disabled={actionInProgress === `unmanage-${item.hashString}`}
              title={t('downloads.dontTrack')}
              className="h-7 px-2 text-xs border bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 border-slate-500/20">
              {actionInProgress === `unmanage-${item.hashString}`
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <><Unlink className="w-3 h-3 md:mr-1" /><span className="hidden md:inline">{t('downloads.dontTrack')}</span></>}
            </Button>
          )}
        </div>

        {showRawDetails && (
          <div className="rounded-md border border-white/15 bg-black/30 p-3">
            <p className="text-xs uppercase tracking-wide text-white/60 mb-2">{t('downloads.rawDetails')}</p>
            <pre className="text-xs text-white/80 whitespace-pre-wrap break-all">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function filterDownloads(
  downloads: TorrentDownloadItem[],
  showAllTorrents: boolean,
  showActive: boolean,
  showCompleted: boolean,
  isComplete: (item: TorrentDownloadItem) => boolean,
) {
  return downloads
    .filter((item) => (showAllTorrents ? true : item.managedBySeedflix !== false))
    .filter((item) => {
      const completed = isComplete(item);
      if (showActive && !showCompleted) {
        return !completed;
      }
      if (!showActive && showCompleted) {
        return completed;
      }
      if (!showActive && !showCompleted) {
        return false;
      }
      return true;
    });
}

type SortKey = 'addedDate' | 'name' | 'progress' | 'rateDownload' | 'totalSize' | 'uploadRatio' | 'uploadEfficiency';

function getSortValue(item: TorrentDownloadItem, key: SortKey): number | string {
  switch (key) {
    case 'name':
      return item.name.toLowerCase();
    case 'progress':
      return item.progress;
    case 'rateDownload':
      return item.rateDownload;
    case 'totalSize':
      return item.totalSize;
    case 'uploadRatio':
      return item.uploadRatio;
    case 'uploadEfficiency':
      return computeUploadEfficiency(item.uploadedEver, item.addedDate) ?? -1;
    case 'addedDate':
    default:
      return item.addedDate;
  }
}

function sortDownloads(downloads: TorrentDownloadItem[], sortKey: SortKey, sortDir: 'asc' | 'desc') {
  const multiplier = sortDir === 'asc' ? 1 : -1;
  return [...downloads].sort((a, b) => {
    const valueA = getSortValue(a, sortKey);
    const valueB = getSortValue(b, sortKey);
    if (typeof valueA === 'string' || typeof valueB === 'string') {
      return multiplier * String(valueA).localeCompare(String(valueB));
    }
    return multiplier * (valueA - valueB);
  });
}

export function Downloads() {
  const { t, language } = useI18n();
  const { downloads: realtimeDownloads, stats: realtimeStats, isConnected } = useRealtime();
  const [downloads, setDownloads] = useState<TorrentDownloadItem[]>([]);
  const [stats, setStats] = useState<TorrentStatsResponse | null>(null);
  const [filter, setFilter] = useState<{
    showActive: boolean;
    showCompleted: boolean;
    showAllTorrents: boolean;
  }>({
    showActive: true,
    showCompleted: false,
    showAllTorrents: false,
  });
  const [pendingDeleteWithData, setPendingDeleteWithData] = useState<TorrentDownloadItem | null>(null);
  const [selectedTorrentForFiles, setSelectedTorrentForFiles] = useState<{ id: number; name: string } | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('addedDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Keep a ref to the current source filter value
  const showAllTorrentsRef = useRef(filter.showAllTorrents);
  // Track last action time to avoid race conditions with updates
  const lastActionTimeRef = useRef<number>(0);
  const ACTION_COOLDOWN_MS = 2000;

  useEffect(() => {
    showAllTorrentsRef.current = filter.showAllTorrents;
  }, [filter.showAllTorrents]);

  // A torrent is considered complete when there's nothing left to download
  const isComplete = (item: TorrentDownloadItem) => item.leftUntilDone === 0 || item.isFinished;
  const isActiveDownload = (item: TorrentDownloadItem) =>
    !isComplete(item) && [3, 4].includes(item.status);

  const handleMoveQueue = async (id: number, action: 'up' | 'down') => {
    try {
      await moveTorrentQueue(id, action);
      toast.success(
        language === 'fr'
          ? 'Priorité de téléchargement modifiée'
          : 'Download priority updated',
      );
      void loadDownloads(showAllTorrentsRef.current, true);
    } catch {
      toast.error('Erreur lors du changement de priorité');
    }
  };

  const loadDownloads = async (includeAll: boolean = false, force: boolean = false) => {
    try {
      const response = await getTorrentDownloads(includeAll);
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (!force && timeSinceLastAction < ACTION_COOLDOWN_MS) {
        return;
      }
      setDownloads(response.torrents);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('downloads.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getTorrentStats();
      setStats(response);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('downloads.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // Sync with Realtime SSE stream
  useEffect(() => {
    if (realtimeDownloads && (realtimeDownloads.length > 0 || isConnected)) {
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (timeSinceLastAction >= ACTION_COOLDOWN_MS) {
        setDownloads(realtimeDownloads);
        setIsLoading(false);
      }
    }
  }, [realtimeDownloads, isConnected]);

  useEffect(() => {
    if (realtimeStats) {
      setStats(realtimeStats);
    }
  }, [realtimeStats]);

  useEffect(() => {
    loadDownloads(filter.showAllTorrents);
    loadStats();

    const interval = setInterval(() => {
      loadDownloads(filter.showAllTorrents);
      loadStats();
    }, 5000);

    return () => clearInterval(interval);
  }, [filter.showAllTorrents]);

  // Silent refresh when source filter changes (no loading state)
  useEffect(() => {
    lastActionTimeRef.current = Date.now();
    const silentRefresh = async () => {
      try {
        const response = await getTorrentDownloads(filter.showAllTorrents);
        setDownloads(response.torrents);
      } catch {
        // Silent fail, don't disrupt UX
      }
    };
    void silentRefresh();
  }, [filter.showAllTorrents]);

  const filteredDownloads = useMemo(
    () => sortDownloads(
      filterDownloads(downloads, filter.showAllTorrents, filter.showActive, filter.showCompleted, isComplete),
      sortKey,
      sortDir,
    ),
    [downloads, filter.showActive, filter.showCompleted, filter.showAllTorrents, sortKey, sortDir],
  );

  const handlePause = async (id: number) => {
    setActionInProgress(`pause-${id}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: immediately mark as stopped (status = 0)
    setDownloads((prev) => prev.map((item) => (item.id === id ? { ...item, status: 0 } : item)));
    try {
      await pauseTorrent(id);
      // Laisse le temps au client torrent d'appliquer la pause avant de rafraîchir,
      // sinon le fetch immédiat peut renvoyer l'ancien statut (effet de rollback visuel).
      await new Promise((resolve) => setTimeout(resolve, 700));
    } catch (err) {
      console.error('Erreur lors de la pause:', err);
    } finally {
      setActionInProgress(null);
      lastActionTimeRef.current = Date.now();
      void loadDownloads(showAllTorrentsRef.current, true);
    }
  };

  const handleResume = async (id: number) => {
    setActionInProgress(`resume-${id}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: immediately mark as queued (status = 3)
    setDownloads((prev) => prev.map((item) => (item.id === id ? { ...item, status: 3 } : item)));
    try {
      await resumeTorrent(id);
    } catch (err) {
      console.error('Erreur lors de la reprise:', err);
    } finally {
      setActionInProgress(null);
      void loadDownloads(showAllTorrentsRef.current, true);
    }
  };

  const handleDelete = async (id: number, deleteData = false) => {
    setActionInProgress(`delete-${id}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: remove from display immediately
    setDownloads((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteTorrent(id, deleteData);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    } finally {
      setActionInProgress(null);
      void loadDownloads(showAllTorrentsRef.current, true);
    }
  };

  const confirmDeleteWithData = async () => {
    if (!pendingDeleteWithData) return;
    const id = pendingDeleteWithData.id;
    setPendingDeleteWithData(null);
    await handleDelete(id, true);
  };

  const handleUnmanage = async (hash: string) => {
    setActionInProgress(`unmanage-${hash}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: mark as no longer managed by SeedFlix
    setDownloads((prev) =>
      prev.map((item) => (item.hashString === hash ? { ...item, managedBySeedflix: false } : item)),
    );
    try {
      await unmanageTorrent(hash);
    } catch (err) {
      console.error('Erreur lors du retrait du suivi:', err);
    } finally {
      setActionInProgress(null);
      void loadDownloads(showAllTorrentsRef.current, true);
    }
  };

  return (
    <div className="space-y-6">
      {pendingDeleteWithData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/10">
              <div>
                <p className="text-base font-semibold text-white">{t('downloads.confirmDeleteWithData.title')}</p>
                <p className="text-xs text-white/50 mt-1 truncate max-w-[260px]" title={pendingDeleteWithData.name}>
                  {pendingDeleteWithData.name}
                </p>
              </div>
              <button type="button" onClick={() => setPendingDeleteWithData(null)} className="text-white/40 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-white/70">{t('downloads.confirmDeleteWithData.description')}</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 bg-white/5">
              <Button size="sm" variant="ghost" onClick={() => setPendingDeleteWithData(null)}
                className="text-white/50 hover:text-white h-8">
                {t('downloads.confirmDeleteWithData.cancel')}
              </Button>
              <Button size="sm" onClick={() => void confirmDeleteWithData()}
                className="bg-red-600 hover:bg-red-700 text-white h-8">
                <FolderX className="w-3.5 h-3.5 mr-1.5" />
                {t('downloads.confirmDeleteWithData.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Download className="w-7 h-7 text-cyan-300 shrink-0" />
          <div>
            <h2 className="text-3xl font-bold text-white">{t('downloads.title')}</h2>
            <p className="text-white/60">
              {stats ? (
                <>
                  <span>
                    {t('downloads.totalCount', { total: stats.torrentCount })}
                  </span>
                  <span> • </span>
                  <span className="text-green-300">
                    {t('downloads.uploadRate', { value: (stats.uploadSpeed / 1024 / 1024).toFixed(2) })}
                  </span>
                  <span> • </span>
                  <span className="text-red-300">
                    {t('downloads.downloadRate', { value: (stats.downloadSpeed / 1024 / 1024).toFixed(2) })}
                  </span>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TurtleModeButton />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('downloads.loading')}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
            <SlidersHorizontal className="w-4 h-4" />
            {t('downloads.filters.label')}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setFilter((prev) => ({ ...prev, showActive: !prev.showActive }))}
              className={
                filter.showActive
                  ? 'bg-cyan-500/60 hover:bg-cyan-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {filter.showActive ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.active')}
            </Button>
            <Button
              size="sm"
              onClick={() => setFilter((prev) => ({ ...prev, showCompleted: !prev.showCompleted }))}
              className={
                filter.showCompleted
                  ? 'bg-emerald-500/60 hover:bg-emerald-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {filter.showCompleted ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.completed')}
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button
              size="sm"
              onClick={() => setFilter((prev) => ({ ...prev, showAllTorrents: !prev.showAllTorrents }))}
              className={
                filter.showAllTorrents
                  ? 'bg-violet-500/60 hover:bg-violet-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {filter.showAllTorrents ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.allTorrents')}
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <span className="text-xs text-white/50">{t('downloads.sort.label')}</span>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-8 rounded-md border border-white/20 bg-slate-900 px-2 text-sm text-white"
            >
              <option value="addedDate">{t('downloads.sort.addedDate')}</option>
              <option value="name">{t('downloads.sort.name')}</option>
              <option value="progress">{t('downloads.sort.progress')}</option>
              <option value="rateDownload">{t('downloads.sort.rateDownload')}</option>
              <option value="totalSize">{t('downloads.sort.totalSize')}</option>
              <option value="uploadRatio">{t('downloads.sort.uploadRatio')}</option>
              <option value="uploadEfficiency">{t('downloads.sort.uploadEfficiency')}</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? t('downloads.sort.ascending') : t('downloads.sort.descending')}
              className="h-8 w-8 p-0 border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              {sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {filteredDownloads.map((item) => (
          <DownloadCard
            key={item.id}
            item={item}
            t={t}
            isComplete={isComplete}
            isActiveDownload={isActiveDownload}
            actionInProgress={actionInProgress}
            handlePause={handlePause}
            handleResume={handleResume}
            handleUnmanage={handleUnmanage}
            handleDelete={handleDelete}
            onRequestDeleteWithData={setPendingDeleteWithData}
            onRequestFiles={(it) => setSelectedTorrentForFiles({ id: it.id, name: it.name })}
            onMoveQueue={handleMoveQueue}
          />
        ))}
      </div>

      {!isLoading && !error && filteredDownloads.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-6 text-white/70">
            {downloads.length === 0 ? t('downloads.empty') : t('downloads.filters.empty')}
          </CardContent>
        </Card>
      ) : null}

      {/* Torrent Files Inspection & Selection Modal */}
      <TorrentFilesModal
        torrentId={selectedTorrentForFiles?.id || null}
        torrentName={selectedTorrentForFiles?.name}
        onClose={() => setSelectedTorrentForFiles(null)}
      />
    </div>
  );
}
