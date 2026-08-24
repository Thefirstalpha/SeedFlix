import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initDB, resetDatabase, writeStore } from '../../../server/modules/db';
import { startDownloadWatcher } from '../../../server/modules/downloadWatcher';
import { createUser, updateUser } from '../../../server/modules/user';
import * as transmissionModule from '../../../server/modules/transmission';
import { getNotifications } from '../../../server/modules/notification';

describe('downloadWatcher module', () => {
  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('should poll users and notify when managed torrent finishes', async () => {
    const { user } = createUser('watcherUser');
    user.settings.transmission = {
      host: 'http://transmission.local',
      port: 9091,
      authRequired: false,
      username: '',
      password: '',
      moviesFolder: '/movies',
      seriesFolder: '/series',
    };
    updateUser(user);

    writeStore('transmission.app-torrents', user.id, [
      {
        hash: 'hash-complete',
        link: 'https://torrent.link',
        name: 'Fight Club',
        addedAt: new Date().toISOString(),
        completedNotifiedAt: null,
      },
    ]);

    const getDownloadsSpy = vi.spyOn(transmissionModule, 'getDownloadsTransmission').mockResolvedValue([
      {
        id: 1,
        hashString: 'hash-complete',
        name: 'Fight Club 1080p',
        status: 6,
        statusLabel: 'Seeding',
        progress: 100,
        rateDownload: 0,
        rateUpload: 0,
        eta: 0,
        totalSize: 1000000,
        downloadDir: '/movies',
        addedDate: 0,
        isFinished: true,
        leftUntilDone: 0,
        peersConnected: 10,
        error: 0,
        errorString: '',
        managedBySeedflix: true,
        uploadRatio: 1,
        uploadedEver: 1000000,
      },
    ]);

    startDownloadWatcher();

    // Allow promise resolution
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(getDownloadsSpy).toHaveBeenCalled();
    const notifications = getNotifications(user.id);
    expect(notifications.notifications.length).toBeGreaterThan(0);
    expect(notifications.notifications[0].title).toBe('Téléchargement terminé');
  });

  it('should ignore torrents that are already notified or incomplete', async () => {
    const { user } = createUser('watcherUser2');
    user.settings.transmission = {
      host: 'http://transmission.local',
      port: 9091,
      authRequired: false,
      username: '',
      password: '',
      moviesFolder: '/movies',
      seriesFolder: '/series',
    };
    updateUser(user);

    writeStore('transmission.app-torrents', user.id, [
      {
        hash: 'hash-incomplete',
        link: 'https://torrent.link',
        name: 'Incomplete Movie',
        addedAt: new Date().toISOString(),
        completedNotifiedAt: null,
      },
    ]);

    vi.spyOn(transmissionModule, 'getDownloadsTransmission').mockResolvedValue([
      {
        id: 2,
        hashString: 'hash-incomplete',
        name: 'Incomplete Movie',
        status: 4,
        statusLabel: 'Downloading',
        progress: 50,
        rateDownload: 1000,
        rateUpload: 0,
        eta: 100,
        totalSize: 1000000,
        downloadDir: '/movies',
        addedDate: 0,
        isFinished: false,
        leftUntilDone: 500000,
        peersConnected: 5,
        error: 0,
        errorString: '',
        managedBySeedflix: true,
        uploadRatio: 0,
        uploadedEver: 0,
      },
    ]);

    startDownloadWatcher();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const notifications = getNotifications(user.id);
    expect(notifications.notifications).toHaveLength(0);
  });
});

