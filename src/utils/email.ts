import nodemailer from 'nodemailer';
import { getConfig } from '../services/config.service.js';

export interface EmailConfig {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
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

  if (!config.host || !config.user || !config.pass) {
    console.log(`[Email] SMTP 未配置，邮件内容输出到日志:`);
    console.log(`[Email] To: ${to}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] ${text}`);
    return;
  }

  await sendEmailWithConfig(config, to, subject, text);
}

export async function sendEmailWithConfig(
  config: EmailConfig,
  to: string,
  subject: string,
  text: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port || '587', 10),
    secure: parseInt(config.port || '587', 10) === 465,
    auth: { user: config.user, pass: config.pass },
  });

  await transporter.sendMail({ from: config.from || config.user, to, subject, text });
}
