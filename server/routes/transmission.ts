import { Router } from 'express';
import { authentication } from '../modules/auth';
import {
  configureTransmission,
  getDownloadsTransmission,
  getTransmissionSettings,
  performTransmissionAction,
  startDownload,
  unmanageTorrentForUser,
} from '../modules/transmission';
import { TransmissionSettings } from '../../common/settings';
import { TorrentDownloadsResponse } from '../../common/torrent';

const router = Router();
router.use(authentication);

router.get('/transmission/configure', async (req, res) => {
  const userId = req.user.id;
  let transmissionSettings = await getTransmissionSettings(userId);
  if (transmissionSettings && 'password' in transmissionSettings) {
    delete transmissionSettings.password; // Do not send password to client
  }
  res.status(200).json(transmissionSettings);
});

router.post('/transmission/configure', async (req, res) => {
  if (!req.body) {
    res.status(400).json({ error: 'Request body is required' });
    return;
  }
  const setting: TransmissionSettings = {
    host: String(req.body?.host || '').trim(),
    port: Number(req.body?.port || 0),
    authRequired: Boolean(req.body?.authRequired || false),
    username: String(req.body?.username || '').trim(),
    password: String(req.body?.password || '').trim(),
    moviesFolder: String(req.body?.moviesFolder || '/').trim(),
    seriesFolder: String(req.body?.seriesFolder || '/').trim(),
  };
  await configureTransmission(req.user.id, setting);
  res.status(200).json({ message: 'Transmission settings configured successfully' });
});

router.get('/transmission/downloads', async (req, res) => {
  const items = await getDownloadsTransmission(req.user.id, req.query);
  const response: TorrentDownloadsResponse = {
    ok: true,
    activeCount: items.length,
    torrents: items,
  };
  res.status(200).json(response);
});

router.post('/transmission/resume/:id', async (req, res) => {
  const id = Number(req.params.id);
  await performTransmissionAction('torrent-start', req.user.id, id);
  res.status(200).json({ status: 'ok' });
});

router.post('/transmission/pause/:id', async (req, res) => {
  const id = Number(req.params.id);
  await performTransmissionAction('torrent-stop', req.user.id, id);
  res.status(200).json({ status: 'ok' });
});

router.post('/transmission/delete/:id', async (req, res) => {
  const id = Number(req.params.id);
  await performTransmissionAction('torrent-remove', req.user.id, id);
  res.status(200).json({ status: 'ok' });
});

router.post('/transmission/unmanage', async (req, res) => {
  const hash = String(req.body?.hash || '').trim();
  if (!hash) {
    res.status(400).json({ error: 'hash is required' });
    return;
  }

  const removed = unmanageTorrentForUser(req.user.id, hash);
  if (!removed) {
    res.status(404).json({ error: 'Managed torrent not found' });
    return;
  }

  res.status(200).json({ ok: true, message: 'Torrent unmanaged successfully' });
});

// Route for starting a download with url
router.post('/transmission/add', async (req, res) => {
  const mediaType = String(req.body?.mediaType || '').trim();
  const guid = String(req.body?.guid || '').trim();
  await startDownload(req.user.id, guid, mediaType);
  res.status(200).json({ status: 'ok' });
});

export { router };
