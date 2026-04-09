import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Pause, Play, Trash2, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import {
  getTorrentDownloads,
  pauseTorrent,
  resumeTorrent,
  cleanTorrent,
  type TorrentDownloadItem,
} from "../services/torrentService";
import { useI18n } from "../i18n/LanguageProvider";

function formatRate(bytesPerSec: number) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytesPerSec;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
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

export function Downloads() {
  const { t } = useI18n();
  const [downloads, setDownloads] = useState<TorrentDownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadDownloads = async () => {
    try {
      const response = await getTorrentDownloads();
      setDownloads(response.torrents);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("downloads.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDownloads();
    const interval = setInterval(() => {
      void loadDownloads();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeCount = useMemo(
    () => downloads.filter((item) => [3, 4, 5, 6].includes(item.status)).length,
    [downloads]
  );

  const handlePause = async (id: number) => {
    setActionInProgress(`pause-${id}`);
    try {
      await pauseTorrent(id);
      await loadDownloads();
    } catch (err) {
      console.error("Erreur lors de la pause:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResume = async (id: number) => {
    setActionInProgress(`resume-${id}`);
    try {
      await resumeTorrent(id);
      await loadDownloads();
    } catch (err) {
      console.error("Erreur lors de la reprise:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleClean = async (hash: string) => {
    setActionInProgress(`clean-${hash}`);
    try {
      await cleanTorrent(hash);
      await loadDownloads();
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Download className="w-7 h-7 text-cyan-300" />
        <div>
          <h2 className="text-3xl font-bold text-white">{t("downloads.title")}</h2>
          <p className="text-white/60">{t("downloads.activeSummary", { active: activeCount, total: downloads.length })}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t("downloads.loading")}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!isLoading && !error && downloads.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-6 text-white/70">
            {t("downloads.empty")}
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {downloads.map((item) => {
          const isFinished = item.isFinished;
          const isStopped = item.status === 0;
          const isActive = [3, 4, 5, 6].includes(item.status);
          const isPaused = isStopped && !isFinished;

          return (
            <Card
              key={item.id}
              className={`border-white/10 text-white transition-all ${
                isFinished
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border-emerald-500/30"
                  : "bg-white/5"
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-base font-semibold line-clamp-2 flex-1">
                    {item.name}
                  </CardTitle>
                  {isFinished && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isFinished && <Progress value={item.progress} className="bg-white/10" />}

                <div className="flex flex-wrap gap-2">
                  {!isFinished && (
                    <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                      {item.progress.toFixed(1)}%
                    </Badge>
                  )}
                  {isFinished && (
                    <Badge className="border-emerald-500/50 bg-emerald-600/40 text-emerald-200">
                      ✓ {t("downloads.finished")}
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-white/30 text-white/80">
                    {item.statusLabel}
                  </Badge>
                  {!isFinished && (
                    <>
                      <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                        {t("downloads.rate")}: {formatRate(item.rateDownload)}
                      </Badge>
                      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                        {t("downloads.eta")}: {formatEta(item.eta, t("downloads.unknown"), t("downloads.finished"))}
                      </Badge>
                    </>
                  )}
                  <Badge variant="outline" className="border-purple-500/40 text-purple-300">
                    {t("downloads.peers")}: {item.peersConnected}
                  </Badge>
                </div>

                {item.error > 0 && item.errorString ? (
                  <p className="text-sm text-red-300">{t("downloads.errorPrefix")}: {item.errorString}</p>
                ) : null}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {!isFinished && isActive && (
                    <Button
                      size="sm"
                      onClick={() => handlePause(item.id)}
                      disabled={actionInProgress === `pause-${item.id}`}
                      className="bg-amber-600/40 hover:bg-amber-600/60 text-amber-200 border border-amber-500/30"
                    >
                      <Pause className="w-4 h-4 mr-1" />
                      {actionInProgress === `pause-${item.id}` ? "..." : t("downloads.pause")}
                    </Button>
                  )}
                  {!isFinished && isPaused && (
                    <Button
                      size="sm"
                      onClick={() => handleResume(item.id)}
                      disabled={actionInProgress === `resume-${item.id}`}
                      className="bg-cyan-600/40 hover:bg-cyan-600/60 text-cyan-200 border border-cyan-500/30"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      {actionInProgress === `resume-${item.id}` ? "..." : t("downloads.resume")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => handleClean(item.hashString || "")}
                    disabled={actionInProgress === `clean-${item.hashString}`}
                    className={`border ${
                      isFinished
                        ? "bg-red-600/40 hover:bg-red-600/60 text-red-200 border-red-500/30"
                        : "bg-red-600/20 hover:bg-red-600/40 text-red-300 border-red-500/20"
                    }`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {actionInProgress === `clean-${item.hashString}` ? "..." : t("downloads.remove")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
