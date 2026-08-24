import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initDB, resetDatabase, writeStore } from '../../../server/modules/db';
import {
  configureTransmission,
  getDownloadsTransmission,
  getManagedTorrents,
  getTransmissionSettings,
  getTransmissionStats,
  markManagedTorrentCompleted,
  performTransmissionAction,
  startDownload,
  unmanageTorrentForUser,
} from '../../../server/modules/transmission';
import { createUser, updateUser } from '../../../server/modules/user';
import { TransmissionSettings } from '../../../common/settings';

describe('transmission module', () => {
  let userId: number;
  const sampleSettings: TransmissionSettings = {
    host: 'http://transmission.local',
    port: 9091,
    authRequired: true,
    username: 'admin',
    password: 'password',
    moviesFolder: '/downloads/movies',
    seriesFolder: '/downloads/series',
  };

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
    const { user } = createUser('transmissionUser');
    userId = user.id;
  });

  describe('Managed Torrents Storage', () => {
    it('should return empty list when no managed torrents exist', () => {
      const managed = getManagedTorrents(userId);
      expect(managed).toEqual([]);
    });

    it('should filter corrupted entries and return valid managed torrents', () => {
      writeStore('transmission.app-torrents', userId, [
        { hash: 'valid-hash', link: 'https://link', name: 'Valid' },
        { hash: '', link: '' },
      ]);
      const managed = getManagedTorrents(userId);
      expect(managed).toHaveLength(1);
      expect(managed[0].hash).toBe('valid-hash');
    });

    it('should mark managed torrent as completed and avoid re-notifying', () => {
      writeStore('transmission.app-torrents', userId, [
        { hash: 'hash-123', link: 'https://link', name: 'Movie' },
      ]);

      const shouldNotifyFirst = markManagedTorrentCompleted(userId, 'hash-123');
      expect(shouldNotifyFirst).toBe(true);

      const shouldNotifySecond = markManagedTorrentCompleted(userId, 'hash-123');
      expect(shouldNotifySecond).toBe(false);
    });

    it('should unmanage torrent for user', () => {
      writeStore('transmission.app-torrents', userId, [
        { hash: 'hash-to-delete', link: 'https://link', name: 'Movie' },
      ]);

      const unmanaged = unmanageTorrentForUser(userId, 'hash-to-delete');
      expect(unmanaged).toBe(true);

      const managed = getManagedTorrents(userId);
      expect(managed).toHaveLength(0);
    });
  });

  describe('configureTransmission & getTransmissionSettings', () => {
    it('should return null when transmission is not configured for user', () => {
      expect(getTransmissionSettings(userId)).toBeNull();
    });

    it('should configure transmission settings after successful session-get RPC check', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-transmission-session-id': 'session-token-123' }),
        json: async () => ({ result: 'success', arguments: { 'download-dir': '/downloads' } }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await configureTransmission(userId, sampleSettings);

      const saved = getTransmissionSettings(userId);
      expect(saved?.host).toBe('http://transmission.local');
    });

    it('should throw error when Transmission authentication fails with 401', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(configureTransmission(userId, sampleSettings)).rejects.toThrow();
    });
  });

  describe('getDownloadsTransmission & getTransmissionStats', () => {
    beforeEach(() => {
      const user = createUser('userDownloader').user;
      userId = user.id;
      user.settings.transmission = sampleSettings;
      updateUser(user);
    });

    it('should retrieve downloads and filter by managedBySeedflix unless includeAll is true', async () => {
      const mockTorrents = [
        {
          id: 1,
          name: 'Movie 1',
          hashString: 'hash1',
          status: 4,
          percentDone: 0.5,
          rateDownload: 1000,
          rateUpload: 500,
          totalSize: 1000000,
          uploadedEver: 5000,
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-transmission-session-id': 'session-token-123' }),
        json: async () => ({
          result: 'success',
          arguments: { torrents: mockTorrents },
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const allDownloads = await getDownloadsTransmission(userId, { includeAll: 'true' });
      expect(allDownloads).toHaveLength(1);
      expect(allDownloads[0].name).toBe('Movie 1');
    });

    it('should retrieve session statistics with getTransmissionStats', async () => {
      const mockStats = {
        activeTorrentCount: 3,
        downloadSpeed: 50000,
        uploadSpeed: 10000,
        torrentCount: 5,
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-transmission-session-id': 'session-token-123' }),
        json: async () => ({
          result: 'success',
          arguments: mockStats,
        }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const stats = await getTransmissionStats(userId);
      expect(stats.activeTorrentCount).toBe(3);
    });
  });

  describe('performTransmissionAction & startDownload', () => {
    beforeEach(() => {
      const user = createUser('userActions').user;
      userId = user.id;
      user.settings.transmission = sampleSettings;
      user.settings.indexer = {
        url: 'https://indexer.example.com/api',
        token: 'tok-123',
        qualities: ['1080p'],
        languages: ['MULTI'],
      };
      updateUser(user);
    });

    it('should perform transmission action on torrent ID', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-transmission-session-id': 'session-token-123' }),
        json: async () => ({ result: 'success' }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(performTransmissionAction('torrent-start', userId, 1)).resolves.not.toThrow();
    });

    it('should start download, fetch torrent metainfo and register managed torrent', async () => {
      const fetchSpy = vi.fn().mockImplementation(async (url: any, opts: any) => {
        const urlStr = url.toString();
        if (urlStr.includes('indexer.example.com')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/x-bittorrent' }),
            arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
          };
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'x-transmission-session-id': 'session-token-123' }),
          json: async () => ({
            result: 'success',
            arguments: { 'torrent-added': { id: 1, name: 'Downloaded Movie', hashString: 'hash-abc' } },
          }),
        };
      });
      vi.stubGlobal('fetch', fetchSpy);

      await startDownload(userId, 'guid-123', 'movie');

      const managed = getManagedTorrents(userId);
      expect(managed.find((t) => t.hash === 'hash-abc')).toBeDefined();
    });
  });
});
