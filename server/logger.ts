import { AsyncLocalStorage } from 'node:async_hooks';
import { Request, Response, NextFunction } from 'express';
import { bold, cyan, magenta, yellow, red, gray } from 'colorette';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  correlationId: string;
}

export const context = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return context.getStore();
}

const HTTP_LOG_FORMAT = ':correlationId :type :method :url :status - :response-time ms';
const BACKEND_LOG_FORMAT = ':correlationId :type :message';

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = randomUUID();
  req.correlationId = correlationId;

  context.run({ correlationId }, () => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      Logger.http(req, res, duration);
    });
    next();
  });
}

export class Logger {
  static readonly buffer: string[] = [];

  static readonly original = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  static express(): any {
    return loggerMiddleware;
  }

  static log(original: (...args: any[]) => void, type: string, ...args: any[]) {
    const ctx = getContext();
    const correlationId = ctx ? ctx.correlationId : 'no-context';
    const msg = BACKEND_LOG_FORMAT.replace(':correlationId', correlationId)
      .replace(':type', type)
      .replace(':message', args ? args.map(String).join(' ') : '');
    Logger.buffer.push(msg);
    original(msg);
  }

  static http(req: Request, res: Response, duration: number) {
    const msg = HTTP_LOG_FORMAT.replace(':correlationId', req.correlationId)
      .replace(':type', bold(cyan('[HTTP]')))
      .replace(':method', req.method)
      .replace(':url', req.originalUrl)
      .replace(':status', String(res.statusCode))
      .replace(':response-time', String(duration));
    Logger.buffer.push(msg);
    Logger.original.info(msg);
  }

  static init() {
    console.log = (...args: any[]) => {
      Logger.log(this.original.log, bold(gray('[LOG]')), ...args);
    };

    console.info = (...args: any[]) => {
      Logger.log(this.original.info, bold(magenta('[INFO]')), ...args);
    };

    console.warn = (...args: any[]) => {
      Logger.log(this.original.warn, bold(yellow('[WARN]')), ...args);
    };

    console.error = (...args: any[]) => {
      Logger.log(this.original.error, bold(red('[ERROR]')), ...args);
    };
  }
}
