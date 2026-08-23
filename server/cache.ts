import { Request, Response, NextFunction } from 'express';

export const cacheStore = new Map<string, any>();

export function generateCacheKey(req: any): string {
  const key = req.path + JSON.stringify(req.query) + JSON.stringify(req.body);
  return key;
}

// ttl is in seconds, default is 60 seconds
export function cache(ttl: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = generateCacheKey(req);

    const cached = cacheStore.get(key);
    if (cached && cached.expire > Date.now()) {
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      const status = res.statusCode;

      // Cache uniquement si status 2xx
      if (status >= 200 && status < 300) {
        cacheStore.set(key, {
          data: body,
          expire: Date.now() + ttl * 1000,
        });
      }

      return originalJson(body);
    };

    next();
  };
}
