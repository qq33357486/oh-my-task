import { Router } from 'express';
import * as versionService from '../../services/version.service.js';
import * as projectService from '../../services/project.service.js';
import { getDb } from '../../db/connection.js';

const router = Router();

// GET /api/versions - 获取项目的所有版本
router.get('/', (req, res) => {
  const projectId = req.query.project_id as string;
  if (!projectId) {
    res.status(400).json({ success: false, error: 'project_id 不能为空' });
    return;
  }

  const userId = req.auth!.user.id;

  // 验证项目归属
  const hasAccess = projectService.checkProjectOwnership(projectId, userId);
  if (!hasAccess) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  // 只返回未归档的版本
  const versions = versionService.listVersions(projectId, userId).filter(v => !v.archived_at);
  res.json({ success: true, data: versions });
});

// PUT /api/versions/reorder - 重新排序版本 (must be before /:id)
router.put('/reorder', (req, res) => {
  const { version_ids } = req.body;
  if (!version_ids || !Array.isArray(version_ids)) {
    res.status(400).json({ success: false, error: 'version_ids 必须是数组' });
    return;
  }
  const userId = req.auth!.user.id;
  try {
    versionService.reorderVersions(version_ids, userId);
    res.json({ success: true, message: '版本排序已更新' });
  } catch (error) {
    res.status(403).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/versions/:id/stats - 获取版本统计信息
router.get('/:id/stats', async (req, res) => {
  const userId = req.auth!.user.id;

  try {
    // 验证归属
    const version = versionService.getVersionById(req.params.id, userId);
    if (!version) {
      res.status(404).json({ success: false, error: '版本不存在' });
      return;
    }

    const stats = await versionService.getVersionStats(req.params.id);
    if (!stats) {
      res.status(404).json({ success: false, error: '版本不存在' });
      return;
    }
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/versions/:id - 获取版本详情
router.get('/:id', (req, res) => {
  const userId = req.auth!.user.id;
  const version = versionService.getVersionById(req.params.id, userId);
  if (!version) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }
  res.json({ success: true, data: version });
});

// POST /api/versions - 创建版本
router.post('/', (req, res) => {
  const { project_id, name, description, start_date, due_date } = req.body;
  const userId = req.auth!.user.id;

  if (!project_id) {
    res.status(400).json({ success: false, error: 'project_id 不能为空' });
    return;
  }
  if (!name) {
    res.status(400).json({ success: false, error: 'name 不能为空' });
    return;
  }
  // 验证项目归属
  const hasAccess = projectService.checkProjectOwnership(project_id, userId);
  if (!hasAccess) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  const version = versionService.createVersion({
    project_id,
    name,
    description,
    start_date,
    due_date,
  }, userId);

  if (!version) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  res.status(201).json({ success: true, data: version });
});

// PUT /api/versions/:id - 更新版本
router.put('/:id', (req, res) => {
  const { name, description, start_date, due_date } = req.body;
  const userId = req.auth!.user.id;

  const version = versionService.updateVersion(req.params.id, {
    name,
    description,
    start_date,
    due_date,
  }, userId);

  if (!version) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }
  res.json({ success: true, data: version });
});

// POST /api/versions/:id/start - 开始版本（锁定）
router.post('/:id/start', (req, res) => {
  const userId = req.auth!.user.id;

  // 验证归属
  const version = versionService.getVersionById(req.params.id, userId);
  if (!version) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }

  try {
    const result = versionService.startVersion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/versions/:id/complete - 完成版本
router.post('/:id/complete', (req, res) => {
  const userId = req.auth!.user.id;

  // 验证归属
  const version = versionService.getVersionById(req.params.id, userId);
  if (!version) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }

  try {
    const result = versionService.completeVersion(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// POST /api/versions/:id/archive - 归档版本
router.post('/:id/archive', (req, res) => {
  const userId = req.auth!.user.id;

  const version = versionService.getVersionById(req.params.id, userId);
  if (!version) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }

  const db = getDb();
  const now = new Date().toISOString();

  // 标记版本为归档
  db.prepare('UPDATE versions SET archived_at = ?, updated_at = ? WHERE id = ?').run(now, now, req.params.id);

  res.json({
    success: true,
    data: {
      id: version.id,
      name: version.name,
    }
  });
});

// DELETE /api/versions/:id - 删除版本
router.delete('/:id', (req, res) => {
  const userId = req.auth!.user.id;
  const success = versionService.deleteVersion(req.params.id, userId);
  if (!success) {
    res.status(404).json({ success: false, error: '版本不存在' });
    return;
  }
  res.json({ success: true, message: '版本已删除' });
});

export default router;
