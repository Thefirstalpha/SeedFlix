import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cache, cacheStore, generateCacheKey } from '../../server/cache';
import { Request, Response, NextFunction } from 'express';

describe('cache middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: NextFunction;
  let responseData: any;

  beforeEach(() => {
    cacheStore.clear();
    responseData = null;
    mockReq = {
      path: '/api/test/resource',
      query: { q: '1' },
      body: {},
    };
    mockRes = {
      statusCode: 200,
      json: vi.fn().mockImplementation((data: any) => {
        responseData = data;
        return mockRes;
      }),
    };
    mockNext = vi.fn();
  });

  it('should generate deterministic cache key', () => {
    const key = generateCacheKey(mockReq);
    expect(key).toBe('/api/test/resource{"q":"1"}{}');
  });

  it('should pass non-cached requests to next middleware and cache 2xx response', () => {
    const middleware = cache(60);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);

    mockRes.json({ message: 'hello world' });
    expect(responseData).toEqual({ message: 'hello world' });
  });

  it('should return cached response on subsequent identical request', () => {
    const middleware = cache(60);

    middleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.json({ message: 'cached data' });

    const secondReq = { ...mockReq };
    let secondData: any = null;
    const secondRes: any = {
      statusCode: 200,
      json: vi.fn().mockImplementation((data: any) => {
        secondData = data;
        return secondRes;
      }),
    };
    const secondNext = vi.fn();

    middleware(secondReq as Request, secondRes as Response, secondNext);

    expect(secondNext).not.toHaveBeenCalled();
    expect(secondData).toEqual({ message: 'cached data' });
  });

  it('should not cache non-2xx status codes', () => {
    const middleware = cache(60);

    middleware(mockReq as Request, mockRes as Response, mockNext);
    mockRes.statusCode = 500;
    mockRes.json({ error: 'server error' });

    const secondReq = { ...mockReq };
    const secondRes: any = {
      statusCode: 200,
      json: vi.fn(),
    };
    const secondNext = vi.fn();

    middleware(secondReq as Request, secondRes as Response, secondNext);
    expect(secondNext).toHaveBeenCalledTimes(1);
  });
});

