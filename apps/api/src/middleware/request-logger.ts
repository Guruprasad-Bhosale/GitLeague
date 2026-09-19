import { Request, Response, NextFunction } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

const httpLogger = pinoHttp({
  logger,
  genReqId: (req: Request) => req.id,
  autoLogging: {
    ignore: (req: Request) => {
      // In production, keep health checks quiet unless LOG_LEVEL is debug
      if (env.NODE_ENV === 'production' && req.url === '/api/v1/health') {
        return true;
      }
      return false;
    },
  },
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req: Request, res: Response) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req: Request, res: Response, err: Error) => {
    return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
  },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  httpLogger(req, res, next);
}
