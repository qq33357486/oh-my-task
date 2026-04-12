import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import * as adminService from '../../services/admin.service.js';

const router = Router();

// GET /api/admin/stats - 用户统计（仅管理员）
router.get('/stats', adminOnly, (_req, res) => {
  const newUsers = adminService.getNewUsersStats();
  const dau = adminService.getDAU();
  const retention = adminService.getRetentionStats();

  res.json({
    success: true,
    data: {
      newUsers,
      dau,
      retention
    }
  });
});

export default router;
