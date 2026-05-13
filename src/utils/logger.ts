import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogDetails = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  event: string;
  message: string;
  details: LogDetails;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LOG_FILE_PREFIX = 'omt-';
const LOG_FILE_SUFFIX = '.log';
const RETENTION_DAYS = 3;

let currentLogDate = '';

function getDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRetainedDateParts(now: Date): Set<string> {
  const retained = new Set<string>();
  for (let offset = 0; offset < RETENTION_DAYS; offset += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    retained.add(getDatePart(date));
  }
  return retained;
}

function getLogFileDate(fileName: string): string | null {
  if (!fileName.startsWith(LOG_FILE_PREFIX) || !fileName.endsWith(LOG_FILE_SUFFIX)) {
    return null;
  }

  const datePart = fileName.slice(LOG_FILE_PREFIX.length, -LOG_FILE_SUFFIX.length);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : null;
}

function normalizeError(error: Error): LogDetails {
  const extra = Object.fromEntries(
    Object.entries(error).map(([key, value]) => [key, normalizeValue(value, key)])
  );

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...extra,
  };
}

function isSensitiveKey(key: string): boolean {
  return /password|token|cookie|authorization|secret|pass/i.test(key);
}

function normalizeValue(value: unknown, keyName = ''): unknown {
  if (keyName && isSensitiveKey(keyName)) {
    return '[已脱敏]';
  }

  if (value instanceof Error) {
    return normalizeError(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeValue(item, key)])
    );
  }

  return value;
}

function normalizeDetails(details?: LogDetails): LogDetails {
  if (!details) {
    return {};
  }

  return normalizeValue(details) as LogDetails;
}

export function getLogDir(): string {
  if (process.env.DB_PATH) {
    return join(dirname(process.env.DB_PATH), 'logs');
  }

  return join(__dirname, '../../data/logs');
}

export function getLogFilePath(date = new Date()): string {
  return join(getLogDir(), `${LOG_FILE_PREFIX}${getDatePart(date)}${LOG_FILE_SUFFIX}`);
}

export function cleanupExpiredLogs(now = new Date()): void {
  const logDir = getLogDir();
  if (!existsSync(logDir)) {
    return;
  }

  const retainedDateParts = getRetainedDateParts(now);
  for (const fileName of readdirSync(logDir)) {
    const datePart = getLogFileDate(fileName);
    if (datePart && !retainedDateParts.has(datePart)) {
      unlinkSync(join(logDir, fileName));
    }
  }
}

function writeLog(level: LogLevel, scope: string, event: string, message: string, details?: LogDetails): void {
  const now = new Date();
  const logDate = getDatePart(now);
  const entry: LogEntry = {
    timestamp: now.toISOString(),
    level,
    scope,
    event,
    message,
    details: normalizeDetails(details),
  };

  try {
    const logDir = getLogDir();
    mkdirSync(logDir, { recursive: true });

    if (currentLogDate !== logDate) {
      cleanupExpiredLogs(now);
      currentLogDate = logDate;
    }

    appendFileSync(getLogFilePath(now), `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch (error) {
    const fallbackEntry = {
      ...entry,
      details: {
        ...entry.details,
        日志写入失败: normalizeValue(error),
      },
    };
    console.error(JSON.stringify(fallbackEntry));
  }
}

export const logger = {
  debug(scope: string, event: string, message: string, details?: LogDetails): void {
    writeLog('debug', scope, event, message, details);
  },
  info(scope: string, event: string, message: string, details?: LogDetails): void {
    writeLog('info', scope, event, message, details);
  },
  warn(scope: string, event: string, message: string, details?: LogDetails): void {
    writeLog('warn', scope, event, message, details);
  },
  error(scope: string, event: string, message: string, details?: LogDetails): void {
    writeLog('error', scope, event, message, details);
  },
};
