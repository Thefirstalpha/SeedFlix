import { Router } from 'express';
import { authentication } from '../modules/auth';
import { FtpSettings } from '../../common/settings';
import {
  configureFtp,
  downloadToStream,
  getFileSize,
  getFtpSettings,
  getLastModified,
  getStorageUsage,
  listDirectory,
  makeDirectory,
  moveBatch,
  removeBatch,
  removeDirectory,
  removeFile,
  rename,
  testFtpConnection,
  testFtpConnectionWithSettings,
  uploadFromStream,
} from '../modules/ftp';

const router = Router();
router.use(authentication);

// ─── Config ──────────────────────────────────────────────────────────────────

router.get('/ftp/config', (req, res) => {
  try {
    const settings = getFtpSettings(req.user.id);
    // Ne pas exposer le mot de passe
    const { password: _pw, ...safe } = settings;
    res.json({ ok: true, config: safe });
  } catch {
    res.json({ ok: true, config: null });
  }
});

router.post('/ftp/configure', async (req, res) => {
  if (!req.body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }
  const setting: FtpSettings = {
    host: String(req.body?.host || '').trim(),
    port: Number(req.body?.port || 21),
    secure: Boolean(req.body?.secure || false),
    authRequired: Boolean(req.body?.authRequired || false),
    username:
      req.body?.username !== undefined ? String(req.body?.username || '').trim() : undefined,
    password:
      req.body?.password !== undefined ? String(req.body?.password || '').trim() : undefined,
    rootFolder: String(req.body?.rootFolder || '/').trim(),
    storageLimit: req.body?.storageLimit !== undefined ? Number(req.body?.storageLimit) : null,
  };
  const test = await testFtpConnectionWithSettings(setting);
  if (!test.ok) {
    res.status(400).json({
      ok: false,
      error: test.error || 'Connexion FTP échouée, configuration non sauvegardée.',
    });
    return;
  }
  await configureFtp(req.user.id, setting);
  res.json({ ok: true });
});

// ─── Test connexion ───────────────────────────────────────────────────────────

router.post('/ftp/test', async (req, res) => {
  const result = await testFtpConnection(req.user.id);
  res.json(result);
});

// ─── Navigation ──────────────────────────────────────────────────────────────

router.get('/ftp/list', async (req, res) => {
  const path = String(req.query.path || '/');
  try {
    const items = await listDirectory(req.user.id, path);
    res.json({
      ok: true,
      items: items.map((item) => ({
        name: item.name,
        type: item.type,
        size: item.size,
        rawModifiedAt: item.rawModifiedAt,
        isDirectory: item.isDirectory,
        isFile: item.isFile,
        isSymbolicLink: item.isSymbolicLink,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Gestion des fichiers ─────────────────────────────────────────────────────

router.post('/ftp/mkdir', async (req, res) => {
  const path = String(req.body?.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  try {
    await makeDirectory(req.user.id, path);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/ftp/file', async (req, res) => {
  const path = String(req.body?.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  try {
    await removeFile(req.user.id, path);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/ftp/directory', async (req, res) => {
  const path = String(req.body?.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  try {
    await removeDirectory(req.user.id, path);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Suppression groupée (connexion unique réutilisée)
router.post('/ftp/delete-batch', async (req, res) => {
  const items: { path: string; isDirectory: boolean }[] = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items requis (array)' });
    return;
  }
  try {
    const result = await removeBatch(req.user.id, items);
    res.json({ ok: result.failed.length === 0, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/ftp/rename', async (req, res) => {
  const oldPath = String(req.body?.oldPath || '').trim();
  const newPath = String(req.body?.newPath || '').trim();
  if (!oldPath || !newPath) {
    res.status(400).json({ error: 'oldPath et newPath requis' });
    return;
  }
  try {
    await rename(req.user.id, oldPath, newPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Déplacement groupé vers un dossier destination (connexion unique réutilisée)
router.post('/ftp/move', async (req, res) => {
  const paths: string[] = req.body?.paths;
  const destinationDir = String(req.body?.destinationDir || '').trim();
  if (!Array.isArray(paths) || paths.length === 0 || !destinationDir) {
    res.status(400).json({ error: 'paths et destinationDir requis' });
    return;
  }
  try {
    const result = await moveBatch(req.user.id, paths, destinationDir);
    res.json({ ok: result.failed.length === 0, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  srt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  json: 'application/json',
  pdf: 'application/pdf',
};

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

// ─── Transfert & Streaming ───────────────────────────────────────────────────

router.get('/ftp/stream', async (req, res) => {
  const path = String(req.query.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const filename = path.split('/').pop() || 'file';
  const mimeType = getMimeType(filename);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Accept-Ranges', 'bytes');
  try {
    const size = await getFileSize(req.user.id, path);
    res.setHeader('Content-Length', size);
  } catch {
    // taille non disponible, on continue sans header
  }
  try {
    await downloadToStream(req.user.id, path, res);
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/ftp/download', async (req, res) => {
  const path = String(req.query.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const filename = path.split('/').pop() || 'file';
  const isInline = String(req.query.inline || '').toLowerCase() === 'true';
  const mimeType = isInline ? getMimeType(filename) : 'application/octet-stream';
  res.setHeader(
    'Content-Disposition',
    `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`,
  );
  res.setHeader('Content-Type', mimeType);
  try {
    const size = await getFileSize(req.user.id, path);
    res.setHeader('Content-Length', size);
  } catch {
    // taille non disponible, on continue sans header
  }
  try {
    await downloadToStream(req.user.id, path, res);
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/ftp/upload', async (req, res) => {
  const path = String(req.query.path || req.body?.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  try {
    await uploadFromStream(req.user.id, req, path);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Stockage ─────────────────────────────────────────────────────────────────

router.get('/ftp/storage', async (req, res) => {
  try {
    const usage = await getStorageUsage(req.user.id);
    res.json({ ok: true, ...usage });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/ftp/info', async (req, res) => {
  const path = String(req.query.path || '').trim();
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  try {
    const [size, lastMod] = await Promise.all([
      getFileSize(req.user.id, path).catch(() => null),
      getLastModified(req.user.id, path).catch(() => null),
    ]);
    res.json({ ok: true, size, lastModified: lastMod });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export { router };
