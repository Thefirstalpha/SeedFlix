import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Response } from 'express';
import { initDB, resetDatabase, writeStore } from '../../../server/modules/db';
import { createUser } from '../../../server/modules/user';
import {
  addClient,
  removeClient,
  getClientCount,
  emitToUser,
  buildUserStatusBar,
  emitStatusBar,
  emitNotification,
  emitDownloads,
} from '../../../server/modules/events';
import * as transmissionModule from '../../../server/modules/transmission';
import { addNotification } from '../../../server/modules/notification';

vi.mock('../../../server/modules/transmission', async (importOriginal) => {
  const actual = await importOriginal<typeof transmissionModule>();
  return {
    ...actual,
    getDownloadsTransmission: vi.fn(),
    getTransmissionStats: vi.fn(),
  };
});

describe('events module', () => {
  let userId: number;

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.clearAllMocks();
    const { user } = createUser('eventsUser');
    userId = user.id;
  });

  describe('Client management and emitToUser', () => {
    it('should add, count and remove clients for a user', () => {
      const mockRes1 = { write: vi.fn() } as unknown as Response;
      const mockRes2 = { write: vi.fn() } as unknown as Response;

      expect(getClientCount(userId)).toBe(0);
      expect(getClientCount()).toBe(0);

      addClient(userId, mockRes1);
      addClient(userId, mockRes2);
      expect(getClientCount(userId)).toBe(2);
      expect(getClientCount()).toBe(2);

      removeClient(userId, mockRes1);
      expect(getClientCount(userId)).toBe(1);

      removeClient(userId, mockRes2);
      expect(getClientCount(userId)).toBe(0);
      expect(getClientCount()).toBe(0);
    });

    it('should remove dead responses when write throws in emitToUser', () => {
      const liveRes = { write: vi.fn() } as unknown as Response;
      const deadRes = {
        write: vi.fn(() => {
          throw new Error('Broken pipe');
        }),
      } as unknown as Response;

      addClient(userId, liveRes);
      addClient(userId, deadRes);
      expect(getClientCount(userId)).toBe(2);

      emitToUser(userId, 'statusBar', { test: true });

      expect(liveRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: statusBar\ndata: {"test":true}\n\n'),
      );
      expect(getClientCount(userId)).toBe(1);
    });

    it('should do nothing in emitToUser if user has no active clients', () => {
      expect(() => emitToUser(99999, 'heartbeat', {})).not.toThrow();
    });
  });

  describe('buildUserStatusBar & emitStatusBar', () => {
    it('should build status bar with active downloads, wishlist count, and unread notifications', async () => {
      vi.mocked(transmissionModule.getDownloadsTransmission).mockResolvedValue([
        { id: 1, leftUntilDone: 500, isFinished: false } as any,
        { id: 2, leftUntilDone: 0, isFinished: true } as any,
      ]);

      writeStore('wishlist', userId, [
        { tmdb: 550, type: 'movie', title: 'Movie 1', original_title: 'Movie 1', addedAt: '2024-01-01' },
        { tmdb: 680, type: 'movie', title: 'Movie 2', original_title: 'Movie 2', addedAt: '2024-01-01' },
      ]);

      addNotification(userId, {
        title: 'New Episode',
        message: 'Game of Thrones S01E01',
        type: 'info',
      });

      const statusBar = await buildUserStatusBar(userId);
      expect(statusBar.downloads).toBe(1);
      expect(statusBar.wishlist).toBe(2);
      expect(statusBar.notifications).toBe(1);
      expect(statusBar.latestNotification?.title).toBe('New Episode');
    });

    it('should handle transmission or wishlist errors gracefully in buildUserStatusBar', async () => {
      vi.mocked(transmissionModule.getDownloadsTransmission).mockRejectedValueOnce(
        new Error('Transmission down'),
      );

      const statusBar = await buildUserStatusBar(userId);
      expect(statusBar.downloads).toBe(0);
      expect(statusBar.wishlist).toBe(0);
      expect(statusBar.notifications).toBe(0);
      expect(statusBar.latestNotification).toBeNull();
    });

    it('should emit status bar to connected user', async () => {
      const mockRes = { write: vi.fn() } as unknown as Response;
      addClient(userId, mockRes);

      vi.mocked(transmissionModule.getDownloadsTransmission).mockResolvedValueOnce([]);

      await emitStatusBar(userId);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: statusBar'),
      );

      removeClient(userId, mockRes);
    });

    it('should not emit status bar if user has no clients', async () => {
      const mockRes = { write: vi.fn() } as unknown as Response;
      await emitStatusBar(8888);
      expect(mockRes.write).not.toHaveBeenCalled();
    });
  });

  describe('emitNotification & emitDownloads', () => {
    it('should emit notification and trigger statusBar emit', () => {
      const mockRes = { write: vi.fn() } as unknown as Response;
      addClient(userId, mockRes);

      emitNotification(userId, { id: 'n-1', title: 'Alert' }, 1);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: notification'),
      );

      removeClient(userId, mockRes);
    });

    it('should emit downloads with passed data or fetch from transmission', async () => {
      const mockRes = { write: vi.fn() } as unknown as Response;
      addClient(userId, mockRes);

      // With passed data
      await emitDownloads(userId, [{ id: 1, name: 'Passed Torrent' } as any], { downloadSpeed: 100 } as any);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"name":"Passed Torrent"'),
      );

      // Without passed data (fetch from transmission)
      vi.mocked(transmissionModule.getDownloadsTransmission).mockResolvedValueOnce([
        { id: 2, name: 'Fetched Torrent' } as any,
      ]);
      vi.mocked(transmissionModule.getTransmissionStats).mockResolvedValueOnce({
        downloadSpeed: 200,
      } as any);

      await emitDownloads(userId);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"name":"Fetched Torrent"'),
      );

      // When transmission throws
      vi.mocked(transmissionModule.getDownloadsTransmission).mockRejectedValueOnce(
        new Error('Transmission unavailable'),
      );
      await expect(emitDownloads(userId)).resolves.not.toThrow();

      removeClient(userId, mockRes);
    });

    it('should do nothing in emitDownloads if user has no clients', async () => {
      vi.clearAllMocks();
      await emitDownloads(7777);
      expect(transmissionModule.getDownloadsTransmission).not.toHaveBeenCalled();
    });
  });
});

