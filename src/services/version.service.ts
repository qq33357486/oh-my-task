import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import { ensureHolidaysLoaded, formatDate, parseDate, addWorkdaysSync } from './schedule.service.js';

export interface Version {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  locked_at: string | null;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface VersionStats {
  totalTasks: number;
  doneTasks: number;
  startDate: string | null;
  plannedDueDate: string | null;
  actualDueDate: string | null;
  delayDays: number;
  deviationDays: number;  // 进度误差：正数=延期，负数=提前
  insertedTasks: number;
  progress: number;
}

export interface CreateVersionParams {
  project_id: string;
  name: string;
  description?: string;
  start_date?: string;
  due_date: string;
}

export interface UpdateVersionParams {
  name?: string;
  description?: string;
  start_date?: string;
  due_date?: string;
}

/**
 * 获取项目的所有版本（验证归属）
 */
export function listVersions(projectId: string, userId: string): Version[] {
  const db = getDb();

  // 验证项目归属
  const project = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND owner_id = ?
  `).get(projectId, userId);

  if (!project) {
    return [];  // 无权限时返回空数组
  }

  return db.prepare(
    'SELECT * FROM versions WHERE project_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(projectId) as Version[];
}

/**
 * 根据 ID 获取版本（验证归属）
 */
export function getVersionById(id: string, userId: string): Version | null {
  const db = getDb();
  const version = db.prepare(`
    SELECT v.* FROM versions v
    JOIN projects p ON v.project_id = p.id
    WHERE v.id = ? AND p.owner_id = ?
  `).get(id, userId) as Version | undefined;
  return version || null;
}

/**
 * 内部使用：根据 ID 获取版本（不验证归属，仅供已通过权限校验的内部调用）
 */
export function getVersionByIdInternal(id: string): Version | null {
  const db = getDb();
  const version = db.prepare('SELECT * FROM versions WHERE id = ?').get(id) as Version | undefined;
  return version || null;
}

/**
 * 内部使用：更新版本字段（不验证归属）
 */
export function updateVersionInternal(id: string, params: UpdateVersionParams): Version | null {
  const db = getDb();
  const version = getVersionByIdInternal(id);
  if (!version) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (params.name !== undefined) { updates.push('name = ?'); values.push(params.name); }
  if (params.description !== undefined) { updates.push('description = ?'); values.push(params.description); }
  if (params.start_date !== undefined) { updates.push('start_date = ?'); values.push(params.start_date); }
  if (params.due_date !== undefined) { updates.push('due_date = ?'); values.push(params.due_date); }

  values.push(id);
  db.prepare(`UPDATE versions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return getVersionByIdInternal(id);
}

/**
 * 创建版本（验证归属）
 */
export function createVersion(params: CreateVersionParams, userId: string): Version | null {
  const db = getDb();

  // 验证项目归属
  const project = db.prepare(`
    SELECT id FROM projects WHERE id = ? AND owner_id = ?
  `).get(params.project_id, userId);

  if (!project) {
    return null;  // 无权限
  }

  if (!params.due_date) {
    const err = new Error('due_date 不能为空') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const unfinishedVersion = db.prepare(`
    SELECT id FROM versions
    WHERE project_id = ? AND completed_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1
  `).get(params.project_id);

  if (unfinishedVersion) {
    const err = new Error('该项目还有未结束版本，请先完成当前版本') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  // 获取最大 sort_order
  const maxOrder = db.prepare(
    'SELECT MAX(sort_order) as max_order FROM versions WHERE project_id = ?'
  ).get(params.project_id) as { max_order: number | null };
  const sortOrder = (maxOrder?.max_order ?? -1) + 1;

  db.prepare(`
    INSERT INTO versions (id, project_id, name, description, start_date, due_date, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.project_id,
    params.name,
    params.description || null,
    params.start_date || null,
    params.due_date || null,
    sortOrder,
    now,
    now
  );

  return getVersionById(id, userId)!;
}

/**
 * 更新版本（验证归属）
 */
export function updateVersion(id: string, params: UpdateVersionParams, userId: string): Version | null {
  const db = getDb();
  const version = getVersionById(id, userId);
  if (!version) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }

  if (params.description !== undefined) {
    updates.push('description = ?');
    values.push(params.description);
  }

  if (params.start_date !== undefined) {
    updates.push('start_date = ?');
    values.push(params.start_date);
  }

  if (params.due_date !== undefined) {
    updates.push('due_date = ?');
    values.push(params.due_date);
  }

  values.push(id);
  db.prepare(`UPDATE versions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  return getVersionById(id, userId);
}

/**
 * 删除版本（验证归属）
 */
export function deleteVersion(id: string, userId: string): boolean {
  const db = getDb();

  // 验证归属
  const version = db.prepare(`
    SELECT v.id FROM versions v
    JOIN projects p ON v.project_id = p.id
    WHERE v.id = ? AND p.owner_id = ?
  `).get(id, userId);

  if (!version) {
    return false;
  }

  // 先将该版本下的任务的 version_id 设为 null
  db.prepare('UPDATE tasks SET version_id = NULL WHERE version_id = ?').run(id);
  const result = db.prepare('DELETE FROM versions WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 重新排序版本（验证归属）
 */
export function reorderVersions(versionIds: string[], userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();

  // 校验所有 version 属于当前用户的项目
  for (const versionId of versionIds) {
    const version = db.prepare(`
      SELECT v.id FROM versions v
      JOIN projects p ON v.project_id = p.id
      WHERE v.id = ? AND p.owner_id = ?
    `).get(versionId, userId);
    if (!version) {
      throw new Error('无权操作该版本');
    }
  }

  versionIds.forEach((versionId, index) => {
    db.prepare('UPDATE versions SET sort_order = ?, updated_at = ? WHERE id = ?').run(index, now, versionId);
  });
}

/**
 * 开始版本（锁定为活跃状态）
 * 同一项目同一时间只能有一个未归档的活跃版本
 */
export function startVersion(versionId: string): Version {
  const db = getDb();
  const version = getVersionByIdInternal(versionId);
  if (!version) {
    const err = new Error('版本不存在') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  // 已锁定的版本幂等返回
  if (version.locked_at) {
    return version;
  }

  // 检查同一项目是否已有未归档的活跃版本
  const activeVersion = db.prepare(`
    SELECT id FROM versions
    WHERE project_id = ? AND locked_at IS NOT NULL AND archived_at IS NULL AND id != ?
  `).get(version.project_id, versionId);

  if (activeVersion) {
    const err = new Error('该项目已有活跃版本，请先归档当前活跃版本') as Error & { statusCode: number };
    err.statusCode = 409;
    throw err;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE versions SET locked_at = ?, updated_at = ? WHERE id = ?')
    .run(now, now, versionId);

  return getVersionByIdInternal(versionId)!;
}

/**
 * 完成版本
 * 所有任务必须完成，空版本不能完成
 */
export function completeVersion(versionId: string): Version {
  const db = getDb();
  const version = getVersionByIdInternal(versionId);
  if (!version) {
    const err = new Error('版本不存在') as Error & { statusCode: number };
    err.statusCode = 404;
    throw err;
  }

  if (!version.locked_at) {
    const err = new Error('版本尚未启动，无法完成') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  // 获取版本下所有未删除的任务
  const tasks = db.prepare(
    'SELECT id, status FROM tasks WHERE version_id = ? AND deleted_at IS NULL'
  ).all(versionId) as { id: string; status: string }[];

  // 空版本不能完成
  if (tasks.length === 0) {
    const err = new Error('版本下无任务，无法完成') as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  // 检查是否所有任务都已完成
  const allDone = tasks.every(t => t.status === 'done');
  if (!allDone) {
    const undone = tasks.filter(t => t.status !== 'done').length;
    const err = new Error(`版本下有 ${undone} 个未完成的任务`) as Error & { statusCode: number };
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE versions SET completed_at = ?, updated_at = ? WHERE id = ?')
    .run(now, now, versionId);

  return getVersionByIdInternal(versionId)!;
}

/**
 * 锁定版本（标记规划完成，进入执行阶段）— 内部使用
 */
export function lockVersion(versionId: string): Version | null {
  const db = getDb();
  const version = getVersionByIdInternal(versionId);
  if (!version || version.locked_at) return version;

  const now = new Date().toISOString();
  db.prepare('UPDATE versions SET locked_at = ?, updated_at = ? WHERE id = ?')
    .run(now, now, versionId);

  return getVersionByIdInternal(versionId);
}

interface TaskRow {
  id: string;
  status: string;
  estimated_days: number | null;
  due_date: string | null;
  actual_end: string | null;
  created_at: string;
  parent_id: string | null;
  sort_order: number;
}

/**
 * 获取版本统计信息（异步版本，基于工时计算实际预期日期）
 */
export async function getVersionStats(versionId: string): Promise<VersionStats | null> {
  const db = getDb();
  const version = getVersionByIdInternal(versionId);
  if (!version) return null;

  // 递归获取所有任务（含子任务）
  const allTasks = db.prepare(`
    WITH RECURSIVE task_tree AS (
      SELECT id, status, estimated_days, due_date, actual_end, created_at, parent_id, sort_order FROM tasks WHERE version_id = ?
      UNION ALL
      SELECT t.id, t.status, t.estimated_days, t.due_date, t.actual_end, t.created_at, t.parent_id, t.sort_order FROM tasks t
      INNER JOIN task_tree tt ON t.parent_id = tt.id
    )
    SELECT * FROM task_tree
  `).all(versionId) as TaskRow[];

  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // 获取顶层任务（按 sort_order 排序）用于计算实际预期日期
  const topLevelTasks = allTasks
    .filter(t => t.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);

  // 基于工时计算实际预期日期
  let actualDueDate: string | null = null;
  
  if (topLevelTasks.length > 0) {
    // 确定起始日期：使用版本的 start_date，否则使用今天
    const startDateStr = version.start_date || formatDate(new Date());
    let currentDate = parseDate(startDateStr);
    
    // 预加载节假日数据
    await ensureHolidaysLoaded(currentDate.getFullYear());
    await ensureHolidaysLoaded(currentDate.getFullYear() + 1);
    
    for (const task of topLevelTasks) {
      // 已完成的任务使用实际结束日期
      if (task.status === 'done' && task.actual_end) {
        const actualEnd = task.actual_end.split('T')[0];
        if (!actualDueDate || actualEnd > actualDueDate) {
          actualDueDate = actualEnd;
        }
        // 下一个任务从实际结束日期后开始
        currentDate = addWorkdaysSync(parseDate(actualEnd), 1);
        continue;
      }
      
      // 未完成的任务计算预期结束日期
      const days = task.estimated_days || 1;
      const endDate = addWorkdaysSync(currentDate, days);
      const endDateStr = formatDate(endDate);
      
      if (!actualDueDate || endDateStr > actualDueDate) {
        actualDueDate = endDateStr;
      }
      
      // 下一个任务从当前任务结束后的下一个工作日开始
      currentDate = addWorkdaysSync(endDate, 1);
    }
  }

  // 计划交付日期：优先使用版本的 due_date
  const plannedDueDate = version.due_date || null;

  // 计算进度误差（天数）：实际预期 - 计划交付
  let deviationDays = 0;
  if (plannedDueDate && actualDueDate) {
    const planned = parseDate(plannedDueDate);
    const actual = parseDate(actualDueDate);
    deviationDays = Math.ceil((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  }

  // 中途新增任务数（锁定后创建的顶层任务）
  let insertedTasks = 0;
  if (version.locked_at) {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE version_id = ? 
        AND parent_id IS NULL 
        AND created_at > ?
    `).get(versionId, version.locked_at) as { count: number };
    insertedTasks = result.count;
  }

  return {
    totalTasks,
    doneTasks,
    startDate: version.start_date,
    plannedDueDate,
    actualDueDate,
    delayDays: Math.max(0, deviationDays), // 保持向后兼容
    deviationDays, // 新增：可以是负数（提前）
    insertedTasks,
    progress,
  };
}
