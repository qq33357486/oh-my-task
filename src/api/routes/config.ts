import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import * as configService from '../../services/config.service.js';

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

export default router;
