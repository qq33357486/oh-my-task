import { Router } from 'express';
import * as scheduleService from '../../services/schedule.service.js';
import { getDb } from '../../db/connection.js';

const router = Router();
const TASK_STATUS = new Set(['planned', 'in_progress', 'done']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BULK_TASKS = 1000;
const MAX_HOLIDAYS = 500;

function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidDateOrDateTime(value: unknown): value is string {
  if (isValidDateString(value)) {
    return true;
  }
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

function isReasonableYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1970 && year <= 2100;
}

function taskBelongsToUser(taskId: string, userId: string): boolean {
  const db = getDb();
  const task = db.prepare(`
    SELECT t.id
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE t.id = ? AND p.owner_id = ? AND t.deleted_at IS NULL
  `).get(taskId, userId) as { id: string } | undefined;
  return Boolean(task);
}

function projectBelongsToUser(projectId: string, userId: string): boolean {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND owner_id = ?')
    .get(projectId, userId) as { id: string } | undefined;
  return Boolean(project);
}

function versionBelongsToProject(versionId: string, projectId: string): boolean {
  const db = getDb();
  const version = db.prepare('SELECT id FROM versions WHERE id = ? AND project_id = ?')
    .get(versionId, projectId) as { id: string } | undefined;
  return Boolean(version);
}

function validateHolidayItems(holidays: unknown[]): string | null {
  if (holidays.length > MAX_HOLIDAYS) {
    return `holidays cannot exceed ${MAX_HOLIDAYS} items`;
  }

  for (const holiday of holidays) {
    if (!holiday || typeof holiday !== 'object') {
      return 'holiday item must be an object';
    }
    const item = holiday as { date?: unknown; year?: unknown; is_workday?: unknown; name?: unknown };
    if (!isValidDateString(item.date)) {
      return 'holiday date is invalid';
    }
    if (typeof item.year !== 'number' || !isReasonableYear(item.year)) {
      return 'holiday year is invalid';
    }
    if (item.is_workday !== 0 && item.is_workday !== 1 && typeof item.is_workday !== 'boolean') {
      return 'holiday is_workday is invalid';
    }
    if (typeof item.name !== 'string' || item.name.length > 100) {
      return 'holiday name is invalid';
    }
  }

  return null;
}

// POST /api/schedule/reschedule - 重新排期
router.post('/reschedule', async (req, res) => {
  const { task_id, new_start_date } = req.body;
  
  if (!task_id || !new_start_date) {
    res.status(400).json({ success: false, error: 'task_id and new_start_date are required' });
    return;
  }
  if (typeof task_id !== 'string' || !isValidDateString(new_start_date)) {
    res.status(400).json({ success: false, error: 'Invalid task_id or new_start_date' });
    return;
  }
  if (!taskBelongsToUser(task_id, req.auth!.user.id)) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  try {
    const result = await scheduleService.rescheduleFromTask(task_id, new_start_date);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reschedule';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/schedule/auto - 自动排期
router.post('/auto', async (req, res) => {
  const { project_id, start_date, version_id } = req.body;
  
  if (!project_id || !start_date) {
    res.status(400).json({ success: false, error: 'project_id and start_date are required' });
    return;
  }
  if (typeof project_id !== 'string' || !isValidDateString(start_date)) {
    res.status(400).json({ success: false, error: 'Invalid project_id or start_date' });
    return;
  }
  if (version_id !== undefined && version_id !== null && typeof version_id !== 'string') {
    res.status(400).json({ success: false, error: 'Invalid version_id' });
    return;
  }
  if (!projectBelongsToUser(project_id, req.auth!.user.id)) {
    res.status(404).json({ success: false, error: 'Project not found' });
    return;
  }
  if (version_id && !versionBelongsToProject(version_id, project_id)) {
    res.status(404).json({ success: false, error: 'Version not found' });
    return;
  }

  try {
    const result = await scheduleService.autoSchedule(project_id, start_date, version_id);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to auto schedule';
    res.status(400).json({ success: false, error: message });
  }
});

// GET /api/schedule/holidays/:year - 获取年度节假日（自动从 API 获取）
router.get('/holidays/:year', async (req, res) => {
  const year = parseInt(req.params.year, 10);
  if (isNaN(year) || !isReasonableYear(year)) {
    res.status(400).json({ success: false, error: 'Invalid year' });
    return;
  }
  try {
    const holidays = await scheduleService.getHolidaysByYear(year);
    res.json({ success: true, data: holidays });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get holidays';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/schedule/holidays - 导入节假日（手动导入，一般不需要）
router.post('/holidays', (req, res) => {
  const { holidays } = req.body;
  
  if (req.auth!.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }

  if (!Array.isArray(holidays)) {
    res.status(400).json({ success: false, error: 'holidays array is required' });
    return;
  }
  const validationError = validateHolidayItems(holidays);
  if (validationError) {
    res.status(400).json({ success: false, error: validationError });
    return;
  }

  try {
    const count = scheduleService.importHolidays(holidays);
    res.json({ success: true, data: { imported: count } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to import holidays';
    res.status(400).json({ success: false, error: message });
  }
});

// POST /api/schedule/calculate-end-dates - 批量计算预期结束日期（用于前端进度图）
router.post('/calculate-end-dates', async (req, res) => {
  const { tasks, start_date } = req.body;
  
  if (!Array.isArray(tasks)) {
    res.status(400).json({ success: false, error: 'tasks array is required' });
    return;
  }
  if (tasks.length > MAX_BULK_TASKS) {
    res.status(400).json({ success: false, error: `tasks cannot exceed ${MAX_BULK_TASKS} items` });
    return;
  }
  if (start_date !== undefined && start_date !== null && !isValidDateString(start_date)) {
    res.status(400).json({ success: false, error: 'Invalid start_date' });
    return;
  }

  try {
    // 转换前端格式到服务层格式
    const input = tasks.map((t: { id: string; estimated_days?: number; status: string; actual_end?: string }) => {
      if (!t || typeof t.id !== 'string' || t.id.length > 128) {
        throw new Error('Invalid task id');
      }
      if (!TASK_STATUS.has(t.status)) {
        throw new Error('Invalid task status');
      }
      if (
        t.estimated_days !== undefined &&
        (!Number.isFinite(t.estimated_days) || t.estimated_days < 0 || t.estimated_days > 365)
      ) {
        throw new Error('Invalid estimated_days');
      }
      if (t.actual_end !== undefined && t.actual_end !== null && !isValidDateOrDateTime(t.actual_end)) {
        throw new Error('Invalid actual_end');
      }
      return {
        id: t.id,
        estimatedDays: t.estimated_days || 1,
        status: t.status,
        actualEnd: t.actual_end,
      };
    });
    
    const results = await scheduleService.calculateEndDates(input, start_date);
    res.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate end dates';
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
