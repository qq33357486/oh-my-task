import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';

function getAuthMethod(req: Request): string {
  if (req.session?.userId) {
    return 'session';
  }

  if (req.headers.authorization?.startsWith('Bearer ')) {
    return 'bearer';
  }

  return 'none';
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getLogLevel(statusCode: number): 'info' | 'warn' | 'error' {
  if (statusCode >= 500) {
    return 'error';
  }

  if (statusCode >= 400) {
    return 'warn';
  }

  return 'info';
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    if (!req.path.startsWith('/api/')) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const level = getLogLevel(res.statusCode);
    const userId = req.auth?.user?.id || req.session?.userId || null;

    logger[level]('api', 'API 请求完成', 'API 请求已完成', {
      method: req.method,
      path: req.originalUrl || req.url,
      status_code: res.statusCode,
      duration_ms: Math.round(durationMs),
      user_id: userId,
      auth_method: getAuthMethod(req),
      ip: getClientIp(req),
    });
  });

  next();
}
