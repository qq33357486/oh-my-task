import { getDb } from '../db/connection.js';
import type { Task, Holiday } from '../types/index.js';

// 缓存已加载的年份，避免重复查询数据库
const loadedYears = new Set<number>();

// timor.tech API 返回的节假日信息类型
interface TimorHolidayInfo {
  date: string;
  name: string;
  holiday: boolean;
}

interface TimorApiResponse {
  code: number;
  holiday?: Record<string, TimorHolidayInfo>;
}

/**
 * 从 timor.tech API 获取节假日数据
 */
async function fetchHolidaysFromAPI(year: number): Promise<HolidayInput[]> {
  const response = await fetch(`https://timor.tech/api/holiday/year/${year}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch holidays for ${year}: ${response.status}`);
  }
  
  const data = await response.json() as TimorApiResponse;
  if (data.code !== 0 || !data.holiday) {
    throw new Error(`Invalid holiday data for ${year}`);
  }
  
  const holidays: HolidayInput[] = [];
  for (const [, info] of Object.entries(data.holiday)) {
    holidays.push({
      date: info.date,
      year,
      is_workday: !info.holiday, // holiday=true 表示放假，is_workday 应为 false
      name: info.name,
    });
  }
  
  return holidays;
}

/**
 * 确保指定年份的节假日数据已加载
 * 如果数据库中没有，则自动从 API 获取
 */
