import { Router } from 'express';
import * as taskService from '../../services/task.service.js';
import * as projectService from '../../services/project.service.js';
import type { ListTasksParams, CreateTaskParams, UpdateTaskParams } from '../../types/index.js';

const router = Router();

// GET /api/tasks - 获取任务列表
router.get('/', (req, res) => {
  const userId = req.auth!.user.id;

  const params: ListTasksParams = {
    project_id: req.query.project_id as string | undefined,
    version_id: req.query.version_id === 'null' ? null : req.query.version_id as string | undefined,
    parent_id: req.query.parent_id === 'null' ? null : req.query.parent_id as string | undefined,
    status: req.query.status as ListTasksParams['status'],
  };

  // 验证项目归属
  if (params.project_id) {
    const hasAccess = projectService.checkProjectOwnership(params.project_id, userId);
    if (!hasAccess) {
      res.status(404).json({ success: false, error: '项目不存在' });
      return;
    }
  }

  const tasks = taskService.listTasks(params, userId);
  res.json({ success: true, data: tasks });
});

// PUT /api/tasks/reorder - 重新排序任务 (must be before /:id)
router.put('/reorder', (req, res) => {
  const { task_ids, parent_id } = req.body;
  if (!task_ids || !Array.isArray(task_ids)) {
    res.status(400).json({ success: false, error: 'task_ids 必须是数组' });
    return;
  }
  const userId = req.auth!.user.id;
  try {
    taskService.reorderTasks(task_ids, parent_id ?? null, userId);
    res.json({ success: true, message: '任务排序已更新' });
  } catch (error) {
    res.status(403).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/tasks/:id - 获取任务详情（含子任务树）
router.get('/:id', (req, res) => {
  const userId = req.auth!.user.id;
  const task = taskService.getTaskWithChildren(req.params.id, userId);
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  res.json({ success: true, data: task });
});

// POST /api/tasks - 创建任务
router.post('/', (req, res, next) => {
  const { project_id, version_id, parent_id, title, description, notes, estimated_days, start_date, due_date } = req.body;
  const userId = req.auth!.user.id;

  if (!project_id) {
    res.status(400).json({ success: false, error: 'project_id 不能为空' });
    return;
  }
  if (!title) {
    res.status(400).json({ success: false, error: 'title 不能为空' });
    return;
  }

  // 验证项目归属
  const hasAccess = projectService.checkProjectOwnership(project_id, userId);
  if (!hasAccess) {
    res.status(404).json({ success: false, error: '项目不存在' });
    return;
  }

  const params: CreateTaskParams = {
    project_id,
    version_id,
    parent_id,
    title,
    description,
    notes,
    estimated_days,
    start_date,
    due_date,
  };

  try {
    const task = taskService.createTask(params, userId);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// PUT /api/tasks/:id - 更新任务
router.put('/:id', (req, res, next) => {
  const { title, description, notes, status, estimated_days, start_date, due_date, version_id, reason } = req.body;
  const userId = req.auth!.user.id;

  // 验证 title 非空（如果提供了 title）
  if (title !== undefined && !title) {
    res.status(400).json({ success: false, error: 'title 不能为空' });
    return;
  }

  try {
    const params: UpdateTaskParams = {
      title,
      description,
      notes,
      status,
      estimated_days,
      start_date,
      due_date,
      version_id,
      reason
    };

    const task = taskService.updateTask(req.params.id, params, userId);
    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/activate - 激活任务
router.post('/:id/activate', async (req, res, next) => {
  const userId = req.auth!.user.id;

  try {
    const task = taskService.activateTask(req.params.id, userId);
    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks/:id/complete - 完成任务
router.post('/:id/complete', async (req, res, next) => {
  const userId = req.auth!.user.id;
  try {
    const task = taskService.completeTask(req.params.id, userId);
    if (!task) {
      res.status(404).json({ success: false, error: '任务不存在' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/tasks/:id - 删除任务（软删除）
router.delete('/:id', (req, res) => {
  const userId = req.auth!.user.id;

  const task = taskService.getTaskById(req.params.id, userId);
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }

  const success = taskService.deleteTask(req.params.id, userId);
  if (!success) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  res.json({ success: true, message: '任务已删除' });
});

// GET /api/tasks/:id/history - 获取任务历史
router.get('/:id/history', (req, res) => {
  const userId = req.auth!.user.id;

  const task = taskService.getTaskById(req.params.id, userId);
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  const history = taskService.getTaskHistory(req.params.id);
  res.json({ success: true, data: history });
});

// POST /api/tasks/:id/history - 添加任务备注
router.post('/:id/history', (req, res) => {
  const { note } = req.body;
  if (!note) {
    res.status(400).json({ success: false, error: 'note 不能为空' });
    return;
  }

  const userId = req.auth!.user.id;

  const task = taskService.getTaskById(req.params.id, userId);
  if (!task) {
    res.status(404).json({ success: false, error: '任务不存在' });
    return;
  }
  const history = taskService.addTaskNote(req.params.id, note, userId);
  res.status(201).json({ success: true, data: history });
});

export default router;
