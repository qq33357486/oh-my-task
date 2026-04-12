import { Router } from 'express';
import * as scheduleService from '../../services/schedule.service.js';

const router = Router();

// POST /api/schedule/reschedule - 重新排期
router.post('/reschedule', async (req, res) => {
  const { task_id, new_start_date } = req.body;
  
  if (!task_id || !new_start_date) {
    res.status(400).json({ success: false, error: 'task_id and new_start_date are required' });
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
  const { project_id, start_date } = req.body;
  
  if (!project_id || !start_date) {
    res.status(400).json({ success: false, error: 'project_id and start_date are required' });
    return;
  }

  try {
    const result = await scheduleService.autoSchedule(project_id, start_date);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to auto schedule';
    res.status(400).json({ success: false, error: message });
  }
});

// GET /api/schedule/holidays/:year - 获取年度节假日（自动从 API 获取）
router.get('/holidays/:year', async (req, res) => {
  const year = parseInt(req.params.year, 10);
  if (isNaN(year)) {
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
  
  if (!Array.isArray(holidays)) {
    res.status(400).json({ success: false, error: 'holidays array is required' });
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

  try {
    // 转换前端格式到服务层格式
    const input = tasks.map((t: { id: string; estimated_days?: number; status: string; actual_end?: string }) => ({
      id: t.id,
      estimatedDays: t.estimated_days || 1,
      status: t.status,
      actualEnd: t.actual_end,
    }));
    
    const results = await scheduleService.calculateEndDates(input, start_date);
    res.json({ success: true, data: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to calculate end dates';
    res.status(400).json({ success: false, error: message });
  }
});

export default router;
