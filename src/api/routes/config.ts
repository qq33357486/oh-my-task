import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import * as configService from '../../services/config.service.js';
import { sendEmailWithConfig } from '../../utils/email.js';
import { validateEmail } from '../../utils/validation.js';
import type { EmailConfig } from '../../utils/email.js';

const router = Router();

const ALLOWED_KEYS = ['server_url', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'registration_enabled'];

router.get('/', adminOnly, (_req, res) => {
  const config = configService.getAllConfig();
  res.json({ success: true, data: config });
});

router.put('/', adminOnly, (req, res) => {
  const config = req.body;
  configService.setMultipleConfig(config);
  const updatedConfig = configService.getAllConfig();
  res.json({ success: true, data: updatedConfig });
});

router.put('/:key', adminOnly, (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!ALLOWED_KEYS.includes(key)) {
    res.status(400).json({ success: false, error: `不允许修改配置项: ${key}` });
    return;
  }

  if (!value && value !== '0') {
    res.status(400).json({ success: false, error: 'Value is required' });
    return;
  }

  configService.setConfig(key, value);
  res.json({ success: true, data: { key, value } });
});

router.post('/test-email', adminOnly, async (req, res, next) => {
  try {
    const config = toEmailConfig(req.body);
    const to = typeof req.body.to === 'string' && req.body.to.trim()
      ? req.body.to.trim()
      : req.auth!.user.email;

    if (!validateEmail(to)) {
      res.status(400).json({ success: false, error: '测试收件人邮箱格式不正确' });
      return;
    }

    const missingField = getMissingEmailConfigField(config);
    if (missingField) {
      res.status(400).json({ success: false, error: `${missingField} is required` });
      return;
    }

    if (!validateEmail(config.from)) {
      res.status(400).json({ success: false, error: '发件人邮箱格式不正确' });
      return;
    }

    const port = Number.parseInt(config.port, 10);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      res.status(400).json({ success: false, error: 'SMTP 端口不正确' });
      return;
    }

    await sendEmailWithConfig(
      config,
      to,
      'oh-my-task 邮件发送测试',
      `这是一封来自 oh-my-task 的测试邮件。\n发送时间：${new Date().toISOString()}`
    );

    res.json({ success: true, data: { message: '测试邮件已发送' } });
  } catch (error) {
    next(error);
  }
});

function toEmailConfig(body: Record<string, unknown>): EmailConfig {
  return {
    host: stringValue(body.smtp_host),
    port: stringValue(body.smtp_port) || '587',
    user: stringValue(body.smtp_user),
    pass: stringValue(body.smtp_pass),
    from: stringValue(body.smtp_from),
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getMissingEmailConfigField(config: EmailConfig): string | null {
  if (!config.host) return 'SMTP 服务器';
  if (!config.user) return 'SMTP 用户名';
  if (!config.pass) return 'SMTP 密码';
  if (!config.from) return '发件人邮箱';
  return null;
}

export default router;
