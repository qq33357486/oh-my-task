import { Router, Request, Response } from 'express';
import { createUser, loginUser, getUserById, toPublicUser, changePassword, sendPasswordResetCode, resetPassword, sendEmailCode, verifyEmailCode } from '../../services/user.service.js';
import { isRegistrationEnabled } from '../../services/config.service.js';
import { ensureDefaultToken } from '../../services/token.service.js';
import { getDb } from '../../db/connection.js';

const router = Router();

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

/**
 * 从请求中获取认证用户（Session Cookie 或 Bearer Token）
 */
function getAuthenticatedUser(req: Request): { id: string; name: string; email: string; role: string } | null {
  // 方式1：Session 认证
  if (req.session?.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      return toPublicUser(user) as { id: string; name: string; email: string; role: string };
    }
  }

  // 方式2：Bearer Token
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const db = getDb();

      const tokenRecord = db.prepare(`
        SELECT ut.user_id
        FROM user_tokens ut
        JOIN users u ON ut.user_id = u.id
        WHERE ut.token = ?
      `).get(token) as { user_id: string } | undefined;

      if (tokenRecord) {
        const user = getUserById(tokenRecord.user_id);
        if (user) {
          // 更新最后使用时间
          db.prepare('UPDATE user_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?').run(token);
          return toPublicUser(user) as { id: string; name: string; email: string; role: string };
        }
      }
    }
  }

  return null;
}

// 发送注册验证码
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: '请输入邮箱' });
      return;
    }

    // 检查注册是否开启
    if (!isRegistrationEnabled()) {
      const db = getDb();
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
      if (userCount.count > 0) {
        res.status(403).json({ success: false, error: '注册功能已关闭' });
        return;
      }
    }

    await sendEmailCode(email);
    res.json({ success: true, message: '验证码已发送，请查收邮件' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '发送失败';
    if (message.includes('已注册') || message.includes('已被使用')) {
      res.status(409).json({ success: false, error: message });
      return;
    }
    res.status(400).json({ success: false, error: message });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, code } = req.body;
    const db = getDb();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const isInitialSetup = userCount.count === 0;

    if (!email || !password) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }

    // 检查注册是否开启（数据库无用户时始终允许，用于创建第一个 admin）
    if (!isRegistrationEnabled() && !isInitialSetup) {
      res.status(403).json({ success: false, error: '注册功能已关闭' });
      return;
    }

    // 首次初始化管理员不需要邮箱验证码；普通生产注册必须校验验证码
    if (!isInitialSetup && process.env.NODE_ENV === 'production') {
      if (!code) {
        res.status(400).json({ success: false, error: '缺少必填字段' });
        return;
      }
      verifyEmailCode(email, code);
    } else if (!isInitialSetup && code) {
      verifyEmailCode(email, code);
    }

    const user = await createUser({ email, password, code: code || '' });
    ensureDefaultToken(user.id);

    req.session.userId = user.id;

    res.json({
      success: true,
      data: { user: toPublicUser(user) }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '注册失败';
    if (message.includes('已被使用')) {
      res.status(409).json({ success: false, error: message });
      return;
    }
    res.status(400).json({ success: false, error: message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: '缺少邮箱或密码' });
      return;
    }

    const user = await loginUser({ email, password });
    ensureDefaultToken(user.id);

    req.session.userId = user.id;

    res.json({
      success: true,
      data: {
        user: toPublicUser(user)
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录失败';
    res.status(401).json({ success: false, error: message });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, error: '登出失败' });
      return;
    }
    res.clearCookie('omt_session_id');
    res.json({ success: true, message: '已登出' });
  });
});

router.get('/me', (req: Request, res: Response) => {
  const user = getAuthenticatedUser(req);

  if (!user) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  res.json({
    success: true,
    data: {
      user
    }
  });
});

router.post('/change-password', async (req: Request, res: Response) => {
  try {
    if (!req.session.userId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }

    const user = getUserById(req.session.userId);
    if (!user) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }

    await changePassword({ userId: user.id, oldPassword: old_password, newPassword: new_password });

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '密码修改失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: '请输入邮箱地址' });
      return;
    }

    await sendPasswordResetCode(email);

    res.json({ 
      success: true, 
      message: '如果该邮箱已注册，您将收到密码重置验证码' 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求失败';
    res.status(400).json({ success: false, error: message });
  }
});

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }

    await resetPassword({ email, code, newPassword: new_password });

    res.json({ success: true, message: '密码重置成功，请使用新密码登录' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '密码重置失败';
    res.status(400).json({ success: false, error: message });
  }
});

// 公开接口：查询注册是否开启（无需认证）
router.get('/registration-status', (_req: Request, res: Response) => {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const needsSetup = userCount.count === 0;

  res.json({
    success: true,
    data: { enabled: needsSetup || isRegistrationEnabled(), needs_setup: needsSetup }
  });
});

export default router;
