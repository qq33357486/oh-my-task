import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
};

type HitRecord = {
  count: number;
  resetAt: number;
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function splitOrigins(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function getRequestOrigin(req: Request): string | null {
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin.length > 0 ? origin : null;
}

function isAllowedOrigin(req: Request, origin: string): boolean {
  const configured = splitOrigins(process.env.FRONTEND_URL || 'http://localhost:5173');
  const host = req.headers.host;
  const sameHostOrigins = host ? [`http://${host}`, `https://${host}`] : [];
  return [...configured, ...sameHostOrigins].includes(origin);
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getBodyEmail(req: Request): string {
  const body = req.body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  next();
}

export function csrfOriginGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  if (req.headers.authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  if (req.headers['sec-fetch-site'] === 'cross-site') {
    res.status(403).json({ success: false, error: 'Cross-site request blocked' });
    return;
  }

  const origin = getRequestOrigin(req);
  if (origin && !isAllowedOrigin(req, origin)) {
    res.status(403).json({ success: false, error: 'Invalid request origin' });
    return;
  }

  next();
}

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, HitRecord>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (current.count >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ success: false, error: options.message });
      return;
    }

    current.count += 1;
    next();
  };
}

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OMT_LOGIN_RATE_LIMIT_MAX || 20),
  message: 'Too many login attempts, please try again later',
  keyGenerator: req => `login:${getClientIp(req)}:${getBodyEmail(req)}`,
});

export const authEmailRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.OMT_EMAIL_RATE_LIMIT_MAX || 10),
  message: 'Too many verification requests, please try again later',
  keyGenerator: req => `email:${getClientIp(req)}:${getBodyEmail(req)}:${req.path}`,
});

export const authWriteRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.OMT_AUTH_WRITE_RATE_LIMIT_MAX || 300),
  message: 'Too many requests, please try again later',
  keyGenerator: req => `auth:${getClientIp(req)}:${req.path}`,
});
