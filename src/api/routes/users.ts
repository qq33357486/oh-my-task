import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import * as userService from '../../services/user.service.js';

const router = Router();

// GET /api/users - 获取用户列表（仅管理员）
router.get('/', adminOnly, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const requestedPageSize = parseInt(req.query.page_size as string) || 10;
  const pageSize = Math.min(Math.max(1, requestedPageSize), 100);
  const { users, total } = userService.getAllUsers(page, pageSize);
  const publicUsers = users.map(u => userService.toPublicUser(u));
  res.json({
    success: true,
    data: {
      users: publicUsers,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize)
      }
    }
  });
});

// GET /api/users/me - 当前用户信息
router.get('/me', (req, res) => {
  res.json({ success: true, data: { user: req.auth!.user } });
});

// DELETE /api/users/:id - 删除用户（仅管理员，不能删自己）
router.delete('/:id', adminOnly, (req, res) => {
  if (req.params.id === req.auth!.user.id) {
    res.status(403).json({ success: false, error: '不能删除自己的账号' });
    return;
  }
  const success = userService.deleteUser(req.params.id);
  if (!success) {
    res.status(404).json({ success: false, error: '用户不存在' });
    return;
  }
  res.json({ success: true, message: '用户已删除' });
});

export default router;
