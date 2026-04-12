import { Request, Response, NextFunction } from 'express';
import { getDb } from '../../db/connection.js';
import { getUserById, toPublicUser } from '../../services/user.service.js';
import type { User, AuthContext } from '../../types/index.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * 认证中间件
 * 支持两种认证方式：
 * 1. Session（网页端）
 * 2. Bearer Token（API/MCP）
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 方式1：Session 认证
  if (req.session?.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      req.auth = { user: toPublicUser(user) as User };
      return next();
    }
  }

  // 方式2：Bearer Token
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const db = getDb();

      // 检查是否是 API Token
      const tokenRecord = db.prepare(`
        SELECT ut.*, u.id as user_id
        FROM user_tokens ut
        JOIN users u ON ut.user_id = u.id
        WHERE ut.token = ?
      `).get(token) as { user_id: string } | undefined;

      if (tokenRecord) {
        const user = getUserById(tokenRecord.user_id);
        if (user) {
          // 更新最后使用时间
          db.prepare('UPDATE user_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = ?').run(token);
          req.auth = { user: toPublicUser(user) as User };
          return next();
        }
      }
    }
  }

  res.status(401).json({ success: false, error: 'Authentication required' });
}

/**
 * 可选认证（允许未认证访问）
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      req.auth = { user: toPublicUser(user) as User };
    }
  } else if (req.headers.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.slice(7);
    const db = getDb();
    
    const tokenRecord = db.prepare(`
      SELECT ut.*, u.id as user_id 
      FROM user_tokens ut 
      JOIN users u ON ut.user_id = u.id 
      WHERE ut.token = ?
    `).get(token) as { user_id: string } | undefined;

    if (tokenRecord) {
      const user = getUserById(tokenRecord.user_id);
      if (user) {
        req.auth = { user: toPublicUser(user) as User };
      }
    }
  }
  next();
}

/**
 * 管理员权限检查中间件
 */
export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || req.auth.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}
