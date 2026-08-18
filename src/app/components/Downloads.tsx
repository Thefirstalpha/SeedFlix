import {
  Check,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  Pause,
  Play,
  SlidersHorizontal,
  Trash2,
  Unlink,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { useI18n } from '../i18n/LanguageProvider';
import {
  getTorrentDownloads,
  pauseTorrent,
  resumeTorrent,
  deleteTorrent,
  unmanageTorrent,
} from '../services/torrentService';
import { TorrentDownloadItem } from '../../../common/torrent';

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
}: {
  item: TorrentDownloadItem;
  t: any;
  isComplete: (item: TorrentDownloadItem) => boolean;
  isActiveDownload: (item: TorrentDownloadItem) => boolean;
  actionInProgress: string | null;
  handlePause: (id: number) => void;
  handleResume: (id: number) => void;
  handleUnmanage: (hash: string) => void;
  handleDelete: (id: number) => void;
}) {
  const completed = isComplete(item);
  const isStopped = item.status === 0;
  const isActive = isActiveDownload(item);
  const isPaused = isStopped && !completed;
  const [showRawDetails, setShowRawDetails] = useState(false);

  return (
    <Card
      key={item.id}
      className={`border-white/10 text-white transition-all ${
        completed
          ? 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border-emerald-500/30'
          : 'bg-white/5'
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-base font-semibold line-clamp-2 break-all flex-1">
            {item.name}
          </CardTitle>
          {completed && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!completed && <Progress value={item.progress} className="bg-white/10" />}
        <div className="flex flex-wrap gap-2">
          {!completed && (
            <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
              {item.progress.toFixed(1)}%
            </Badge>
          )}
          {completed && (
            <Badge className="border-emerald-500/50 bg-emerald-600/40 text-emerald-200">
              ✓ {t('downloads.finished')}
            </Badge>
          )}
          <Badge
            variant="outline"
            className={
              completed ? 'border-emerald-500/40 text-emerald-300' : 'border-white/30 text-white/80'
            }
          >
            {item.statusLabel}
          </Badge>
          {!completed && !isPaused && (
            <>
              <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                {t('downloads.rate')}: {formatRate(item.rateDownload)}
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                {t('downloads.eta')}:{' '}
                {formatEta(item.eta, t('downloads.unknown'), t('downloads.finished'))}
              </Badge>
            </>
          )}
          <Badge variant="outline" className="border-purple-500/40 text-purple-300">
            {t('downloads.peers')}: {item.peersConnected}
          </Badge>
          <Badge variant="outline" className="border-sky-500/40 text-sky-300">
            {t('downloads.totalSize')}: {formatSize(item.totalSize)}
          </Badge>
          {!completed && (
            <Badge variant="outline" className="border-orange-500/40 text-orange-300">
              {t('downloads.remaining')}: {formatSize(item.leftUntilDone)}
            </Badge>
          )}
          <Badge variant="outline" className="border-fuchsia-500/40 text-fuchsia-300">
            {t('downloads.ratio')}: {item.uploadRatio.toFixed(2)}
          </Badge>
          <Badge variant="outline" className="border-teal-500/40 text-teal-300">
            {t('downloads.added')}: {formatAddedDate(item.addedDate, t('downloads.unknown'))}
          </Badge>
          <Badge
            variant="outline"
            className={
              item.managedBySeedflix === false
                ? 'border-slate-400/40 text-slate-300'
                : 'border-cyan-500/40 text-cyan-300'
            }
          >
            {item.managedBySeedflix === false
              ? t('downloads.unmanagedBadge')
              : t('downloads.managedBadge')}
          </Badge>
        </div>
        {item.error > 0 && item.errorString ? (
          <p className="text-sm text-red-300">
            {t('downloads.errorPrefix')}: {item.errorString}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-2">
          {!completed && isActive && (
            <Button
              size="sm"
              onClick={() => handlePause(item.id)}
              disabled={actionInProgress === `pause-${item.id}`}
              className={`border transition-all ${
                actionInProgress === `pause-${item.id}`
                  ? 'bg-amber-600/20 text-amber-200/50 border-amber-500/20 cursor-wait'
                  : 'bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 border-amber-500/30'
              }`}
            >
              {actionInProgress === `pause-${item.id}` ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('downloads.pause')}
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  {t('downloads.pause')}
                </>
              )}
            </Button>
          )}
          {!completed && isPaused && (
            <Button
              size="sm"
              onClick={() => handleResume(item.id)}
              disabled={actionInProgress === `resume-${item.id}`}
              className={`border transition-all ${
                actionInProgress === `resume-${item.id}`
                  ? 'bg-cyan-600/20 text-cyan-200/50 border-cyan-500/20 cursor-wait'
                  : 'bg-cyan-600/40 hover:bg-cyan-600/60 text-cyan-200 border-cyan-500/30'
              }`}
            >
              {actionInProgress === `resume-${item.id}` ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('downloads.resume')}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  {t('downloads.resume')}
                </>
              )}
            </Button>
          )}
          {item.managedBySeedflix && (
            <Button
              size="sm"
              onClick={() => handleUnmanage(item.hashString || '')}
              disabled={actionInProgress === `unmanage-${item.hashString}`}
              className={`border transition-all ${
                actionInProgress === `unmanage-${item.hashString}`
                  ? 'bg-slate-600/20 text-slate-200/50 border-slate-500/20 cursor-wait'
                  : 'bg-slate-600/30 hover:bg-slate-600/50 text-slate-300 border-slate-500/20'
              }`}
            >
              {actionInProgress === `unmanage-${item.hashString}` ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('downloads.dontTrack')}
                </>
              ) : (
                <>
                  <Unlink className="w-4 h-4 mr-1" />
                  {t('downloads.dontTrack')}
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => handleDelete(item.id)}
            disabled={actionInProgress === `delete-${item.id}`}
            className={`border transition-all ${
              actionInProgress === `delete-${item.id}`
                ? completed
                  ? 'bg-red-600/20 text-red-200/50 border-red-500/20 cursor-wait'
                  : 'bg-red-600/10 text-red-300/50 border-red-500/10 cursor-wait'
                : completed
                  ? 'bg-red-600/40 hover:bg-red-600/60 text-red-200 border-red-500/30'
                  : 'bg-red-600/20 hover:bg-red-600/40 text-red-300 border-red-500/20'
            }`}
          >
            {actionInProgress === `delete-${item.id}` ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {t('downloads.remove')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-1" />
                {t('downloads.remove')}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRawDetails((prev) => !prev)}
            className="border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
          >
            {showRawDetails ? t('downloads.hideRawDetails') : t('downloads.showRawDetails')}
          </Button>
        </div>
        {showRawDetails ? (
          <div className="rounded-md border border-white/15 bg-black/30 p-3">
            <p className="text-xs uppercase tracking-wide text-white/60 mb-2">
              {t('downloads.rawDetails')}
            </p>
            <pre className="text-xs text-white/80 whitespace-pre-wrap break-all">
              {JSON.stringify(item, null, 2)}
            </pre>
          </div>
        ) : null}
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

export function Downloads() {
  const { t } = useI18n();
  const [downloads, setDownloads] = useState<TorrentDownloadItem[]>([]);
  const [showActive, setShowActive] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAllTorrents, setShowAllTorrents] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Keep a ref to the current source filter value for polling
  const showAllTorrentsRef = useRef(showAllTorrents);
  // Track last action time to avoid race conditions with polling
  const lastActionTimeRef = useRef<number>(0);
  const ACTION_COOLDOWN_MS = 2000; // 2 seconds after an action, polling won't update state

  useEffect(() => {
    showAllTorrentsRef.current = showAllTorrents;
  }, [showAllTorrents]);

  // A torrent is considered complete when there's nothing left to download
  const isComplete = (item: TorrentDownloadItem) => item.leftUntilDone === 0 || item.isFinished;
  const isActiveDownload = (item: TorrentDownloadItem) =>
    !isComplete(item) && [3, 4].includes(item.status);

  const loadDownloads = async (includeAll: boolean = false) => {
    try {
      const response = await getTorrentDownloads(includeAll);
      // Check if we're in action cooldown; if so, don't update state from polling
      const timeSinceLastAction = Date.now() - lastActionTimeRef.current;
      if (timeSinceLastAction < ACTION_COOLDOWN_MS) {
        // Still in cooldown, ignore this polling update
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

  useEffect(() => {
    setIsLoading(true);
    void loadDownloads(showAllTorrentsRef.current);
    const interval = setInterval(() => {
      void loadDownloads(showAllTorrentsRef.current);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Silent refresh when source filter changes (no loading state)
  useEffect(() => {
    lastActionTimeRef.current = Date.now();
    const silentRefresh = async () => {
      try {
        const response = await getTorrentDownloads(showAllTorrents);
        setDownloads(response.torrents);
      } catch {
        // Silent fail, don't disrupt UX
      }
    };
    void silentRefresh();
  }, [showAllTorrents]);

  const filteredDownloads = useMemo(
    () => filterDownloads(downloads, showAllTorrents, showActive, showCompleted, isComplete),
    [downloads, showActive, showCompleted, showAllTorrents],
  );

  const activeCount = useMemo(
    () => downloads.filter((item) => isActiveDownload(item)).length,
    [downloads],
  );

  const handlePause = async (id: number) => {
    setActionInProgress(`pause-${id}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: immediately mark as paused (status = 0)
    setDownloads((prev) => prev.map((item) => (item.id === id ? { ...item, status: 0 } : item)));
    try {
      await pauseTorrent(id);
    } catch (err) {
      console.error('Erreur lors de la pause:', err);
    } finally {
      setActionInProgress(null);
      void loadDownloads(showAllTorrentsRef.current);
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
      void loadDownloads(showAllTorrentsRef.current);
    }
  };

  const handleDelete = async (id: number) => {
    setActionInProgress(`delete-${id}`);
    lastActionTimeRef.current = Date.now();
    // Optimistic update: remove from display immediately
    setDownloads((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteTorrent(id);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
    } finally {
      setActionInProgress(null);
      void loadDownloads(showAllTorrentsRef.current);
    }
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
      void loadDownloads(showAllTorrentsRef.current);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Download className="w-7 h-7 text-cyan-300" />
        <div>
          <h2 className="text-3xl font-bold text-white">{t('downloads.title')}</h2>
          <p className="text-white/60">
            {t('downloads.activeSummary', { active: activeCount, total: downloads.length })}
          </p>
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
              onClick={() => setShowActive((prev) => !prev)}
              className={
                showActive
                  ? 'bg-cyan-500/60 hover:bg-cyan-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {showActive ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.active')}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCompleted((prev) => !prev)}
              className={
                showCompleted
                  ? 'bg-emerald-500/60 hover:bg-emerald-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {showCompleted ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.completed')}
            </Button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <Button
              size="sm"
              onClick={() => setShowAllTorrents((prev) => !prev)}
              className={
                showAllTorrents
                  ? 'bg-violet-500/60 hover:bg-violet-500/70 text-white gap-1'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }
            >
              {showAllTorrents ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              {t('downloads.filters.allTorrents')}
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
    </div>
  );
}
