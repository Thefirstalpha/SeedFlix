import {
  Download,
  Film,
  Music,
  Image as ImageIcon,
  FileText,
  X,
  AlertCircle,
  Tv,
  RefreshCw,
  ExternalLink,
  Check,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  getDownloadUrl,
  getStreamUrl,
  getTranscodeUrl,
  getM3uPlaylistUrl,
  getFtpMediaType,
  isDirectPlayableVideo,
  type FtpMediaType,
} from '../services/ftpService';

interface FtpMediaViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  onClose: () => void;
}

export function FtpMediaViewer({
  filePath,
  fileName,
  fileSize,
  onClose,
}: Readonly<FtpMediaViewerProps>) {
  const mediaType: FtpMediaType = getFtpMediaType(fileName);
  const isDirectVideo = isDirectPlayableVideo(fileName);

  // Pour les MKV/AVI, on privilégie le transcodage/remuxing FFmpeg pour garantir la compatibilité
  const [playbackMode, setPlaybackMode] = useState<'direct' | 'remux' | 'transcode'>(
    isDirectVideo ? 'direct' : 'remux',
  );

  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(mediaType === 'text');
  const [textError, setTextError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [copiedM3u, setCopiedM3u] = useState(false);

  const directStreamUrl = getStreamUrl(filePath);
  const remuxUrl = getTranscodeUrl(filePath);
  const forceTranscodeUrl = getTranscodeUrl(filePath, { force: true });
  const downloadUrl = getDownloadUrl(filePath);
  const m3uUrl = getM3uPlaylistUrl(filePath);

  let currentVideoUrl = directStreamUrl;
  if (playbackMode === 'remux') {
    currentVideoUrl = remuxUrl;
  } else if (playbackMode === 'transcode') {
    currentVideoUrl = forceTranscodeUrl;
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (mediaType === 'text') {
      setIsTextLoading(true);
      setTextError(null);
      fetch(directStreamUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Impossible de charger le texte');
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch((err) => setTextError(err instanceof Error ? err.message : 'Erreur'))
        .finally(() => setIsTextLoading(false));
    }
  }, [mediaType, directStreamUrl]);

  const handleCopyVlcLink = async () => {
    const fullUrl = `${window.location.origin}${directStreamUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedM3u(true);
      setTimeout(() => setCopiedM3u(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-xl border border-white/20 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {mediaType === 'video' && <Film className="w-5 h-5 text-purple-400 shrink-0" />}
            {mediaType === 'audio' && <Music className="w-5 h-5 text-green-400 shrink-0" />}
            {mediaType === 'image' && <ImageIcon className="w-5 h-5 text-pink-400 shrink-0" />}
            {mediaType === 'text' && <FileText className="w-5 h-5 text-cyan-400 shrink-0" />}
            <span
              className="text-white font-medium text-sm sm:text-base truncate"
              title={fileName}
            >
              {fileName}
            </span>
            {fileSize !== undefined && fileSize > 0 && (
              <Badge
                variant="outline"
                className="border-white/20 text-white/70 text-xs shrink-0 hidden sm:inline-flex"
              >
                {(fileSize / (1024 * 1024)).toFixed(1)} Mo
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {mediaType === 'video' && (
              <>
                {/* Sélecteur de mode de streaming */}
                <div className="hidden md:flex items-center rounded-lg bg-slate-800 p-0.5 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(null);
                      setPlaybackMode('direct');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      playbackMode === 'direct'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Lecture directe via HTTP Range 206 (rapide, formats standards)"
                  >
                    Direct (Range)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(null);
                      setPlaybackMode('remux');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      playbackMode === 'remux'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Remuxing transparent via FFmpeg (idéal pour MKV & audio AC3/DTS)"
                  >
                    Remux FFmpeg
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoError(null);
                      setPlaybackMode('transcode');
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      playbackMode === 'transcode'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-white/70 hover:text-white'
                    }`}
                    title="Transcodage vidéo complet (en cas de codec non pris en charge)"
                  >
                    Transcodage
                  </button>
                </div>

                {/* Bouton VLC / M3U */}
                <a
                  href={m3uUrl}
                  download={`${fileName}.m3u`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                  title="Télécharger la playlist M3U pour ouvrir dans VLC, Infuse, IINA ou PotPlayer"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">VLC (.m3u)</span>
                </a>

                {/* Bouton Copier le lien direct */}
                <button
                  type="button"
                  onClick={handleCopyVlcLink}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                  title="Copier le lien direct de stream"
                >
                  {copiedM3u ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      <span className="hidden sm:inline text-green-400">Copié</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Lien direct</span>
                    </>
                  )}
                </button>
              </>
            )}

            <a
              href={downloadUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Télécharger le fichier"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Télécharger</span>
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-3 sm:p-6 bg-black/40 min-h-[300px] max-h-[75vh]">
          {mediaType === 'video' && (
            <div className="w-full flex flex-col items-center gap-3">
              {/* Alert si erreur de lecture ou suggestion de mode */}
              {videoError && (
                <div className="w-full max-w-2xl bg-amber-950/80 border border-amber-500/40 rounded-lg p-3 text-amber-200 text-xs sm:text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">Problème de décodage du format dans le navigateur</p>
                    <p className="text-white/80">
                      Ce fichier utilise probablement un conteneur (MKV) ou un codec audio (AC3/DTS) non supporté nativement.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setVideoError(null);
                          setPlaybackMode('remux');
                        }}
                        className="text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Activer Remux Web FFmpeg
                      </Button>
                      <a
                        href={m3uUrl}
                        download={`${fileName}.m3u`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        <ExternalLink className="w-3 h-3" /> Ouvrir dans VLC
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Tag Video avec gestion d'erreur */}
              <video
                key={currentVideoUrl}
                src={currentVideoUrl}
                controls
                autoPlay
                preload="metadata"
                onError={() => {
                  if (playbackMode === 'direct') {
                    setVideoError('Le format vidéo ou audio nécessite le remuxing FFmpeg.');
                    setPlaybackMode('remux');
                  } else {
                    setVideoError('Erreur de lecture du flux transcodé.');
                  }
                }}
                className="max-w-full max-h-[65vh] rounded-lg shadow-lg bg-black object-contain"
              >
                Votre navigateur ne supporte pas la lecture de cette vidéo.
              </video>

              {/* Mobile selector for modes */}
              <div className="flex md:hidden items-center gap-2 text-xs text-white/70 pt-1">
                <span>Mode :</span>
                <select
                  value={playbackMode}
                  onChange={(e) => {
                    setVideoError(null);
                    setPlaybackMode(e.target.value as any);
                  }}
                  className="bg-slate-800 text-white border border-white/20 rounded px-2 py-1"
                >
                  <option value="direct">Direct (Range 206)</option>
                  <option value="remux">Remux FFmpeg</option>
                  <option value="transcode">Transcodage forcé</option>
                </select>
              </div>
            </div>
          )}

          {mediaType === 'audio' && (
            <div className="flex flex-col items-center gap-6 py-10 px-4 w-full max-w-md">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-green-500/30 to-emerald-500/10 border border-green-500/30 flex items-center justify-center shadow-inner">
                <Music className="w-12 h-12 text-green-400 animate-pulse" />
              </div>
              <p className="text-white text-center font-medium truncate max-w-full">{fileName}</p>
              <audio src={directStreamUrl} controls autoPlay className="w-full" />
            </div>
          )}

          {mediaType === 'image' && (
            <img
              src={directStreamUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] rounded-lg object-contain select-none"
            />
          )}

          {mediaType === 'text' && (
            <div className="w-full h-full max-h-[65vh] overflow-auto rounded-lg bg-slate-900/90 p-4 border border-white/10">
              {isTextLoading && <p className="text-white/60 text-sm">Chargement du contenu...</p>}
              {textError && (
                <div className="flex items-center gap-2 text-red-300 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>{textError}</span>
                </div>
              )}
              {textContent && (
                <pre className="text-xs sm:text-sm text-cyan-200 font-mono whitespace-pre-wrap break-words">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {!mediaType && (
            <div className="text-center space-y-3 p-6">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-white font-medium">
                Aperçu direct non disponible pour ce type de fichier.
              </p>
              <div className="flex justify-center gap-3">
                <a
                  href={downloadUrl}
                  download={fileName}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le fichier
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


