import { Router, Request, Response } from 'express';
import {
  createToken,
  listTokens,
  deleteToken,
  maskToken
} from '../../services/token.service.js';

const router = Router();

/**
 * GET /api/tokens
 * 列出当前用户的所有 Token（token 值脱敏）
 */
router.get('/', (req: Request, res: Response) => {
  if (!req.auth?.user) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  const tokens = listTokens(req.auth.user.id);
  // 脱敏处理
  const maskedTokens = tokens.map(t => ({
    ...t,
    token: maskToken(t.token),
    plain_token: t.token
  }));

  res.json({
    success: true,
    data: { tokens: maskedTokens }
  });
});

/**
 * POST /api/tokens
 * 创建新 Token
 */
router.post('/', (req: Request, res: Response) => {
  if (!req.auth?.user) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  const { name } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ success: false, error: 'Token 名称不能为空' });
    return;
  }

  try {
    const token = createToken({
      user_id: req.auth.user.id,
      name
    });

    res.status(201).json({
      success: true,
      data: {
        token: {
          id: token.id,
          name: token.name,
          plain_token: token.plain_token,
          last_used_at: token.last_used_at,
          created_at: token.created_at
        }
      },
      message: 'Token 已创建，请立即保存！关闭后将无法再次查看完整 Token。'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建 Token 失败';
    res.status(400).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/tokens/:id
 * 删除 Token
 */
router.delete('/:id', (req: Request, res: Response) => {
  if (!req.auth?.user) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  const { id } = req.params;

  const deleted = deleteToken(id, req.auth.user.id);

  if (!deleted) {
    res.status(404).json({ success: false, error: 'Token 不存在' });
    return;
  }

  res.json({ success: true, message: 'Token 已删除' });
});

export default router;
