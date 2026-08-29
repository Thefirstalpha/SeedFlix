import { Router } from 'express';
import { authentication } from '../modules/auth';
import { addClient, buildUserStatusBar, emitToUser, removeClient } from '../modules/events';
import { getDownloadsTransmission, getTransmissionStats } from '../modules/transmission';

const router = Router();
router.use(authentication);

router.get('/events', async (req, res) => {
  const userId = req.user.id;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Flush headers if available
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  // Register client
  addClient(userId, res);

  // Send initial connected event
  res.write(': connected\n\n');

  // Send initial status bar state
  try {
    const statusBar = await buildUserStatusBar(userId);
    emitToUser(userId, 'statusBar', statusBar);
  } catch (err) {
    console.error(`Error sending initial status bar via SSE for user ${userId}:`, err);
  }

  // Send initial downloads if transmission is available
  try {
    const torrents = await getDownloadsTransmission(userId, { includeAll: true });
    const stats = await getTransmissionStats(userId).catch(() => undefined);
    emitToUser(userId, 'downloads', { torrents, stats });
  } catch {
    /* Transmission non configuré ou hors-ligne */
  }

  // Clean up on disconnect
  req.on('close', () => {
    removeClient(userId, res);
  });
});

export { router };

