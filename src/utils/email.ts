import nodemailer from 'nodemailer';
import { getConfig } from '../services/config.service.js';
import { logger } from './logger.js';

export interface EmailConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
}

export interface SendEmailOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
}

interface EmailLogDetails {
  to: string;
  subject: string;
  host: string;
  port: number | null;
  secure: boolean;
  user: string;
  from: string;
}

const DEFAULT_EMAIL_RETRY_ATTEMPTS = 3;
const DEFAULT_EMAIL_RETRY_DELAY_MS = 1000;

function getRetryAttempts(options?: SendEmailOptions): number {
  const value = options?.maxAttempts ?? Number(process.env.OMT_EMAIL_RETRY_ATTEMPTS || DEFAULT_EMAIL_RETRY_ATTEMPTS);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_EMAIL_RETRY_ATTEMPTS;
}

function getRetryDelayMs(options?: SendEmailOptions): number {
  const value = options?.retryDelayMs ?? Number(process.env.OMT_EMAIL_RETRY_DELAY_MS || DEFAULT_EMAIL_RETRY_DELAY_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_EMAIL_RETRY_DELAY_MS;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseSmtpPort(port: string): number | null {
  const parsed = Number.parseInt(port || '587', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null;
}

function buildEmailLogDetails(config: EmailConfig, to: string, subject: string): EmailLogDetails {
  const port = parseSmtpPort(config.port);
  return {
    to,
    subject,
    host: config.host,
    port,
    secure: port === 465,
    user: config.user,
    from: config.from || config.user,
  };
}

/**
 * 发送邮件
 * SMTP 未配置时，将验证码打印到日志
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const config: EmailConfig = {
    host: getConfig('smtp_host') || '',
    port: getConfig('smtp_port') || '587',
    user: getConfig('smtp_user') || '',
    pass: getConfig('smtp_pass') || '',
    from: getConfig('smtp_from') || getConfig('smtp_user') || '',
  };

  logger.info('email', '邮件发送请求', '准备使用系统 SMTP 配置发送邮件', {
    ...buildEmailLogDetails(config, to, subject),
    configured: Boolean(config.host && config.user && config.pass),
  });

  if (!config.host || !config.user || !config.pass) {
    logger.warn('email', 'SMTP 未配置', 'SMTP 未配置，邮件内容已写入本地日志', {
      to,
      subject,
      text,
    });
    return;
  }

  await sendEmailWithConfig(config, to, subject, text);
}

export async function sendEmailWithConfig(
  config: EmailConfig,
  to: string,
  subject: string,
  text: string,
  options?: SendEmailOptions
): Promise<void> {
  const port = parseSmtpPort(config.port);
  const logDetails = buildEmailLogDetails(config, to, subject);
  const maxAttempts = getRetryAttempts(options);
  const retryDelayMs = getRetryDelayMs(options);

  if (!port) {
    logger.error('email', 'SMTP 配置无效', 'SMTP 端口配置无效，邮件发送已取消', {
      ...logDetails,
      raw_port: config.port,
    });
    throw new Error('SMTP 端口不正确');
  }

  logger.info('email', '邮件发送开始', '开始发送邮件', {
    ...logDetails,
    max_attempts: maxAttempts,
    retry_delay_ms: retryDelayMs,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      logger.info('email', '邮件发送尝试', '正在尝试发送邮件', {
        ...logDetails,
        attempt,
        max_attempts: maxAttempts,
      });

      const transporter = nodemailer.createTransport({
        host: config.host,
        port,
        secure: port === 465,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });

      const result = await transporter.sendMail({ from: config.from || config.user, to, subject, text });
      logger.info('email', '邮件发送成功', '邮件已成功发送', {
        ...logDetails,
        attempt,
        message_id: typeof result?.messageId === 'string' ? result.messageId : null,
        response: typeof result?.response === 'string' ? result.response : null,
      });
      return;
    } catch (error) {
      lastError = error;
      const willRetry = attempt < maxAttempts;
      logger[willRetry ? 'warn' : 'error'](
        'email',
        willRetry ? '邮件发送失败准备重试' : '邮件发送最终失败',
        willRetry ? '邮件发送失败，将在等待后重试' : '邮件发送已达到最大尝试次数',
        {
          ...logDetails,
          attempt,
          max_attempts: maxAttempts,
          next_retry_delay_ms: willRetry ? retryDelayMs : null,
          error,
        }
      );

      if (willRetry) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('邮件发送失败');
}
