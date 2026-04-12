import nodemailer from 'nodemailer';
import { getConfig } from '../services/config.service.js';

/**
 * 发送邮件
 * SMTP 未配置时，将验证码打印到日志
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const host = getConfig('smtp_host');
  const port = getConfig('smtp_port');
  const user = getConfig('smtp_user');
  const pass = getConfig('smtp_pass');
  const from = getConfig('smtp_from') || user || '';

  if (!host || !user || !pass) {
    console.log(`[Email] SMTP 未配置，邮件内容输出到日志:`);
    console.log(`[Email] To: ${to}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] ${text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587', 10),
    secure: parseInt(port || '587', 10) === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({ from, to, subject, text });
}
