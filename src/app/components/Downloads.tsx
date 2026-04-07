import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { getTorrentDownloads, type TorrentDownloadItem } from "../services/torrentService";

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

function formatEta(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "Inconnu";
  }
  if (seconds === 0) {
    return "Terminé";
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
  const [downloads, setDownloads] = useState<TorrentDownloadItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDownloads = async () => {
    try {
      const response = await getTorrentDownloads();
      setDownloads(response.torrents);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger les téléchargements");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Download className="w-7 h-7 text-cyan-300" />
        <div>
          <h2 className="text-3xl font-bold text-white">Téléchargements</h2>
          <p className="text-white/60">{activeCount} actif(s) sur {downloads.length} torrent(s)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/70">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des téléchargements...
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {!isLoading && !error && downloads.length === 0 ? (
        <Card className="border-white/10 bg-white/5 text-white">
          <CardContent className="p-6 text-white/70">
            Aucun téléchargement en cours.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {downloads.map((item) => (
          <Card key={item.id} className="border-white/10 bg-white/5 text-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold line-clamp-2">{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={item.progress} className="bg-white/10" />
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-300">
                  {item.progress.toFixed(1)}%
                </Badge>
                <Badge variant="outline" className="border-white/30 text-white/80">
                  {item.statusLabel}
                </Badge>
                <Badge variant="outline" className="border-lime-500/40 text-lime-300">
                  Débit: {formatRate(item.rateDownload)}
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                  ETA: {formatEta(item.eta)}
                </Badge>
                <Badge variant="outline" className="border-purple-500/40 text-purple-300">
                  Peers: {item.peersConnected}
                </Badge>
              </div>

              {item.error > 0 && item.errorString ? (
                <p className="text-sm text-red-300">Erreur: {item.errorString}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
