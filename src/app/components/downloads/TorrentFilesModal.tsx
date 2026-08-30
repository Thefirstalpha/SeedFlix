import { useEffect, useState } from 'react';
import { CheckSquare, File, FolderTree, Loader2, Save, Square, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { getTorrentFiles, setTorrentFilesWanted, TorrentFileDetail } from '../../services/torrentService';
import { useI18n } from '../../i18n/LanguageProvider';

interface TorrentFilesModalProps {
  torrentId: number | null;
  torrentName?: string;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[index]}`;
}

export function TorrentFilesModal({
  torrentId,
  torrentName,
  onClose,
}: Readonly<TorrentFilesModalProps>) {
  const { language } = useI18n();
  const [files, setFiles] = useState<TorrentFileDetail[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!torrentId) {
      setFiles([]);
      setSelectedMap({});
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    getTorrentFiles(torrentId)
      .then((data) => {
        if (!isMounted) return;
        setFiles(data);
        const map: Record<number, boolean> = {};
        for (const file of data) {
          map[file.index] = file.wanted;
        }
        setSelectedMap(map);
      })
      .catch((err) => {
        console.error('Error fetching torrent files:', err);
        toast.error('Impossible de récupérer la liste des fichiers');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [torrentId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && torrentId) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [torrentId, onClose]);

  if (!torrentId) return null;

  const handleToggle = (index: number) => {
    setSelectedMap((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSelectAll = (select: boolean) => {
    const next: Record<number, boolean> = {};
    for (const f of files) {
      next[f.index] = select;
    }
    setSelectedMap(next);
  };

  const handleSave = async () => {
    if (!torrentId || isSaving) return;
    setIsSaving(true);

    const wanted: number[] = [];
    const unwanted: number[] = [];

    for (const file of files) {
      if (selectedMap[file.index]) {
        wanted.push(file.index);
      } else {
        unwanted.push(file.index);
      }
    }

    try {
      await setTorrentFilesWanted(torrentId, wanted, unwanted);
      toast.success(
        language === 'fr'
          ? 'Sélection des fichiers enregistrée'
          : 'File selection saved',
      );
      onClose();
    } catch {
      toast.error('Erreur lors de la mise à jour des fichiers');
    } finally {
      setIsSaving(false);
    }
  };

  const totalBytes = files.reduce((acc, f) => acc + f.length, 0);
  const selectedBytes = files
    .filter((f) => selectedMap[f.index])
    .reduce((acc, f) => acc + f.length, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in-50 duration-200"
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
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <FolderTree className="w-5 h-5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">
                {language === 'fr' ? 'Fichiers du torrent' : 'Torrent Files'}
              </h3>
              <p className="text-xs text-white/50 truncate max-w-md">
                {torrentName || `#${torrentId}`}
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10 rounded-full shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/10 text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleSelectAll(true)}
              className="h-7 px-2 text-xs text-white/80 hover:text-white hover:bg-white/10 gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Tout cocher' : 'Select All'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleSelectAll(false)}
              className="h-7 px-2 text-xs text-white/80 hover:text-white hover:bg-white/10 gap-1"
            >
              <Square className="w-3.5 h-3.5" />
              {language === 'fr' ? 'Tout décocher' : 'Deselect All'}
            </Button>
          </div>

          <div className="text-right">
            <span>
              {files.filter((f) => selectedMap[f.index]).length} / {files.length} fichiers ({formatBytes(selectedBytes)} / {formatBytes(totalBytes)})
            </span>
          </div>
        </div>

        {/* Files List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/60 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span>Chargement de la liste des fichiers...</span>
            </div>
          ) : files.length > 0 ? (
            files.map((file) => {
              const isWanted = Boolean(selectedMap[file.index]);
              const percent = file.length > 0 ? Math.round((file.bytesCompleted / file.length) * 100) : 0;
              const fileName = file.name.split('/').pop() || file.name;

              return (
                <div
                  key={file.index}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleToggle(file.index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleToggle(file.index);
                    }
                  }}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                    isWanted
                      ? 'bg-white/5 border-white/15 hover:bg-white/10'
                      : 'bg-white/[0.02] border-white/5 opacity-50 hover:opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={isWanted}
                      onCheckedChange={() => handleToggle(file.index)}
                      className="border-white/40"
                    />
                    <File className="w-4 h-4 text-white/40 shrink-0" />
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs sm:text-sm font-medium text-white truncate" title={file.name}>
                        {fileName}
                      </p>
                      <div className="flex items-center gap-3 text-[11px] text-white/50">
                        <span>{formatBytes(file.length)}</span>
                        <span>•</span>
                        <span>{percent}% ({formatBytes(file.bytesCompleted)})</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-16 sm:w-24 bg-white/10 rounded-full h-1.5 overflow-hidden shrink-0">
                    <div
                      className="bg-purple-500 h-full rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-center py-12 text-white/50 text-sm">Aucun fichier trouvé dans ce torrent.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-slate-900 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-white/60 hover:text-white"
          >
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-medium"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {language === 'fr' ? 'Enregistrer la sélection' : 'Save Selection'}
          </Button>
        </div>
      </div>
    </div>
  );
}

