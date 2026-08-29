import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { initDB, resetDatabase } from '../../../server/modules/db';
import { router as eventsRouter } from '../../../server/routes/events';
import { createUser } from '../../../server/modules/user';
import { createSessionCookie, createTestApp } from './testApp';
import {
  addClient,
  removeClient,
  getClientCount,
  emitToUser,
  emitNotification,
  emitStatusBar,
  emitDownloads,
} from '../../../server/modules/events';

describe('Route & Module: SSE /api/events', () => {
  const app = createTestApp(eventsRouter);

  beforeAll(() => {
    initDB();
  });

  beforeEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('should return 401 Unauthorized when connecting without session', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(401);
  });

  it('should establish SSE stream with proper headers for authenticated user', async () => {
    const { user } = createUser('sseUser1');
    const cookie = createSessionCookie(user.id);

    const reqPromise = request(app)
      .get('/api/events')
      .set('Cookie', cookie)
      .set('Accept', 'text/event-stream');

    // Abort stream after short delay to complete test
    const reqInstance = reqPromise.buffer(false);
    const chunks: string[] = [];

    await new Promise<void>((resolve, reject) => {
      reqInstance
        .on('response', (res) => {
          expect(res.status).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');
          expect(res.headers['cache-control']).toContain('no-cache');
        })
        .on('data', (chunk) => {
          chunks.push(chunk.toString());
          if (chunks.join('').includes('connected')) {
            reqInstance.abort();
            resolve();
          }
        })
        .on('error', (err) => {
          // aborted request error is expected
          if ((err as any).code === 'ABORTED' || (err as any).message?.includes('aborted')) {
            resolve();
          } else {
            reject(err);
          }
        });
    });

    expect(chunks.join('')).toContain('connected');
  });

  it('should correctly register, emit to, and unregister clients in events module', () => {
    const userId = 999;
    const writtenChunks: string[] = [];

    const mockResponse: any = {
      write: vi.fn((chunk: string) => {
        writtenChunks.push(chunk);
        return true;
      }),
    };

    expect(getClientCount(userId)).toBe(0);

    // Add client
    addClient(userId, mockResponse);
    expect(getClientCount(userId)).toBe(1);

    // Emit event
    emitToUser(userId, 'statusBar', { downloads: 2, wishlist: 5, notifications: 1 });
    expect(mockResponse.write).toHaveBeenCalledWith(
      expect.stringContaining('event: statusBar\ndata: {"downloads":2,"wishlist":5,"notifications":1}\n\n'),
    );

    // Emit notification
    emitNotification(userId, { title: 'New release', message: 'Test movie' }, 2);
    expect(mockResponse.write).toHaveBeenCalledWith(
      expect.stringContaining('event: notification\ndata: {"notification":{"title":"New release","message":"Test movie"},"unreadCount":2}\n\n'),
    );

    // Remove client
    removeClient(userId, mockResponse);
    expect(getClientCount(userId)).toBe(0);
  });

  it('should handle dead client sockets gracefully during emit', () => {
    const userId = 888;
    const failingResponse: any = {
      write: vi.fn(() => {
        throw new Error('Socket closed');
      }),
    };

    addClient(userId, failingResponse);
    expect(getClientCount(userId)).toBe(1);

    // Emit should catch error and remove dead response
    emitToUser(userId, 'statusBar', { test: true });
    expect(getClientCount(userId)).toBe(0);
  });
});

