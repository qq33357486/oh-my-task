import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { cleanupExpiredLogs, getLogFilePath, logger } from '../utils/logger.js';

let testDir: string;

function readLogEntries(): Array<Record<string, unknown>> {
  return readFileSync(getLogFilePath(), 'utf-8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('结构化日志', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `omt-logger-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    process.env.DB_PATH = join(testDir, 'data', 'data.db');
    mkdirSync(join(testDir, 'data'), { recursive: true });
  });

  afterEach(() => {
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore Windows file lock cleanup failures in tests.
    }
    delete process.env.DB_PATH;
  });

  it('写入中文 JSONL 日志并规范化错误对象', () => {
    logger.error('test', '测试异常', '测试错误日志已写入', {
      error: new Error('测试错误'),
      count: 1,
      token: 'secret-token',
    });

    const entries = readLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'error',
      scope: 'test',
      event: '测试异常',
      message: '测试错误日志已写入',
    });
    expect(entries[0]).toHaveProperty('timestamp');

    const details = entries[0].details as Record<string, unknown>;
    expect(details.count).toBe(1);
    expect(details.token).toBe('[已脱敏]');
    expect(details.error).toMatchObject({
      name: 'Error',
      message: '测试错误',
    });
  });

  it('只保留最近 3 个自然日的日志文件', () => {
    const logDir = join(testDir, 'data', 'logs');
    mkdirSync(logDir, { recursive: true });

    const baseDate = new Date(2026, 4, 13, 12, 0, 0);
    for (let offset = 0; offset < 5; offset += 1) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - offset);
      writeFileSync(join(logDir, `omt-${formatDate(date)}.log`), '{}\n', 'utf-8');
    }

    cleanupExpiredLogs(baseDate);

    expect(existsSync(join(logDir, 'omt-2026-05-13.log'))).toBe(true);
    expect(existsSync(join(logDir, 'omt-2026-05-12.log'))).toBe(true);
    expect(existsSync(join(logDir, 'omt-2026-05-11.log'))).toBe(true);
    expect(existsSync(join(logDir, 'omt-2026-05-10.log'))).toBe(false);
    expect(existsSync(join(logDir, 'omt-2026-05-09.log'))).toBe(false);
  });
});
