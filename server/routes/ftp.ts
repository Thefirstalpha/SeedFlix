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
  transcodeToStream,
  uploadFromStream,
} from '../modules/ftp';

const router = Router();
router.use(authentication);

// ─── Config ──────────────────────────────────────────────────────────────────

router.get('/ftp/config', (req, res) => {
  try {
    const settings = getFtpSettings(req.user.id);
    const hasPassword = Boolean(settings.password && settings.password.trim().length > 0);
    // Ne pas exposer le mot de passe
    const { password: _pw, ...safe } = settings;
    res.json({ ok: true, config: { ...safe, hasPassword } });
  } catch {
    res.json({ ok: true, config: null });
  }
});

router.post('/ftp/configure', async (req, res) => {
  if (!req.body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }
  let currentSettings: FtpSettings | null = null;
  try {
    currentSettings = getFtpSettings(req.user.id);
  } catch {
    // Not yet configured
  }

  const authRequired = Boolean(req.body?.authRequired || false);
  const incomingPassword = req.body?.password !== undefined ? String(req.body.password).trim() : '';
  const password =
    authRequired &&
    (!incomingPassword || incomingPassword === '***********' || incomingPassword.includes('•'))
      ? currentSettings?.password || ''
      : incomingPassword;

  const setting: FtpSettings = {
    host: String(req.body?.host || '').trim(),
    port: Number(req.body?.port || 21),
    secure: Boolean(req.body?.secure || false),
    authRequired,
    username:
      req.body?.username !== undefined ? String(req.body?.username || '').trim() : undefined,
    password: authRequired ? password : undefined,
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

router.head('/ftp/stream', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!path) {
    res.status(400).end();
    return;
  }
  const filename = path.split('/').pop() || 'file';
  const mimeType = getMimeType(filename);
  try {
    const size = await getFileSize(req.user.id, path);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', size);
    res.status(200).end();
  } catch {
    res.status(500).end();
  }
});

router.get('/ftp/stream', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const filename = path.split('/').pop() || 'file';
  const mimeType = getMimeType(filename);

  let fileSize: number | null = null;
  try {
    fileSize = await getFileSize(req.user.id, path);
  } catch {
    // Taille non disponible, on continue en mode stream direct
  }

  const rangeHeader = req.headers.range;

  if (rangeHeader && fileSize !== null && fileSize > 0) {
    const parts = rangeHeader
      .replace(/bytes=/, '')
      .trim()
      .split('-');
    let start = parseInt(parts[0], 10);
    let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start)) {
      start = fileSize - end;
      end = fileSize - 1;
    }

    if (isNaN(end) || end >= fileSize) {
      end = fileSize - 1;
    }

    if (start < 0 || start > end || start >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).end();
      return;
    }

    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);

    try {
      await downloadToStream(req.user.id, path, res, start, chunkSize);
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
    }
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    if (fileSize !== null) {
      res.setHeader('Content-Length', fileSize);
    }

    try {
      await downloadToStream(req.user.id, path, res, 0);
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
    }
  }
});

router.get('/ftp/transcode', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const startTime = req.query.startTime ? Number(req.query.startTime) : 0;
  const force = req.query.force === 'true';
  const filename = path.split('/').pop() || 'video';
  const baseName = filename.replace(/\.[^/.]+$/, '');

  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}.mp4"`);
  res.setHeader('Content-Type', 'video/mp4');

  try {
    await transcodeToStream(req.user.id, path, res, {
      startTime: isNaN(startTime) ? 0 : startTime,
      forceTranscode: force,
    });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/ftp/playlist.m3u', (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const filename = path.split('/').pop() || 'video';
  const host = req.get('host') || 'localhost:4000';
  const protocol = req.protocol;
  const streamUrl = `${protocol}://${host}/api/ftp/stream?path=${encodeURIComponent(path)}`;

  const m3uContent = `#EXTM3U\n#EXTINF:-1,${filename}\n${streamUrl}\n`;

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}.m3u"`,
  );
  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.send(m3uContent);
});

router.get('/ftp/download', async (req, res) => {
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  if (!path) {
    res.status(400).json({ error: 'path requis' });
    return;
  }
  const filename = path.split('/').pop() || 'file';
  const isInline =
    typeof req.query.inline === 'string' && req.query.inline.toLowerCase() === 'true';
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
  const pathQuery = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  const pathBody = typeof req.body?.path === 'string' ? req.body.path.trim() : '';
  const path = pathQuery || pathBody;
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
  const path = typeof req.query.path === 'string' ? req.query.path.trim() : '';
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
