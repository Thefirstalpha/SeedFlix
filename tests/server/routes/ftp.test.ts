import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import * as ftpModule from '../../../server/modules/ftp';
import { router as ftpRouter } from '../../../server/routes/ftp';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';

vi.mock('../../../server/modules/ftp', async (importOriginal) => {
  const actual = await importOriginal<typeof ftpModule>();
  return {
    ...actual,
    configureFtp: vi.fn(),
    getFtpSettings: vi.fn(),
    testFtpConnection: vi.fn(),
    testFtpConnectionWithSettings: vi.fn(),
    listDirectory: vi.fn(),
    makeDirectory: vi.fn(),
    removeFile: vi.fn(),
    removeDirectory: vi.fn(),
    removeBatch: vi.fn(),
    moveBatch: vi.fn(),
    rename: vi.fn(),
    getFileSize: vi.fn(),
    getLastModified: vi.fn(),
    downloadToStream: vi.fn(),
    uploadFromStream: vi.fn(),
    getStorageUsage: vi.fn(),
  };
});

describe('Route: /api/ftp', () => {
  const app = createTestApp(ftpRouter);
  const mockedGetSettings = vi.mocked(ftpModule.getFtpSettings);
  const mockedConfigure = vi.mocked(ftpModule.configureFtp);
  const mockedTestConnection = vi.mocked(ftpModule.testFtpConnection);
  const mockedTestWithSettings = vi.mocked(ftpModule.testFtpConnectionWithSettings);
  const mockedList = vi.mocked(ftpModule.listDirectory);
  const mockedMkdir = vi.mocked(ftpModule.makeDirectory);
  const mockedRemoveFile = vi.mocked(ftpModule.removeFile);
  const mockedRemoveDir = vi.mocked(ftpModule.removeDirectory);
  const mockedRemoveBatch = vi.mocked(ftpModule.removeBatch);
  const mockedMoveBatch = vi.mocked(ftpModule.moveBatch);
  const mockedRename = vi.mocked(ftpModule.rename);
  const mockedGetFileSize = vi.mocked(ftpModule.getFileSize);
  const mockedGetLastModified = vi.mocked(ftpModule.getLastModified);
  const mockedDownloadToStream = vi.mocked(ftpModule.downloadToStream);
  const mockedUploadFromStream = vi.mocked(ftpModule.uploadFromStream);
  const mockedGetStorage = vi.mocked(ftpModule.getStorageUsage);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('should get FTP configuration without password', async () => {
    const { user } = createUser('ftpUser1');
    const cookie = createSessionCookie(user.id);
    mockedGetSettings.mockReturnValueOnce({
      host: 'ftp.example.com',
      port: 21,
      secure: false,
      authRequired: true,
      username: 'ftpuser',
      password: 'ftppassword',
      rootFolder: '/',
      storageLimit: null,
    });

    const res = await request(app).get('/api/ftp/config').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.config.host).toBe('ftp.example.com');
    expect(res.body.config.password).toBeUndefined();
  });

  it('should test and configure FTP settings', async () => {
    const { user } = createUser('ftpUser2');
    const cookie = createSessionCookie(user.id);
    mockedTestWithSettings.mockResolvedValueOnce({ ok: true });
    mockedConfigure.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/ftp/configure')
      .set('Cookie', cookie)
      .send({
        host: 'ftp.example.com',
        port: 21,
        username: 'user',
        password: 'pwd',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should test existing FTP connection via POST /api/ftp/test', async () => {
    const { user } = createUser('ftpUser3');
    const cookie = createSessionCookie(user.id);
    mockedTestConnection.mockResolvedValueOnce({ ok: true });

    const res = await request(app).post('/api/ftp/test').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should list directory contents via GET /api/ftp/list', async () => {
    const { user } = createUser('ftpUser4');
    const cookie = createSessionCookie(user.id);
    mockedList.mockResolvedValueOnce([
      {
        name: 'Movies',
        type: 2,
        size: 0,
        rawModifiedAt: '2024-01-01',
        isDirectory: true,
        isFile: false,
        isSymbolicLink: false,
      } as any,
    ]);

    const res = await request(app).get('/api/ftp/list?path=/').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });

  it('should create directory via POST /api/ftp/mkdir', async () => {
    const { user } = createUser('ftpUser5');
    const cookie = createSessionCookie(user.id);
    mockedMkdir.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/ftp/mkdir')
      .set('Cookie', cookie)
      .send({ path: '/new_folder' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should delete file and directory via DELETE /api/ftp/file & directory', async () => {
    const { user } = createUser('ftpUser6');
    const cookie = createSessionCookie(user.id);
    mockedRemoveFile.mockResolvedValueOnce(undefined);
    mockedRemoveDir.mockResolvedValueOnce(undefined);

    const resFile = await request(app)
      .delete('/api/ftp/file')
      .set('Cookie', cookie)
      .send({ path: '/file.txt' });
    expect(resFile.status).toBe(200);

    const resDir = await request(app)
      .delete('/api/ftp/directory')
      .set('Cookie', cookie)
      .send({ path: '/folder' });
    expect(resDir.status).toBe(200);
  });

  it('should rename file or folder via POST /api/ftp/rename', async () => {
    const { user } = createUser('ftpUserRename');
    const cookie = createSessionCookie(user.id);
    mockedRename.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/ftp/rename')
      .set('Cookie', cookie)
      .send({ oldPath: '/old.mkv', newPath: '/new.mkv' });

    expect(res.status).toBe(200);
    expect(mockedRename).toHaveBeenCalledWith(user.id, '/old.mkv', '/new.mkv');
  });

  it('should batch delete and batch move files via /api/ftp/delete-batch & /api/ftp/move', async () => {
    const { user } = createUser('ftpUser7');
    const cookie = createSessionCookie(user.id);
    mockedRemoveBatch.mockResolvedValueOnce({ success: ['/a.txt'], failed: [] });
    mockedMoveBatch.mockResolvedValueOnce({ success: ['/a.txt'], failed: [] });

    const resDel = await request(app)
      .post('/api/ftp/delete-batch')
      .set('Cookie', cookie)
      .send({ items: [{ path: '/a.txt', isDirectory: false }] });
    expect(resDel.status).toBe(200);

    const resMove = await request(app)
      .post('/api/ftp/move')
      .set('Cookie', cookie)
      .send({ paths: ['/a.txt'], destinationDir: '/dest' });
    expect(resMove.status).toBe(200);
  });

  it('should download file stream via GET /api/ftp/download', async () => {
    const { user } = createUser('ftpUserDownload');
    const cookie = createSessionCookie(user.id);
    mockedGetFileSize.mockResolvedValueOnce(Buffer.byteLength('file-content'));
    mockedDownloadToStream.mockImplementation(async (uid, p, res) => {
      res.write('file-content');
      res.end();
    });

    const res = await request(app)
      .get('/api/ftp/download?path=/file.txt')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.toString()).toBe('file-content');
  });

  it('should stream video media via GET /api/ftp/stream with video/mp4 MIME type', async () => {
    const { user } = createUser('ftpUserStream');
    const cookie = createSessionCookie(user.id);
    mockedGetFileSize.mockResolvedValueOnce(Buffer.byteLength('video-binary'));
    mockedDownloadToStream.mockImplementation(async (uid, p, res) => {
      res.write('video-binary');
      res.end();
    });

    const res = await request(app)
      .get('/api/ftp/stream?path=/movies/video.mp4')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('video/mp4');
    expect(res.headers['content-disposition']).toContain('inline');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('should handle /api/ftp/stream error when path is missing or download fails', async () => {
    const { user } = createUser('ftpUserStreamErr');
    const cookie = createSessionCookie(user.id);

    const resMissing = await request(app).get('/api/ftp/stream').set('Cookie', cookie);
    expect(resMissing.status).toBe(400);

    mockedGetFileSize.mockRejectedValueOnce(new Error('Cannot determine size'));
    mockedDownloadToStream.mockRejectedValueOnce(new Error('Stream failed'));

    const resFail = await request(app).get('/api/ftp/stream?path=/fail.mp4').set('Cookie', cookie);
    expect(resFail.status).toBe(500);
    const parsed = typeof resFail.body === 'object' && resFail.body !== null && 'ok' in resFail.body
      ? resFail.body
      : JSON.parse(resFail.body?.toString?.() || resFail.text || '{}');
    expect(parsed.ok).toBe(false);
  });

  it('should support inline download via GET /api/ftp/download?inline=true and handle missing path', async () => {
    const { user } = createUser('ftpUserInline');
    const cookie = createSessionCookie(user.id);

    const resMissing = await request(app).get('/api/ftp/download').set('Cookie', cookie);
    expect(resMissing.status).toBe(400);

    mockedGetFileSize.mockResolvedValueOnce(Buffer.byteLength('image-binary'));
    mockedDownloadToStream.mockImplementation(async (uid, p, res) => {
      res.write('image-binary');
      res.end();
    });

    const res = await request(app)
      .get('/api/ftp/download?path=/photos/picture.jpg&inline=true')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
    expect(res.headers['content-disposition']).toContain('inline');
  });

  it('should upload file stream via POST /api/ftp/upload and handle missing path', async () => {
    const { user } = createUser('ftpUserUpload');
    const cookie = createSessionCookie(user.id);

    const resMissing = await request(app).post('/api/ftp/upload').set('Cookie', cookie);
    expect(resMissing.status).toBe(400);

    mockedUploadFromStream.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/ftp/upload?path=/uploads/file.txt')
      .set('Cookie', cookie)
      .send('file content');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should get file info via GET /api/ftp/info and handle missing path', async () => {
    const { user } = createUser('ftpUserInfo');
    const cookie = createSessionCookie(user.id);

    const resMissing = await request(app).get('/api/ftp/info').set('Cookie', cookie);
    expect(resMissing.status).toBe(400);

    mockedGetFileSize.mockResolvedValueOnce(2048);
    mockedGetLastModified.mockResolvedValueOnce(new Date('2024-01-01'));

    const res = await request(app)
      .get('/api/ftp/info?path=/file.txt')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.size).toBe(2048);
  });

  it('should get storage usage via GET /api/ftp/storage', async () => {
    const { user } = createUser('ftpUser8');
    const cookie = createSessionCookie(user.id);
    mockedGetStorage.mockResolvedValueOnce({
      used: 5000,
      limit: 10000,
      available: 5000,
      percentage: 50,
    });

    const res = await request(app).get('/api/ftp/storage').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.used).toBe(5000);
  });
});
