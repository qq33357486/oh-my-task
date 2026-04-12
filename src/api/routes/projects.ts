import { Router } from 'express';
import * as projectService from '../../services/project.service.js';

const router = Router();

// GET /api/projects - 获取当前用户的项目
router.get('/', (req, res) => {
  const userId = req.auth!.user.id;
  const projects = projectService.listProjects(userId);
  res.json({ success: true, data: projects });
});

// GET /api/projects/:id - 获取项目详情
router.get('/:id', (req, res) => {
  const userId = req.auth!.user.id;
  const project = projectService.getProjectById(req.params.id, userId);
  if (!project) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, data: project });
});

// POST /api/projects - 创建项目
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400).json({ success: false, error: '项目名称不能为空' });
    return;
  }
  const userId = req.auth!.user.id;
  try {
    const project = projectService.createProject(name, description, userId);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id - 更新项目
router.put('/:id', (req, res) => {
  const { name, description } = req.body;
  const userId = req.auth!.user.id;
  try {
    const project = projectService.updateProject(req.params.id, { name, description }, userId);
    if (!project) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }
    res.json({ success: true, data: project });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:id - 删除项目
router.delete('/:id', (req, res) => {
  const userId = req.auth!.user.id;
  const success = projectService.deleteProject(req.params.id, userId);
  if (!success) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }
  res.json({ success: true, message: '项目已删除' });
});

export default router;
