import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, initDB, resetDatabase } from '../../../server/modules/db';
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
} from '../../../server/modules/ftp';
import { createUser, updateUser } from '../../../server/modules/user';
import { FtpSettings } from '../../../common/settings';
import { Client } from 'basic-ftp';

// Mock basic-ftp Client
vi.mock('basic-ftp', () => {
  class MockClient {
    ftp = { verbose: false };
    access = vi.fn().mockResolvedValue(undefined);
    list = vi.fn().mockImplementation(async (remotePath?: string) => {
      if (remotePath && remotePath.includes('series_folder')) {
        return [{ name: 'episode.mkv', isDirectory: false, size: 524288 }];
      }
      return [
        { name: 'movie.mkv', isDirectory: false, size: 1048576 },
        { name: 'series_folder', isDirectory: true, size: 0 },
      ];
    });
    ensureDir = vi.fn().mockResolvedValue(undefined);
    remove = vi.fn().mockResolvedValue(undefined);
    removeDir = vi.fn().mockResolvedValue(undefined);
    rename = vi.fn().mockResolvedValue(undefined);
    size = vi.fn().mockResolvedValue(1048576);
    lastMod = vi.fn().mockResolvedValue(new Date('2024-01-01T00:00:00.000Z'));
    downloadTo = vi.fn().mockResolvedValue(undefined);
    uploadFrom = vi.fn().mockResolvedValue(undefined);
    close = vi.fn();
  }
  return { Client: MockClient };
});

describe('ftp module', () => {
  let userId: number;
  const sampleFtpSettings: FtpSettings = {
    host: 'ftp.example.com',
    port: 21,
    secure: false,
    authRequired: true,
    username: 'ftp_user',
    password: 'ftp_password',
    rootFolder: '/downloads',
    storageLimit: 50, // 50 GB
  };

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.clearAllMocks();
    const { user } = createUser('ftpUser');
    userId = user.id;
  });

  describe('Configuration & Settings', () => {
    it('should throw error when getFtpSettings is called on unconfigured user', () => {
      expect(() => getFtpSettings(userId)).toThrow('FTP non configuré');
    });

    it('should configure and retrieve FTP settings for a user', async () => {
      await configureFtp(userId, sampleFtpSettings);
      const settings = getFtpSettings(userId);
      expect(settings).toEqual(sampleFtpSettings);
    });
  });

  describe('FTP Operations', () => {
    beforeEach(() => {
      const user = createUser('userConfiguredFtp').user;
      userId = user.id;
      user.settings.ftp = sampleFtpSettings;
      updateUser(user);
    });

    it('should test FTP connection with settings and return ok', async () => {
      const result = await testFtpConnectionWithSettings(sampleFtpSettings);
      expect(result).toEqual({ ok: true });
    });

    it('should test FTP connection for configured user', async () => {
      const result = await testFtpConnection(userId);
      expect(result).toEqual({ ok: true });
    });

    it('should list directory contents', async () => {
      const items = await listDirectory(userId, '/downloads');
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('movie.mkv');
    });

    it('should create directory with makeDirectory', async () => {
      await expect(makeDirectory(userId, '/downloads/new_folder')).resolves.not.toThrow();
    });

    it('should remove file and directory', async () => {
      await expect(removeFile(userId, '/downloads/movie.mkv')).resolves.not.toThrow();
      await expect(removeDirectory(userId, '/downloads/series_folder')).resolves.not.toThrow();
    });

    it('should rename file or folder', async () => {
      await expect(
        rename(userId, '/downloads/old.mkv', '/downloads/new.mkv'),
      ).resolves.not.toThrow();
    });

    it('should execute batch removals and track failed items', async () => {
      const result = await removeBatch(userId, [
        { path: '/downloads/f1.mkv', isDirectory: false },
        { path: '/downloads/dir1', isDirectory: true },
      ]);

      expect(result).toEqual({ failed: [] });
    });

    it('should execute batch moves', async () => {
      const result = await moveBatch(
        userId,
        ['/downloads/f1.mkv', '/downloads/f2.mkv'],
        '/archive',
      );

      expect(result).toEqual({ failed: [] });
    });

    it('should get file size and last modified date', async () => {
      const size = await getFileSize(userId, '/downloads/movie.mkv');
      expect(size).toBe(1048576);

      const lastMod = await getLastModified(userId, '/downloads/movie.mkv');
      expect(lastMod).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    it('should calculate storage usage and limit in bytes', async () => {
      const storage = await getStorageUsage(userId);
      expect(storage.limit).toBe(50 * 1024 * 1024 * 1024);
      expect(storage.used).toBeDefined();
    });

    it('should download to stream with startAt and maxBytes', async () => {
      const { PassThrough } = await import('node:stream');
      const pass = new PassThrough();
      await expect(
        downloadToStream(userId, '/downloads/movie.mkv', pass, 1024, 2048),
      ).resolves.not.toThrow();
    });
  });
});
