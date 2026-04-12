import { Request, Response, NextFunction } from 'express';
import { getDb } from '../../db/connection.js';

/**
 * 检查项目归属
 * 验证请求中的项目 ID 是否属于当前用户
 */
export function checkProjectOwnership(
  paramName: string = 'project_id',
  location: 'body' | 'query' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.auth?.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    // 获取项目 ID
    const projectId = location === 'body' 
      ? req.body[paramName] 
      : req.query[paramName] as string;

    if (!projectId) {
      // 如果没有项目 ID，跳过检查（可能在创建新项目）
      return next();
    }

    const db = getDb();
    const project = db.prepare(`
      SELECT owner_id FROM projects WHERE id = ?
    `).get(projectId) as { owner_id: string | null } | undefined;

    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }

    if (project.owner_id !== userId) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }

    next();
  };
}

/**
 * 检查任务归属
 * 通过任务的 project_id 关联验证归属
 */
export function checkTaskOwnership(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.auth?.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const taskId = req.params[paramName];
    if (!taskId) {
      res.status(400).json({ success: false, error: '缺少任务 ID' });
      return;
    }

    const db = getDb();
    const task = db.prepare(`
      SELECT t.id, p.owner_id 
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND t.deleted_at IS NULL
    `).get(taskId) as { id: string; owner_id: string | null } | undefined;

    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }

    if (task.owner_id !== userId) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }

    next();
  };
}

/**
 * 检查版本归属
 * 通过版本的 project_id 关联验证归属
 */
export function checkVersionOwnership(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.auth?.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const versionId = req.params[paramName];
    if (!versionId) {
      res.status(400).json({ success: false, error: '缺少版本 ID' });
      return;
    }

    const db = getDb();
    const version = db.prepare(`
      SELECT v.id, p.owner_id 
      FROM versions v
      JOIN projects p ON v.project_id = p.id
      WHERE v.id = ?
    `).get(versionId) as { id: string; owner_id: string | null } | undefined;

    if (!version) {
      res.status(404).json({ success: false, error: '版本不存在' });
      return;
    }

    if (version.owner_id !== userId) {
      res.status(404).json({ success: false, error: '版本不存在' });
      return;
    }

    next();
  };
}
