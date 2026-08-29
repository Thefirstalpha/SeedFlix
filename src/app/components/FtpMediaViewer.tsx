import { Download, Film, Music, Image as ImageIcon, FileText, X, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getDownloadUrl, getStreamUrl, getFtpMediaType, type FtpMediaType } from '../services/ftpService';

interface FtpMediaViewerProps {
  filePath: string;
  fileName: string;
  fileSize?: number;
  onClose: () => void;
}

export function FtpMediaViewer({ filePath, fileName, fileSize, onClose }: Readonly<FtpMediaViewerProps>) {
  const mediaType: FtpMediaType = getFtpMediaType(fileName);
  const streamUrl = getStreamUrl(filePath);
  const downloadUrl = getDownloadUrl(filePath);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTextLoading, setIsTextLoading] = useState(mediaType === 'text');
  const [textError, setTextError] = useState<string | null>(null);

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
      fetch(streamUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Impossible de charger le texte');
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch((err) => setTextError(err instanceof Error ? err.message : 'Erreur'))
        .finally(() => setIsTextLoading(false));
    }
  }, [mediaType, streamUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-xl border border-white/20 bg-slate-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {mediaType === 'video' && <Film className="w-5 h-5 text-purple-400 shrink-0" />}
            {mediaType === 'audio' && <Music className="w-5 h-5 text-green-400 shrink-0" />}
            {mediaType === 'image' && <ImageIcon className="w-5 h-5 text-pink-400 shrink-0" />}
            {mediaType === 'text' && <FileText className="w-5 h-5 text-cyan-400 shrink-0" />}
            <span className="text-white font-medium text-sm sm:text-base truncate" title={fileName}>
              {fileName}
            </span>
            {fileSize !== undefined && fileSize > 0 && (
              <Badge variant="outline" className="border-white/20 text-white/70 text-xs shrink-0 hidden sm:inline-flex">
                {(fileSize / (1024 * 1024)).toFixed(1)} Mo
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
        <div className="flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6 bg-black/40 min-h-[300px] max-h-[75vh]">
          {mediaType === 'video' && (
            <video
              src={streamUrl}
              controls
              autoPlay
              className="max-w-full max-h-[70vh] rounded-lg shadow-lg bg-black object-contain"
            >
              Votre navigateur ne supporte pas la lecture de cette vidéo.
            </video>
          )}

          {mediaType === 'audio' && (
            <div className="flex flex-col items-center gap-6 py-10 px-4 w-full max-w-md">
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-green-500/30 to-emerald-500/10 border border-green-500/30 flex items-center justify-center shadow-inner">
                <Music className="w-12 h-12 text-green-400 animate-pulse" />
              </div>
              <p className="text-white text-center font-medium truncate max-w-full">{fileName}</p>
              <audio src={streamUrl} controls autoPlay className="w-full" />
            </div>
          )}

          {mediaType === 'image' && (
            <img
              src={streamUrl}
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
              <p className="text-white font-medium">Aperçu direct non disponible pour ce type de fichier.</p>
              <a
                href={downloadUrl}
                download={fileName}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger le fichier
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

