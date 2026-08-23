/// <reference path="./types/express.d.ts" />
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import { createColors } from 'colorette';
import { randomUUID } from 'node:crypto';

const colors = createColors({ useColor: true });
const { bold, cyan, magenta, yellow, red, gray, green, blue } = colors;

export interface RequestContext {
  correlationId: string;
}

export const context = new AsyncLocalStorage<RequestContext>();

export function getContext(): RequestContext | undefined {
  return context.getStore();
}

const HTTP_LOG_FORMAT = ':correlationId :type :method :url :status - :response-time ms';
const BACKEND_LOG_FORMAT = ':correlationId :type :message';

const MAX_LOG_BUFFER_SIZE = 2000;

const WHITELISTED_HTTP_PATHS = [
  'GET /api/user',
  'GET /api/auth/me',
  'GET /api/admin/logs'
]

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

  private static appendToBuffer(msg: string) {
    Logger.buffer.push(msg);
    if (Logger.buffer.length > MAX_LOG_BUFFER_SIZE) {
      Logger.buffer.shift();
    }
  }

  static log(original: (...args: any[]) => void, type: string, ...args: any[]) {
    const ctx = getContext();
    const correlationId = ctx ? ctx.correlationId : 'no-context';
    const msg = BACKEND_LOG_FORMAT.replace(':correlationId', gray(correlationId))
      .replace(':type', type)
      .replace(':message', args ? args.map(String).join(' ') : '');
    Logger.appendToBuffer(msg);
    original(msg);
  }

  static http(req: Request, res: Response, duration: number) {
    if (WHITELISTED_HTTP_PATHS.includes(`${req.method} ${req.originalUrl}`) && res.statusCode < 400) {
      return;
    }

    const methodColor = (() => {
      switch (req.method) {
        case 'GET':
          return blue;
        case 'POST':
          return green;
        case 'PUT':
          return yellow;
        case 'DELETE':
          return red;
        case 'PATCH':
          return cyan;
        default:
          return yellow;
      }
    })();
    const statusColor = (() => {
      if (res.statusCode >= 500) return red;
      if (res.statusCode >= 400) return yellow;
      if (res.statusCode >= 300) return cyan;
      return green;
    })();

    const msg = HTTP_LOG_FORMAT.replace(':correlationId', gray(req.correlationId))
      .replace(':type', bold(cyan('[HTTP]')))
      .replace(':method', bold(methodColor(req.method)))
      .replace(':url', req.originalUrl)
      .replace(':status', bold(statusColor(String(res.statusCode))))
      .replace(':response-time', gray(String(duration)));
    Logger.appendToBuffer(msg);
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
