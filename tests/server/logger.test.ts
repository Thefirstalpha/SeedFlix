import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { context, getContext, Logger, loggerMiddleware } from '../../server/logger';
import type { Request, Response } from 'express';

describe('Logger utility', () => {
  beforeEach(() => {
    Logger.buffer.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get context when inside context.run', () => {
    expect(getContext()).toBeUndefined();

    context.run({ correlationId: 'test-correlation-123' }, () => {
      const ctx = getContext();
      expect(ctx?.correlationId).toBe('test-correlation-123');
    });
  });

  it('should append log message to buffer and format with correlationId', () => {
    const mockOriginal = vi.fn();

    context.run({ correlationId: 'req-abc' }, () => {
      Logger.log(mockOriginal, '[CUSTOM]', 'Hello', 'World', 123);
    });

    expect(mockOriginal).toHaveBeenCalledTimes(1);
    expect(Logger.buffer).toHaveLength(1);
    expect(Logger.buffer[0]).toContain('[CUSTOM]');
    expect(Logger.buffer[0]).toContain('Hello World 123');
  });

  it('should handle log message without context', () => {
    const mockOriginal = vi.fn();
    Logger.log(mockOriginal, '[NO-CTX]', 'Test Message');

    expect(mockOriginal).toHaveBeenCalled();
    expect(Logger.buffer).toHaveLength(1);
    expect(Logger.buffer[0]).toContain('no-context');
  });

  it('should format HTTP logs with various status codes and methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
    const statuses = [200, 302, 404, 500];

    for (let i = 0; i < methods.length; i++) {
      const req: any = {
        method: methods[i],
        originalUrl: `/api/resource/${i}`,
        correlationId: `corr-${i}`,
      };
      const res: any = {
        statusCode: statuses[i % statuses.length],
      };

      Logger.http(req, res, 25);
    }

    expect(Logger.buffer.length).toBe(methods.length);
  });

  it('should ignore whitelisted paths if status < 400', () => {
    const req: any = {
      method: 'GET',
      originalUrl: '/api/user',
      correlationId: 'c1',
    };
    const res: any = { statusCode: 200 };

    Logger.http(req, res, 10);
    expect(Logger.buffer).toHaveLength(0);
  });

  it('should run loggerMiddleware and call next while setting req.correlationId', () => {
    const req: any = { method: 'GET', originalUrl: '/api/test' };
    const finishListeners: (() => void)[] = [];
    const res: any = {
      statusCode: 200,
      on: vi.fn().mockImplementation((event: string, cb: () => void) => {
        if (event === 'finish') finishListeners.push(cb);
      }),
    };
    const next = vi.fn();

    const middleware = Logger.express();
    middleware(req as Request, res as Response, next);

    expect(req.correlationId).toBeDefined();
    expect(next).toHaveBeenCalledTimes(1);

    // Simulate response finish
    for (const listener of finishListeners) {
      listener();
    }
    expect(Logger.buffer.length).toBeGreaterThan(0);
  });

  it('should initialize console overrides and route logs to buffer', () => {
    Logger.init();

    console.log('Console log message');
    console.info('Console info message');
    console.warn('Console warn message');
    console.error('Console error message');

    expect(Logger.buffer.some((msg) => msg.includes('Console log message'))).toBe(true);
    expect(Logger.buffer.some((msg) => msg.includes('Console info message'))).toBe(true);
    expect(Logger.buffer.some((msg) => msg.includes('Console warn message'))).toBe(true);
    expect(Logger.buffer.some((msg) => msg.includes('Console error message'))).toBe(true);
  });
});
