import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { initDB, resetDatabase } from '../../../server/modules/db';
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
} from '../../../server/modules/ftp';
import { createUser, updateUser } from '../../../server/modules/user';
import { FtpSettings } from '../../../common/settings';

let mockAccessReject = false;
let mockListReject = false;
let mockDownloadToReject = false;
let mockRemoveRejectPaths = new Set<string>();
let mockRenameRejectPaths = new Set<string>();

const mockSpawnProcess = {
  stdin: new PassThrough(),
  stdout: new PassThrough(),
  stderr: new EventEmitter(),
  kill: vi.fn(),
  killed: false,
};

vi.mock('node:child_process', () => ({
  spawn: vi.fn().mockImplementation(() => {
    mockSpawnProcess.stdin = new PassThrough();
    mockSpawnProcess.stdout = new PassThrough();
    mockSpawnProcess.stderr = new EventEmitter();
    mockSpawnProcess.kill = vi.fn();
    mockSpawnProcess.killed = false;
    return mockSpawnProcess;
  }),
}));

vi.mock('basic-ftp', () => {
  class MockClient {
    ftp = { verbose: false };
    access = vi.fn().mockImplementation(async () => {
      if (mockAccessReject) {
        throw new Error('Access denied');
      }
    });
    list = vi.fn().mockImplementation(async (remotePath?: string) => {
      if (mockListReject) {
        throw new Error('List failed');
      }
      if (remotePath && remotePath.includes('series_folder')) {
        return [{ name: 'episode.mkv', isDirectory: false, size: 524288 }];
      }
      return [
        { name: 'movie.mkv', isDirectory: false, size: 1048576 },
        { name: 'series_folder', isDirectory: true, size: 0 },
      ];
    });
    ensureDir = vi.fn().mockResolvedValue(undefined);
    remove = vi.fn().mockImplementation(async (p: string) => {
      if (mockRemoveRejectPaths.has(p)) {
        throw new Error(`Cannot remove ${p}`);
      }
    });
    removeDir = vi.fn().mockImplementation(async (p: string) => {
      if (mockRemoveRejectPaths.has(p)) {
        throw new Error(`Cannot remove dir ${p}`);
      }
    });
    rename = vi.fn().mockImplementation(async (from: string) => {
      if (mockRenameRejectPaths.has(from)) {
        throw new Error(`Cannot rename ${from}`);
      }
    });
    size = vi.fn().mockResolvedValue(1048576);
    lastMod = vi.fn().mockResolvedValue(new Date('2024-01-01T00:00:00.000Z'));
    downloadTo = vi.fn().mockImplementation(async (dest: any) => {
      if (mockDownloadToReject) {
        throw new Error('Download failed');
      }
      if (dest && typeof dest.write === 'function') {
        dest.write(Buffer.from('video-data-chunk'));
      }
    });
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
    storageLimit: 50,
  };

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.clearAllMocks();
    mockAccessReject = false;
    mockListReject = false;
    mockDownloadToReject = false;
    mockRemoveRejectPaths = new Set();
    mockRenameRejectPaths = new Set();

    const { user } = createUser('ftpUser');
    userId = user.id;
  });

  describe('Configuration & Settings', () => {
    it('should throw error when getFtpSettings is called on non-existent user', () => {
      expect(() => getFtpSettings(999999)).toThrow('User not found');
    });

    it('should throw error when configureFtp is called on non-existent user', async () => {
      await expect(configureFtp(999999, sampleFtpSettings)).rejects.toThrow('User not found');
    });

    it('should throw error when getFtpSettings is called on unconfigured user', () => {
      expect(() => getFtpSettings(userId)).toThrow('FTP non configuré');
    });

    it('should configure and retrieve FTP settings for a user', async () => {
      await configureFtp(userId, sampleFtpSettings);
      const settings = getFtpSettings(userId);
      expect(settings).toEqual(sampleFtpSettings);
    });
  });

  describe('FTP Operations & Connection Tests', () => {
    beforeEach(() => {
      const user = createUser('userConfiguredFtp').user;
      userId = user.id;
      user.settings.ftp = sampleFtpSettings;
      updateUser(user);
    });

    it('should test FTP connection with anonymous settings and return ok', async () => {
      const anonSettings: FtpSettings = {
        host: 'ftp.anon.com',
        port: 21,
        secure: true,
        authRequired: false,
        username: '',
        password: '',
        rootFolder: '',
        storageLimit: null,
      };
      const result = await testFtpConnectionWithSettings(anonSettings);
      expect(result).toEqual({ ok: true });
    });

    it('should handle access failure during testFtpConnectionWithSettings', async () => {
      mockAccessReject = true;
      await expect(testFtpConnectionWithSettings(sampleFtpSettings)).rejects.toThrow(
        'Access denied',
      );
    });

    it('should handle list failure during testFtpConnectionWithSettings', async () => {
      mockListReject = true;
      const result = await testFtpConnectionWithSettings(sampleFtpSettings);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('List failed');
    });

    it('should test FTP connection for configured user and handle failure', async () => {
      const success = await testFtpConnection(userId);
      expect(success).toEqual({ ok: true });

      mockListReject = true;
      const failure = await testFtpConnection(userId);
      expect(failure.ok).toBe(false);
      expect(failure.error).toBe('List failed');
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
      mockRemoveRejectPaths.add('/downloads/fail.mkv');
      mockRemoveRejectPaths.add('/downloads/fail_dir');

      const result = await removeBatch(userId, [
        { path: '/downloads/f1.mkv', isDirectory: false },
        { path: '/downloads/dir1', isDirectory: true },
        { path: '/downloads/fail.mkv', isDirectory: false },
        { path: '/downloads/fail_dir', isDirectory: true },
      ]);

      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].path).toBe('/downloads/fail.mkv');
      expect(result.failed[1].path).toBe('/downloads/fail_dir');
    });

    it('should execute batch moves with and without trailing slash on destination', async () => {
      mockRenameRejectPaths.add('/downloads/fail.mkv');

      const result1 = await moveBatch(
        userId,
        ['/downloads/f1.mkv', '/downloads/fail.mkv'],
        '/archive/',
      );
      expect(result1.failed).toHaveLength(1);
      expect(result1.failed[0].path).toBe('/downloads/fail.mkv');

      const result2 = await moveBatch(userId, ['/downloads/f2.mkv'], '/archive');
      expect(result2.failed).toHaveLength(0);
    });

    it('should get file size and last modified date', async () => {
      const size = await getFileSize(userId, '/downloads/movie.mkv');
      expect(size).toBe(1048576);

      const lastMod = await getLastModified(userId, '/downloads/movie.mkv');
      expect(lastMod).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    it('should calculate storage usage with rootFolder and storageLimit', async () => {
      const storage = await getStorageUsage(userId);
      expect(storage.limit).toBe(50 * 1024 * 1024 * 1024);
      expect(storage.used).toBe(1048576 + 524288);
    });

    it('should calculate storage usage when storageLimit is null and rootFolder is default', async () => {
      const user = createUser('userUnlimitedFtp').user;
      user.settings.ftp = {
        host: 'ftp.example.com',
        port: 21,
        secure: false,
        authRequired: false,
        username: '',
        password: '',
        rootFolder: '',
        storageLimit: null,
      };
      updateUser(user);

      const storage = await getStorageUsage(user.id);
      expect(storage.limit).toBeNull();
      expect(storage.used).toBeDefined();
    });

    it('should upload from stream to remote path', async () => {
      const source = new PassThrough();
      source.end(Buffer.from('sample upload data'));

      await expect(uploadFromStream(userId, source, '/uploads/test.txt')).resolves.not.toThrow();
    });

    it('should download to stream without maxBytes and handle dest close event', async () => {
      const pass = new PassThrough();
      await downloadToStream(userId, '/downloads/movie.mkv', pass, 0);

      // Verify dest close handler
      pass.emit('close');
    });

    it('should download to stream with maxBytes (ByteLimitTransform)', async () => {
      const pass = new PassThrough();
      let receivedBytes = 0;
      pass.on('data', (chunk) => {
        receivedBytes += chunk.length;
      });

      await downloadToStream(userId, '/downloads/movie.mkv', pass, 0, 5);
      expect(receivedBytes).toBeLessThanOrEqual(5);
    });

    it('should ignore errors in downloadToStream when dest is already destroyed or ended', async () => {
      mockDownloadToReject = true;
      const pass = new PassThrough();
      pass.destroy();

      await expect(
        downloadToStream(userId, '/downloads/movie.mkv', pass, 0),
      ).resolves.not.toThrow();
    });

    it('should rethrow error in downloadToStream when dest is active', async () => {
      mockDownloadToReject = true;
      const pass = new PassThrough();

      await expect(
        downloadToStream(userId, '/downloads/movie.mkv', pass, 0),
      ).rejects.toThrow('Download failed');
    });

    it('should transcode to stream with startTime and forceTranscode', async () => {
      const dest = new PassThrough();
      await expect(
        transcodeToStream(userId, '/downloads/movie.mkv', dest, {
          startTime: 30,
          forceTranscode: true,
        }),
      ).resolves.not.toThrow();

      // Trigger cleanup handlers
      dest.emit('close');
      dest.emit('error', new Error('stream error'));
    });

    it('should transcode to stream without startTime and copy mode', async () => {
      const dest = new PassThrough();
      await expect(
        transcodeToStream(userId, '/downloads/movie.mkv', dest, {
          startTime: 0,
          forceTranscode: false,
        }),
      ).resolves.not.toThrow();
    });

    it('should handle transcode failure when downloadTo fails', async () => {
      mockDownloadToReject = true;
      const dest = new PassThrough();

      // Send stderr data from ffmpeg
      mockSpawnProcess.stderr.emit('data', Buffer.from('ffmpeg codec error'));

      await expect(
        transcodeToStream(userId, '/downloads/movie.mkv', dest),
      ).rejects.toThrow('Transcode error');
    });
  });
});
