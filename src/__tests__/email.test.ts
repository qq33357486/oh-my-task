import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getLogFilePath } from '../utils/logger.js';
import { sendEmailWithConfig, type EmailConfig } from '../utils/email.js';

const sendMailMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn(() => ({ sendMail: sendMailMock })));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

let testDir: string;

const emailConfig: EmailConfig = {
  host: 'smtp.example.com',
  port: '587',
  user: 'admin@example.com',
  pass: 'secret',
  from: 'noreply@example.com',
};

function readLogEntries(): Array<Record<string, unknown>> {
  return readFileSync(getLogFilePath(), 'utf-8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

describe('邮件发送日志与重试', () => {
  beforeEach(() => {
    testDir = join(tmpdir(), `omt-email-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    process.env.DB_PATH = join(testDir, 'data', 'data.db');
    mkdirSync(join(testDir, 'data'), { recursive: true });
    sendMailMock.mockReset();
    createTransportMock.mockClear();
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

  it('发送失败后会重试，并记录每次尝试和最终成功日志', async () => {
    sendMailMock
      .mockRejectedValueOnce(Object.assign(new Error('连接超时'), { code: 'ETIMEDOUT', command: 'CONN' }))
      .mockRejectedValueOnce(Object.assign(new Error('临时拒绝'), { responseCode: 451, response: 'try later' }))
      .mockResolvedValueOnce({ messageId: 'msg-1', response: '250 OK' });

    await sendEmailWithConfig(
      emailConfig,
      'user@example.com',
      '测试邮件',
      '正文',
      { maxAttempts: 3, retryDelayMs: 0 }
    );

    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(createTransportMock).toHaveBeenCalledTimes(3);

    const entries = readLogEntries();
    expect(entries.filter(entry => entry.event === '邮件发送尝试')).toHaveLength(3);
    expect(entries.filter(entry => entry.event === '邮件发送失败准备重试')).toHaveLength(2);

    const successLog = entries.find(entry => entry.event === '邮件发送成功');
    expect(successLog).toMatchObject({
      level: 'info',
      scope: 'email',
      message: '邮件已成功发送',
    });
    expect(successLog?.details).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'admin@example.com',
      from: 'noreply@example.com',
      to: 'user@example.com',
      subject: '测试邮件',
      attempt: 3,
      message_id: 'msg-1',
    });
    expect((successLog?.details as Record<string, unknown>).pass).toBeUndefined();
  });

  it('达到最大尝试次数后记录最终失败日志并抛出原始错误', async () => {
    const error = Object.assign(new Error('认证失败'), {
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
      response: 'authentication failed',
    });
    sendMailMock.mockRejectedValue(error);

    await expect(sendEmailWithConfig(
      emailConfig,
      'user@example.com',
      '测试邮件',
      '正文',
      { maxAttempts: 2, retryDelayMs: 0 }
    )).rejects.toThrow('认证失败');

    expect(sendMailMock).toHaveBeenCalledTimes(2);

    const entries = readLogEntries();
    const finalErrorLog = entries.find(entry => entry.event === '邮件发送最终失败');
    expect(finalErrorLog).toMatchObject({
      level: 'error',
      scope: 'email',
      message: '邮件发送已达到最大尝试次数',
    });

    const details = finalErrorLog?.details as Record<string, unknown>;
    expect(details.attempt).toBe(2);
    expect(details.error).toMatchObject({
      name: 'Error',
      message: '认证失败',
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
      response: 'authentication failed',
    });
  });
});