export async function ensureHolidaysLoaded(year: number): Promise<void> {
  // 内存缓存检查
  if (loadedYears.has(year)) {
    return;
  }
  
  const db = getDb();
  
  // 数据库检查
  const existing = db.prepare('SELECT COUNT(*) as count FROM holidays WHERE year = ?').get(year) as { count: number };
  if (existing.count > 0) {
    loadedYears.add(year);
    return;
  }
  
  // 从 API 获取并存入数据库
  try {
    console.log(`Fetching holidays for ${year} from timor.tech...`);
    const holidays = await fetchHolidaysFromAPI(year);
    importHolidays(holidays);
    loadedYears.add(year);
    console.log(`Loaded ${holidays.length} holiday entries for ${year}`);
  } catch (error) {
    console.warn(`Failed to fetch holidays for ${year}, using default weekday logic:`, error);
    // 失败时不抛出错误，使用默认的周一到周五逻辑
    // 标记为已加载，避免重复尝试
    loadedYears.add(year);
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析日期字符串
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * 检查日期是否为工作日（同步版本，需先确保节假日数据已加载）
 * 优先查数据库，否则按周一到周五判断
 */
export function isWorkdaySync(date: Date): boolean {
  const db = getDb();
  const dateStr = formatDate(date);
  
  // 先查数据库
  const holiday = db.prepare('SELECT * FROM holidays WHERE date = ?').get(dateStr) as Holiday | undefined;
  if (holiday) {
    return holiday.is_workday === 1;
  }
  
  // 默认：周一到周五是工作日
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * 检查日期是否为工作日（异步版本，自动加载节假日数据）
 */
export async function isWorkday(date: Date): Promise<boolean> {
  await ensureHolidaysLoaded(date.getFullYear());
  return isWorkdaySync(date);
}

/**
 * 添加工作日（同步版本，需先确保节假日数据已加载）
 */
export function addWorkdaysSync(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let remaining = days;
  
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isWorkdaySync(result)) {
      remaining--;
    }
  }
  
  return result;
}

/**
 * 添加工作日（异步版本，自动加载节假日数据）
 */
export async function addWorkdays(startDate: Date, days: number): Promise<Date> {
  await ensureHolidaysLoaded(startDate.getFullYear());
  await ensureHolidaysLoaded(startDate.getFullYear() + 1);
  return addWorkdaysSync(startDate, days);
}

/**
 * 计算两个日期之间的工作日数（同步版本）
 */
export function countWorkdaysSync(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkdaySync(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * 计算两个日期之间的工作日数（异步版本）
 */
export async function countWorkdays(startDate: Date, endDate: Date): Promise<number> {
  await ensureHolidaysLoaded(startDate.getFullYear());
  await ensureHolidaysLoaded(endDate.getFullYear());
  return countWorkdaysSync(startDate, endDate);
}

/**
 * 根据预估工时计算截止日期（同步版本）
 */
export function calculateDueDateSync(startDate: string, estimatedDays: number): string {
  const start = parseDate(startDate);
  const due = addWorkdaysSync(start, Math.ceil(estimatedDays));
  return formatDate(due);
}

/**
 * 根据预估工时计算截止日期（异步版本）
 */
export async function calculateDueDate(startDate: string, estimatedDays: number): Promise<string> {
  const start = parseDate(startDate);
  await ensureHolidaysLoaded(start.getFullYear());
  await ensureHolidaysLoaded(start.getFullYear() + 1);
  const due = addWorkdaysSync(start, Math.ceil(estimatedDays));
  return formatDate(due);
}

/**
 * 计算任务延期天数（同步版本）
 */
export function calculateDelaySync(task: Task): number {
  if (!task.due_date) return 0;
  
  const dueDate = parseDate(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (task.status === 'done' && task.actual_end) {
    const actualEnd = new Date(task.actual_end);
    actualEnd.setHours(0, 0, 0, 0);
    if (actualEnd > dueDate) {
      return countWorkdaysSync(dueDate, actualEnd);
    }
    return 0;
  }
  
  if (today > dueDate) {
    return countWorkdaysSync(dueDate, today);
  }
  
  return 0;
}

/**
 * 计算任务延期天数（异步版本）
 */
export async function calculateDelay(task: Task): Promise<number> {
  if (!task.due_date) return 0;
  
  const dueDate = parseDate(task.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  await ensureHolidaysLoaded(dueDate.getFullYear());
  await ensureHolidaysLoaded(today.getFullYear());
  
  if (task.status === 'done' && task.actual_end) {
    const actualEnd = new Date(task.actual_end);
    actualEnd.setHours(0, 0, 0, 0);
    await ensureHolidaysLoaded(actualEnd.getFullYear());
    if (actualEnd > dueDate) {
      return countWorkdaysSync(dueDate, actualEnd);
    }
    return 0;
  }
  
  if (today > dueDate) {
    return countWorkdaysSync(dueDate, today);
  }
  
  return 0;
}

/**
 * 重新排期：从指定任务开始，顺延后续任务（异步版本）
 * 如果 new_start_date 不是工作日，自动跳到下一个工作日
 */
export async function rescheduleFromTask(taskId: string, newStartDate: string): Promise<RescheduleResult> {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Task | undefined;

  if (!task) {
    throw new Error('Task not found');
  }
  
  // 预加载节假日数据
  const startYear = parseDate(newStartDate).getFullYear();
  await ensureHolidaysLoaded(startYear);
  await ensureHolidaysLoaded(startYear + 1);

  const changes: TaskScheduleChange[] = [];
  const now = new Date().toISOString();

  // 如果 new_start_date 不是工作日，自动跳到下一个工作日
  const adjustedStart = formatDate(getNextWorkdaySync(parseDate(newStartDate)));

  // 更新当前任务
  const newDueDate = task.estimated_days
    ? calculateDueDateSync(adjustedStart, task.estimated_days)
    : null;

  db.prepare(`
    UPDATE tasks SET start_date = ?, due_date = ?, updated_at = ? WHERE id = ?
  `).run(adjustedStart, newDueDate, now, taskId);

  changes.push({
    task_id: taskId,
    title: task.title,
    old_start: task.start_date,
    new_start: adjustedStart,
    old_due: task.due_date,
    new_due: newDueDate,
  });
  
  // 获取同级后续任务（按 sort_order 排序）
  const siblingTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE project_id = ? AND parent_id IS ? AND sort_order > ? AND id != ?
    ORDER BY sort_order ASC
  `).all(task.project_id, task.parent_id, task.sort_order, taskId) as Task[];
  
  // 顺延后续任务
  let lastDueDate = newDueDate || newStartDate;
  
  for (const sibling of siblingTasks) {
    // 下一个任务从上一个任务截止日期的下一个工作日开始
    const nextStart = formatDate(addWorkdaysSync(parseDate(lastDueDate), 1));
    const nextDue = sibling.estimated_days
      ? calculateDueDateSync(nextStart, sibling.estimated_days)
      : null;
    
    db.prepare(`
      UPDATE tasks SET start_date = ?, due_date = ?, updated_at = ? WHERE id = ?
    `).run(nextStart, nextDue, now, sibling.id);
    
    changes.push({
      task_id: sibling.id,
      title: sibling.title,
      old_start: sibling.start_date,
      new_start: nextStart,
      old_due: sibling.due_date,
      new_due: nextDue,
    });
    
    lastDueDate = nextDue || nextStart;
  }
  
  return { changes };
}

/**
 * 找到下一个工作日（跳过周末和节假日）
 */
export function getNextWorkdaySync(date: Date): Date {
  const result = new Date(date);
  while (!isWorkdaySync(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * 自动排期：为项目中未排期的任务自动分配日期（异步版本）
 * 如果 start_date 不是工作日，自动跳到下一个工作日
 */
export async function autoSchedule(projectId: string, startDate: string, versionId?: string): Promise<RescheduleResult> {
  const db = getDb();
  const changes: TaskScheduleChange[] = [];
  const now = new Date().toISOString();

  if (versionId) {
    const version = db.prepare('SELECT id FROM versions WHERE id = ? AND project_id = ?').get(versionId, projectId);
    if (!version) {
      const err = new Error('版本不存在或不属于该项目') as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
  }

  // 预加载节假日数据
  const startYear = parseDate(startDate).getFullYear();
  await ensureHolidaysLoaded(startYear);
  await ensureHolidaysLoaded(startYear + 1);

  // 如果 start_date 不是工作日，自动跳到下一个工作日
  let currentDate = formatDate(getNextWorkdaySync(parseDate(startDate)));

  const versionFilter = versionId ? 'AND version_id = ?' : '';
  const tasks = db.prepare(`
    SELECT * FROM tasks
    WHERE project_id = ? AND parent_id IS NULL AND deleted_at IS NULL ${versionFilter}
    ORDER BY sort_order ASC
  `).all(...(versionId ? [projectId, versionId] : [projectId])) as Task[];
  
  for (const task of tasks) {
    const taskStart = currentDate;
    const taskDue = task.estimated_days 
      ? calculateDueDateSync(taskStart, task.estimated_days)
      : taskStart;
    
    db.prepare(`
      UPDATE tasks SET start_date = ?, due_date = ?, updated_at = ? WHERE id = ?
    `).run(taskStart, taskDue, now, task.id);
    
    changes.push({
      task_id: task.id,
      title: task.title,
      old_start: task.start_date,
      new_start: taskStart,
      old_due: task.due_date,
      new_due: taskDue,
    });
    
    // 下一个任务从当前任务截止日期的下一个工作日开始
    currentDate = formatDate(addWorkdaysSync(parseDate(taskDue), 1));
  }
  
  if (versionId && changes.length > 0) {
    const dueDates = changes.map(change => change.new_due).filter((date): date is string => Boolean(date));
    const versionDueDate = dueDates[dueDates.length - 1] || changes[changes.length - 1].new_start;
    db.prepare('UPDATE versions SET start_date = ?, due_date = ?, updated_at = ? WHERE id = ?')
      .run(changes[0].new_start, versionDueDate, now, versionId);
    return {
      changes,
      version: {
        id: versionId,
        start_date: changes[0].new_start,
        due_date: versionDueDate,
      },
    };
  }

  return { changes };
}

/**
 * 批量计算预期结束日期（用于前端进度图）
 */
export interface CalculateEndDatesInput {
  id: string;
  estimatedDays: number;
  status: string;
  actualEnd?: string | null;
}

export interface CalculateEndDatesResult {
  id: string;
  startDate: string;
  endDate: string;
}

export async function calculateEndDates(
  tasks: CalculateEndDatesInput[],
  startDate?: string
): Promise<CalculateEndDatesResult[]> {
  const results: CalculateEndDatesResult[] = [];
  
  // 确定起始日期
  let currentDate = startDate ? parseDate(startDate) : new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  // 预加载节假日数据
  await ensureHolidaysLoaded(currentDate.getFullYear());
  await ensureHolidaysLoaded(currentDate.getFullYear() + 1);
  
  for (const task of tasks) {
    // 已完成的任务使用实际结束日期
    if (task.status === 'done' && task.actualEnd) {
      results.push({
        id: task.id,
        startDate: formatDate(currentDate),
        endDate: task.actualEnd.split('T')[0], // 取日期部分
      });
      continue;
    }
    
    // 未完成的任务计算预期结束日期
    const taskStart = formatDate(currentDate);
    const days = task.estimatedDays || 0;
    let endDate: Date;
    if (days <= 0) {
      endDate = new Date(currentDate);
    } else {
      endDate = addWorkdaysSync(currentDate, days);
    }

    results.push({
      id: task.id,
      startDate: taskStart,
      endDate: formatDate(endDate),
    });

    // 下一个任务从当前任务结束后的下一个工作日开始
    if (days <= 0) {
      currentDate = addWorkdaysSync(currentDate, 1);
    } else {
      currentDate = addWorkdaysSync(endDate, 1);
    }
  }
  
  return results;
}

/**
 * 导入节假日数据
 */
export function importHolidays(holidays: HolidayInput[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO holidays (date, year, is_workday, name)
    VALUES (?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const h of holidays) {
    stmt.run(h.date, h.year, h.is_workday ? 1 : 0, h.name || null);
    count++;
  }
  
  return count;
}

/**
 * 获取年度节假日（异步版本，自动加载）
 */
export async function getHolidaysByYear(year: number): Promise<Holiday[]> {
  await ensureHolidaysLoaded(year);
  const db = getDb();
  return db.prepare('SELECT * FROM holidays WHERE year = ? ORDER BY date').all(year) as Holiday[];
}

// 类型定义
export interface TaskScheduleChange {
  task_id: string;
  title: string;
  old_start: string | null;
  new_start: string;
  old_due: string | null;
  new_due: string | null;
}

export interface RescheduleResult {
  changes: TaskScheduleChange[];
  version?: {
    id: string;
    start_date: string;
    due_date: string;
  };
}

export interface HolidayInput {
  date: string;
  year: number;
  is_workday: boolean;
  name?: string;
}
