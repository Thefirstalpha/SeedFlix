import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  File,
  FileText,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Loader2,
  Music,
  MoveRight,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
  Download,
  Image,
  Archive,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import { useAuth } from '../context/AuthContext';
import {
  deleteBatch,
  getDownloadUrl,
  getStorageUsage,
  listDirectory,
  makeDirectory,
  moveItems,
  renameItem,
  uploadFile,
  type FtpFileInfo,
} from '../services/ftpService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext))
    return <Film className="w-4 h-4 text-purple-400 flex-shrink-0" />;
  if (['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a'].includes(ext))
    return <Music className="w-4 h-4 text-green-400 flex-shrink-0" />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext))
    return <Image className="w-4 h-4 text-pink-400 flex-shrink-0" />;
  if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2'].includes(ext))
    return <Archive className="w-4 h-4 text-orange-400 flex-shrink-0" />;
  if (['txt', 'md', 'log', 'json', 'xml', 'csv', 'nfo', 'srt', 'ass'].includes(ext))
    return <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />;
  return <File className="w-4 h-4 text-white/50 flex-shrink-0" />;
}

function joinPath(base: string, name: string): string {
  return base.endsWith('/') ? `${base}${name}` : `${base}/${name}`;
}

function buildBreadcrumbs(path: string): { label: string; path: string }[] {
  const parts = path.replace(/^\//, '').split('/').filter(Boolean);
  const crumbs = [{ label: '/', path: '/' }];
  let current = '';
  for (const part of parts) {
    current += `/${part}`;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
}

function sortItems(list: FtpFileInfo[]): FtpFileInfo[] {
  return [...list].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─── Sélecteur de dossier destination ────────────────────────────────────────

function MoveDialog({
  selectedNames,
  currentPath,
  onMove,
  onClose,
}: {
  selectedNames: string[];
  currentPath: string;
  onMove: (dest: string) => Promise<void>;
  onClose: () => void;
}) {
  const [browsePath, setBrowsePath] = useState('/');
  const [browseItems, setBrowseItems] = useState<FtpFileInfo[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBrowse = async (p: string) => {
    setBrowseLoading(true);
    setBrowseItems([]);
    try {
      const result = await listDirectory(p);
      setBrowseItems(sortItems(result).filter(i => i.isDirectory));
      setBrowsePath(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBrowseLoading(false);
    }
  };

  useEffect(() => { void loadBrowse('/'); }, []);

  const handleMove = async () => {
    setMoving(true);
    try {
      await onMove(browsePath);
      onClose();
    } catch (e: any) {
      setError(e.message);
      setMoving(false);
    }
  };

  const goUp = () => {
    const parts = browsePath.replace(/\/$/, '').split('/').filter(Boolean);
    parts.pop();
    void loadBrowse(parts.length === 0 ? '/' : `/${parts.join('/')}`);
  };

  const crumbs = buildBreadcrumbs(browsePath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div>
            <p className="text-sm font-semibold text-white">Déplacer vers…</p>
            <p className="text-xs text-white/40 mt-0.5">
              {selectedNames.length} élément{selectedNames.length > 1 ? 's' : ''} sélectionné{selectedNames.length > 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-wrap px-4 py-2 border-b border-white/5 bg-white/5">
          {browsePath !== '/' && (
            <button type="button" onClick={goUp} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {crumbs.map((c, i) => (
            <span key={c.path} className="flex items-center gap-1">
              {i > 0 && <span className="text-white/20 text-xs">/</span>}
              <button
                type="button"
                onClick={() => void loadBrowse(c.path)}
                disabled={i === crumbs.length - 1}
                className={`text-xs px-0.5 rounded ${i === crumbs.length - 1 ? 'text-white font-medium cursor-default' : 'text-cyan-400 hover:text-cyan-200'}`}
              >
                {c.label === '/' ? <HardDrive className="w-3 h-3" /> : c.label}
              </button>
            </span>
          ))}
        </div>

        {/* Liste dossiers */}
        <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
          {browseLoading ? (
            <div className="flex items-center justify-center py-8 text-white/30">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />Chargement…
            </div>
          ) : browseItems.length === 0 ? (
            <div className="py-8 text-center text-white/30 text-sm">Aucun sous-dossier</div>
          ) : (
            browseItems
              .filter(i => !selectedNames.includes(i.name) || currentPath !== browsePath)
              .map(item => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => void loadBrowse(joinPath(browsePath, item.name))}
                  className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors text-left"
                >
                  <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  {item.name}
                </button>
              ))
          )}
        </div>

        {/* Destination actuelle + confirmation */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/5 space-y-2">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/50 truncate">
              Destination&nbsp;: <span className="text-white font-mono">{browsePath}</span>
            </p>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="ghost" onClick={onClose} className="text-white/50 h-7">
                Annuler
              </Button>
              <Button
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white h-7"
                onClick={handleMove}
                disabled={moving}
              >
                {moving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><MoveRight className="w-3 h-3 mr-1" />Déplacer</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const CACHE_MAX = 40;

function lruSet(cache: Map<string, FtpFileInfo[]>, key: string, value: FtpFileInfo[]) {
  if (cache.has(key)) cache.delete(key); // rafraîchir la position
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
}

export function FtpExplorer() {
  const { user } = useAuth();
  const rootFolder = user?.settings?.ftp?.rootFolder || '/';

  const [path, setPath] = useState(rootFolder);
  const [items, setItems] = useState<FtpFileInfo[]>([]);
  const [loading, setLoading] = useState(false);   // premier chargement d'un chemin non caché
  const [refreshing, setRefreshing] = useState(false); // rafraîchissement silencieux en arrière-plan
  const [error, setError] = useState<string | null>(null);

  // Cache LRU : path → contenu trié
  const dirCache = useRef<Map<string, FtpFileInfo[]>>(new Map());
  // Prefetch en cours : évite les doublons
  const prefetchInFlight = useRef<Set<string>>(new Set());

  // Storage
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageLimit, setStorageLimit] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  // Sélection multiple
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Actions unitaires
  const [renamingItem, setRenamingItem] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Nouveau dossier
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Upload
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Confirmation de suppression (unitaire ou groupée)
  const [pendingDelete, setPendingDelete] = useState<FtpFileInfo[] | null>(null);

  // Modal déplacement
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  // Tri colonnes
  const [sortCol, setSortCol] = useState<'name' | 'size'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSortClick = (col: 'name' | 'size') => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // ── Préchargement silencieux ─────────────────────────────────────────────

  const prefetchPath = useCallback((targetPath: string) => {
    if (prefetchInFlight.current.has(targetPath) || dirCache.current.has(targetPath)) return;
    prefetchInFlight.current.add(targetPath);
    listDirectory(targetPath)
      .then(result => { lruSet(dirCache.current, targetPath, sortItems(result)); })
      .catch(() => {})
      .finally(() => { prefetchInFlight.current.delete(targetPath); });
  }, []);

  const prefetchNeighbours = useCallback((targetPath: string, loadedItems: FtpFileInfo[]) => {
    // Précharger le dossier parent
    const parts = targetPath.replace(/\/$/, '').split('/').filter(Boolean);
    if (parts.length > 0) {
      const parent = parts.length === 1 ? '/' : `/${parts.slice(0, -1).join('/')}`;
      prefetchPath(parent);
    }
    // Précharger tous les sous-dossiers (idle callback si disponible, sinon setTimeout)
    const subdirs = loadedItems.filter(i => i.isDirectory);
    const schedule = typeof window.requestIdleCallback === 'function'
      ? (fn: () => void) => window.requestIdleCallback(fn, { timeout: 3000 })
      : (fn: () => void) => setTimeout(fn, 300);
    schedule(() => {
      for (const dir of subdirs) {
        prefetchPath(joinPath(targetPath, dir.name));
      }
    });
  }, [prefetchPath]);

  // ── Chargement principal ─────────────────────────────────────────────────

  const load = useCallback(async (targetPath: string, { silent = false, invalidate = false } = {}) => {
    if (invalidate) dirCache.current.delete(targetPath);

    const cached = dirCache.current.get(targetPath);

    if (cached && !silent) {
      // Affichage instantané depuis le cache
      setItems(cached);
      setLoading(false);
      setRefreshing(true); // indicateur discret de rafraîchissement
    } else if (!cached) {
      setLoading(true);
      setItems([]);
    }

    setError(null);
    setRenamingItem(null);
    setCreatingFolder(false);
    setPendingDelete(null);

    try {
      const result = await listDirectory(targetPath);
      const sorted = sortItems(result);
      lruSet(dirCache.current, targetPath, sorted);
      setItems(sorted);
      prefetchNeighbours(targetPath, sorted);
    } catch (e: any) {
      if (!cached) setError(e.message || 'Erreur lors du chargement.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [prefetchNeighbours]);

  // Invalider le cache du chemin courant après une mutation
  const invalidateCurrent = useCallback(() => {
    dirCache.current.delete(path);
  }, [path]);

  useEffect(() => {
    setSelected(new Set());
    void load(path);
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshStorage = useCallback(async () => {
    setStorageLoading(true);
    try {
      const { used, limit } = await getStorageUsage();
      setStorageUsed(used);
      setStorageLimit(limit);
    } catch {}
    finally { setStorageLoading(false); }
  }, []);

  useEffect(() => {
    void refreshStorage();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (newPath: string) => setPath(newPath);

  const goUp = () => {
    const parts = path.replace(/\/$/, '').split('/').filter(Boolean);
    parts.pop();
    const parent = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    // Ne pas remonter au-dessus de rootFolder
    if (parent.length < rootFolder.replace(/\/$/, '').length) return;
    setPath(parent);
  };

  // ── Sélection ────────────────────────────────────────────────────────────

  const toggleSelect = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.name)));
  };

  // ── Supprimer (groupé) ───────────────────────────────────────────────────

  const handleDeleteBatch = async (toDelete: FtpFileInfo[]) => {
    const payload = toDelete.map(i => ({ path: joinPath(path, i.name), isDirectory: i.isDirectory }));
    setSelected(new Set());
    setPendingDelete(null);
    const names = new Set(toDelete.map(i => i.name));
    // Optimiste
    const applyDelete = (list: FtpFileInfo[]) => list.filter(i => !names.has(i.name));
    setItems(prev => applyDelete(prev));
    invalidateCurrent();
    try {
      const result = await deleteBatch(payload);
      if (result.failed.length > 0) {
        const failedNames = new Set(result.failed.map(f => f.path.split('/').pop()));
        const toRestore = toDelete.filter(i => failedNames.has(i.name));
        setItems(prev => sortItems([...prev, ...toRestore]));
        setError(`${result.failed.length} élément(s) n'ont pas pu être supprimés.`);
      } else {
        // Mettre à jour le cache avec la version courante
        dirCache.current.set(path, applyDelete(dirCache.current.get(path) ?? []));
      }
    } catch (e: any) {
      setItems(prev => sortItems([...prev, ...toDelete]));
      setError(e.message);
    }
  };

  const handleDeleteSelected = () => {
    setPendingDelete(items.filter(i => selected.has(i.name)));
  };

  const handleDeleteSingle = (item: FtpFileInfo) => {
    setPendingDelete([item]);
  };

  // ── Renommer ────────────────────────────────────────────────────────────

  const startRename = (item: FtpFileInfo) => {
    setRenamingItem(item.name);
    setRenameValue(item.name);
  };

  const handleRename = async (oldName: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) { setRenamingItem(null); return; }
    const oldFull = joinPath(path, oldName);
    const newFull = joinPath(path, trimmed);
    setRenamingItem(null);
    setActionInProgress(oldName);
    invalidateCurrent();
    const applyRename = (list: FtpFileInfo[]) => sortItems(list.map(i => i.name === oldName ? { ...i, name: trimmed } : i));
    setItems(prev => applyRename(prev));
    try {
      await renameItem(oldFull, newFull);
      dirCache.current.set(path, applyRename(dirCache.current.get(path) ?? []));
    } catch (e: any) {
      setItems(prev => sortItems(prev.map(i => i.name === trimmed ? { ...i, name: oldName } : i)));
      setError(e.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // ── Déplacer (sélection) ─────────────────────────────────────────────────

  const handleMove = async (destDir: string) => {
    const toMove = items.filter(i => selected.has(i.name));
    const sourcePaths = toMove.map(i => joinPath(path, i.name));
    setSelected(new Set());
    const names = new Set(toMove.map(i => i.name));
    setItems(prev => prev.filter(i => !names.has(i.name)));
    invalidateCurrent();
    // Invalider aussi la destination (son contenu va changer)
    dirCache.current.delete(destDir);
    try {
      const result = await moveItems(sourcePaths, destDir);
      if (result.failed.length > 0) {
        const failedNames = new Set(result.failed.map(f => f.path.split('/').pop()));
        const toRestore = toMove.filter(i => failedNames.has(i.name));
        setItems(prev => sortItems([...prev, ...toRestore]));
        setError(`${result.failed.length} élément(s) n'ont pas pu être déplacés.`);
      }
    } catch (e: any) {
      setItems(prev => sortItems([...prev, ...toMove]));
      setError(e.message);
    }
  };

  // ── Créer dossier ────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const name = newFolderName.trim();
    const fullPath = joinPath(path, name);
    setActionInProgress('mkdir');
    setCreatingFolder(false);
    setNewFolderName('');
    invalidateCurrent();
    const newEntry: FtpFileInfo = { name, type: 2, size: 0, rawModifiedAt: '', isDirectory: true, isFile: false, isSymbolicLink: false };
    setItems(prev => sortItems([...prev, newEntry]));
    try {
      await makeDirectory(fullPath);
      dirCache.current.set(path, sortItems([...(dirCache.current.get(path) ?? []), newEntry]));
    } catch (e: any) {
      setItems(prev => prev.filter(i => i.name !== name));
      setError(e.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // ── Upload ───────────────────────────────────────────────────────────────

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const remotePath = joinPath(path, file.name);
    setUploadProgress(0);
    try {
      await uploadFile(remotePath, file, setUploadProgress);
      const newEntry: FtpFileInfo = { name: file.name, type: 1, size: file.size, rawModifiedAt: '', isDirectory: false, isFile: true, isSymbolicLink: false };
      setItems(prev => sortItems([...prev.filter(i => i.name !== file.name), newEntry]));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadProgress(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  const breadcrumbs = buildBreadcrumbs(path);
  const storagePercent = storageUsed !== null && storageLimit
    ? Math.min(100, Math.round((storageUsed / storageLimit) * 100))
    : null;
  const hasSelection = selected.size > 0;
  const allSelected = items.length > 0 && selected.size === items.length;

  const sortedItems = [...items].sort((a, b) => {
    // Dossiers toujours en premier
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    const mul = sortDir === 'asc' ? 1 : -1;
    if (sortCol === 'size') return mul * ((a.size ?? 0) - (b.size ?? 0));
    return mul * a.name.localeCompare(b.name);
  });

  const SortIcon = ({ col }: { col: 'name' | 'size' }) => {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 ml-0.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-0.5" />
      : <ChevronDown className="w-3 h-3 ml-0.5" />;
  };

  return (
    <div className="space-y-4">
      {/* Modal déplacement */}
      {showMoveDialog && (
        <MoveDialog
          selectedNames={[...selected]}
          currentPath={path}
          onMove={handleMove}
          onClose={() => setShowMoveDialog(false)}
        />
      )}

      {/* Modal confirmation suppression */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-base font-semibold text-white">
                Supprimer {pendingDelete.length} élément{pendingDelete.length > 1 ? 's' : ''} ?
              </p>
              <p className="text-xs text-white/40 mt-1">Cette action est irréversible.</p>
            </div>
            <ul className="max-h-40 overflow-y-auto divide-y divide-white/5 px-5 py-2">
              {pendingDelete.slice(0, 8).map(item => (
                <li key={item.name} className="flex items-center gap-2 py-1.5 text-sm text-white/70">
                  {getFileIcon(item.name, item.isDirectory)}
                  <span className="truncate">{item.name}</span>
                </li>
              ))}
              {pendingDelete.length > 8 && (
                <li className="py-1.5 text-xs text-white/30 italic">
                  …et {pendingDelete.length - 8} autre{pendingDelete.length - 8 > 1 ? 's' : ''}
                </li>
              )}
            </ul>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/10 bg-white/5">
              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(null)}
                className="text-white/50 hover:text-white h-8">
                Annuler
              </Button>
              <Button size="sm" onClick={() => void handleDeleteBatch(pendingDelete)}
                className="bg-red-600 hover:bg-red-700 text-white h-8">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Supprimer{pendingDelete.length > 1 ? ` (${pendingDelete.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes fichiers</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {storageLoading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-white/30" />
                <span className="text-sm text-white/30">Calcul du stockage…</span>
              </>
            ) : storageUsed !== null ? (
              <>
                <span className="text-sm text-white/50">
                  {formatSize(storageUsed)} utilisés{storageLimit ? ` / ${formatSize(storageLimit)}` : ''}
                </span>
                <button type="button" onClick={refreshStorage}
                  className="text-white/20 hover:text-white/60 transition-colors" title="Actualiser le stockage">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input ref={uploadInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => uploadInputRef.current?.click()} disabled={uploadProgress !== null}>
            {uploadProgress !== null
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{uploadProgress}%</>
              : <><Upload className="w-4 h-4 mr-1" />Uploader</>}
          </Button>
          <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            onClick={() => { setCreatingFolder(true); setNewFolderName(''); }}>
            <FolderPlus className="w-4 h-4 mr-1" />
            Nouveau dossier
          </Button>
          <Button size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => load(path, { invalidate: true })} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Barre de stockage */}
      {storageLoading ? (
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-white/20 animate-pulse" />
        </div>
      ) : storagePercent !== null ? (
        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${storagePercent > 90 ? 'bg-red-500' : storagePercent > 70 ? 'bg-amber-500' : 'bg-cyan-500'}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
      ) : null}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 flex-wrap">
        {/* Flèche retour — toujours visible, grisée à la racine */}
        {(() => {
          const atRoot = path === rootFolder.replace(/\/$/, '') || path === rootFolder;
          return (
            <button type="button" onClick={goUp} disabled={atRoot}
              title={atRoot ? 'Racine' : 'Dossier parent'}
              className={`p-1 rounded transition-colors ${
                atRoot
                  ? 'text-white/20 cursor-default'
                  : 'hover:bg-white/10 text-white/60 hover:text-white'
              }`}>
              <ArrowLeft className="w-4 h-4" />
            </button>
          );
        })()}
        {breadcrumbs
          .filter(crumb => crumb.label !== '/' || crumb.path === rootFolder.replace(/\/$/, '') || crumb.path === rootFolder)
          .map((crumb, i, arr) => {
            const isRoot = crumb.path === rootFolder.replace(/\/$/, '') || crumb.path === rootFolder;
            const isAboveRoot = !isRoot && !crumb.path.startsWith(rootFolder.endsWith('/') ? rootFolder : rootFolder + '/');
            const isCurrent = i === arr.length - 1;
            return (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <span className="text-white/30 text-sm">/</span>}
                <button
                  type="button"
                  onClick={() => !isAboveRoot && !isCurrent && navigate(crumb.path)}
                  disabled={isCurrent || isAboveRoot}
                  className={`text-sm px-1 rounded transition-colors ${
                    isCurrent
                      ? 'text-white font-medium cursor-default'
                      : isAboveRoot
                      ? 'text-white/20 cursor-default'
                      : 'text-cyan-400 hover:text-cyan-200 hover:bg-white/5'
                  }`}
                >
                  {isRoot ? (
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      {crumb.label !== '/' && <span>{crumb.label}</span>}
                    </span>
                  ) : crumb.label}
                </button>
              </span>
            );
          })}
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
          <button type="button" onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Barre d'actions groupées */}
      {hasSelection && (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2">
          <span className="text-sm text-white/70 flex-1">
            {selected.size} élément{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShowMoveDialog(true)}
            className="text-cyan-300 hover:text-cyan-100 hover:bg-white/10 h-7">
            <MoveRight className="w-3.5 h-3.5 mr-1" />Déplacer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteSelected()}
            className="text-red-400 hover:text-red-200 hover:bg-red-500/10 h-7">
            <Trash2 className="w-3.5 h-3.5 mr-1" />Supprimer ({selected.size})
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-white/30 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Formulaire nouveau dossier */}
      {creatingFolder && (
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-950/20 px-3 py-2">
          <FolderPlus className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <input autoFocus type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false); }}
            placeholder="Nom du dossier"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" />
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white h-7 px-3"
            onClick={handleCreateFolder} disabled={actionInProgress === 'mkdir'}>
            {actionInProgress === 'mkdir' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Créer'}
          </Button>
          <button type="button" onClick={() => setCreatingFolder(false)} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
        {/* En-tête colonnes */}
        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-4 py-2 text-xs text-white/30 uppercase tracking-wider border-b border-white/5">
          <button type="button" onClick={toggleSelectAll} className="flex items-center text-white/30 hover:text-white/60 transition-colors">
            {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => handleSortClick('name')}
            className={`flex items-center transition-colors hover:text-white/70 ${sortCol === 'name' ? 'text-white/60' : ''}`}>
            Nom<SortIcon col="name" />
          </button>
          <button type="button" onClick={() => handleSortClick('size')}
            className={`flex items-center justify-end w-24 transition-colors hover:text-white/70 ${sortCol === 'size' ? 'text-white/60' : ''}`}>
            Taille<SortIcon col="size" />
          </button>
          <span className="w-20" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-white/40 text-sm">Dossier vide</div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedItems.map(item => {
              const isRenaming = renamingItem === item.name;
              const busy = actionInProgress === item.name;
              const isSelected = selected.has(item.name);
              const fullPath = joinPath(path, item.name);

              return (
                <div
                  key={item.name}
                  className={`grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-4 py-2.5 group transition-colors
                    ${isSelected ? 'bg-cyan-950/30' : 'hover:bg-white/5'}`}
                >
                  {/* Checkbox */}
                  <button type="button" onClick={() => toggleSelect(item.name)}
                    className="flex items-center text-white/20 hover:text-white/60 transition-colors">
                    {isSelected
                      ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      : <Square className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100" />}
                  </button>

                  {/* Nom */}
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon(item.name, item.isDirectory)}
                    {isRenaming ? (
                      <input autoFocus type="text" value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleRename(item.name); if (e.key === 'Escape') setRenamingItem(null); }}
                        onBlur={() => void handleRename(item.name)}
                        className="flex-1 bg-slate-800 border border-cyan-500/50 rounded px-2 py-0.5 text-sm text-white outline-none min-w-0" />
                    ) : item.isDirectory ? (
                      <button type="button" onClick={() => navigate(fullPath)}
                        className="text-sm text-white truncate hover:text-cyan-300 transition-colors text-left">
                        {item.name}
                      </button>
                    ) : (
                      <span className="text-sm text-white/80 truncate">{item.name}</span>
                    )}
                  </div>

                  {/* Taille */}
                  <span className="text-xs text-white/40 text-right w-24 tabular-nums">
                    {item.isDirectory ? '—' : formatSize(item.size)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 w-20 justify-end">
                    <>
                      {!item.isDirectory && (
                        <a href={getDownloadUrl(fullPath)} download={item.name}
                          className="p-1 rounded text-white/0 group-hover:text-white/50 hover:!text-cyan-300 hover:bg-white/10 transition-colors"
                          title="Télécharger">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button type="button" onClick={() => startRename(item)} disabled={busy}
                        className="p-1 rounded text-white/0 group-hover:text-white/50 hover:!text-amber-300 hover:bg-white/10 transition-colors"
                        title="Renommer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDeleteSingle(item)} disabled={busy}
                        className="p-1 rounded text-white/0 group-hover:text-white/50 hover:!text-red-400 hover:bg-white/10 transition-colors"
                        title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
