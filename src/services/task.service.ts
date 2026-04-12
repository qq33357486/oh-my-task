import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';
import type {
  Task,
  TaskWithChildren,
  TaskHistory,
  CreateTaskParams,
  UpdateTaskParams,
  ListTasksParams,
} from '../types/index.js';
import * as versionService from './version.service.js';
import { ensureHolidaysLoaded, formatDate, parseDate, addWorkdaysSync, isWorkdaySync } from './schedule.service.js';

/**
 * 获取任务列表（支持用户过滤）
 */
export function listTasks(params: ListTasksParams, userId: string): Task[] {
  const db = getDb();
  const conditions: string[] = ['t.deleted_at IS NULL'];  // 默认不显示已删除
  const values: unknown[] = [];

  // 用户过滤：通过项目关联
  conditions.push('p.owner_id = ?');
  values.push(userId);

  if (params.project_id) {
    conditions.push('t.project_id = ?');
    values.push(params.project_id);
  }

  if (params.version_id !== undefined) {
    if (params.version_id === null) {
      conditions.push('t.version_id IS NULL');
    } else {
      conditions.push('t.version_id = ?');
      values.push(params.version_id);
    }
  }

  if (params.parent_id !== undefined) {
    if (params.parent_id === null) {
      conditions.push('t.parent_id IS NULL');
    } else {
      conditions.push('t.parent_id = ?');
      values.push(params.parent_id);
    }
  }

  if (params.status) {
    conditions.push('t.status = ?');
    values.push(params.status);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `SELECT t.* FROM tasks t JOIN projects p ON t.project_id = p.id ${whereClause} ORDER BY t.sort_order ASC, t.created_at ASC`;

  return db.prepare(sql).all(...values) as Task[];
}

/**
 * 根据 ID 获取任务（验证归属）
 */
export function getTaskById(id: string, userId?: string): Task | null {
  const db = getDb();

  if (userId) {
    const task = db.prepare(`
      SELECT t.* FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = ? AND p.owner_id = ? AND t.deleted_at IS NULL
    `).get(id, userId) as Task | undefined;
    return task || null;
  }

  // 内部调用（无 userId）：不做归属校验
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id) as Task | undefined;
  return task || null;
}

/**
 * 获取任务详情（含子任务树，验证归属）
 */
export function getTaskWithChildren(id: string, userId?: string): TaskWithChildren | null {
  const db = getDb();

  const task = userId
    ? db.prepare(`
        SELECT t.* FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = ? AND p.owner_id = ? AND t.deleted_at IS NULL
      `).get(id, userId) as Task | undefined
    : db.prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL').get(id) as Task | undefined;

  if (!task) return null;

  // 递归获取子任务
  const children = getChildrenRecursive(id);

  return {
    ...task,
    children,
  };
}

/**
 * 递归获取子任务
 */
function getChildrenRecursive(parentId: string): TaskWithChildren[] {
  const db = getDb();

  const children = db.prepare(
    'SELECT * FROM tasks WHERE parent_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC'
  ).all(parentId) as Task[];

  return children.map(child => {
    return {
      ...child,
      children: getChildrenRecursive(child.id),
    };
  });
}

/**
 * 创建任务
 */
export function createTask(params: CreateTaskParams, createdBy?: string): Task {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // 自动关联活跃版本（如果未指定 version_id）
  let versionId = params.version_id || null;
  let inserted = 0;

  if (!versionId) {
    // 查找活跃版本：locked_at IS NOT NULL, completed_at IS NULL, archived_at IS NULL
    const activeVersion = db.prepare(`
      SELECT id, locked_at FROM versions
      WHERE project_id = ? AND locked_at IS NOT NULL AND completed_at IS NULL AND archived_at IS NULL
      ORDER BY locked_at DESC LIMIT 1
    `).get(params.project_id) as { id: string; locked_at: string } | undefined;

    if (activeVersion) {
      versionId = activeVersion.id;
      inserted = 1; // 版本已锁定（已开始），任务标记为 inserted
    }
  } else {
    // 指定了 version_id，检查是否已锁定
    const version = versionService.getVersionByIdInternal(versionId);
    if (version && version.locked_at) {
      inserted = 1;
    }
  }

  // 验证 parent_id
  if (params.parent_id) {
    const parentTask = getTaskById(params.parent_id);
    if (!parentTask) {
      const err = new Error('父任务不存在') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    if (parentTask.project_id !== params.project_id) {
      const err = new Error('父任务不属于当前项目') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    // 检查层级深度（最多 3 级：parent → child → grandchild）
    let depth = 1; // 当前 parent 是第 1 级
    let currentParentId = params.parent_id;
    while (currentParentId) {
      const current = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(currentParentId) as { parent_id: string | null } | undefined;
      if (!current) break;
      if (current.parent_id) {
        depth++;
        currentParentId = current.parent_id;
      } else {
        break;
      }
    }
    // depth 是 parent 链的深度。如果 parent 已经是第 3 级（depth=3），新任务将是第 4 级 → 拒绝
    if (depth >= 3) {
      const err = new Error('任务层级不能超过 3 级') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
  }

  // 获取同级任务的最大 sort_order
  const maxOrder = db.prepare(
    'SELECT MAX(sort_order) as max_order FROM tasks WHERE project_id = ? AND parent_id IS ? AND version_id IS ? AND deleted_at IS NULL'
  ).get(params.project_id, params.parent_id || null, versionId) as { max_order: number | null };
  const sortOrder = (maxOrder?.max_order ?? -1) + 1;

  db.prepare(`
    INSERT INTO tasks (
      id, project_id, version_id, parent_id, title, description, notes, status,
      estimated_days, start_date, due_date, actual_start, actual_end,
      sort_order, inserted, deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.project_id,
    versionId,
    params.parent_id || null,
    params.title,
    params.description || null,
    params.notes || null,
    'planned',
    params.estimated_days ?? 1,
    params.start_date || null,
    params.due_date || null,
    null, // actual_start
    null, // actual_end
    sortOrder,
    inserted,
    null, // deleted_at
    now,
    now
  );

  // 记录历史
  addHistory(id, 'created', null, null, null, null, createdBy);

  // 版本已锁定（已开始）且有 estimated_days 时，自动排期（VAL-CORE-035）
  if (versionId && inserted === 1 && (params.estimated_days !== undefined || params.estimated_days === undefined)) {
    const estimatedDays = params.estimated_days ?? 1;
    autoScheduleTask(id, estimatedDays);
  }

  return getTaskById(id)!;
}

/**
 * 更新任务
 */
export function updateTask(id: string, params: UpdateTaskParams, updatedBy?: string): Task | null {
  const db = getDb();
  const task = getTaskById(id, updatedBy);
  if (!task) return null;

  const now = new Date().toISOString();
  const updates: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  // 记录变更
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  if (params.title !== undefined && params.title !== task.title) {
    updates.push('title = ?');
    values.push(params.title);
    changes.push({ field: 'title', oldValue: task.title, newValue: params.title });
  }

  if (params.description !== undefined && params.description !== task.description) {
    updates.push('description = ?');
    values.push(params.description);
    changes.push({ field: 'description', oldValue: task.description, newValue: params.description });
  }

  if (params.notes !== undefined && params.notes !== task.notes) {
    updates.push('notes = ?');
    values.push(params.notes);
    changes.push({ field: 'notes', oldValue: task.notes, newValue: params.notes });
  }

  if (params.status !== undefined && params.status !== task.status) {
    // 已完成任务状态不可回退（VAL-CORE-038）
    if (task.status === 'done') {
      const err = new Error('已完成任务状态不可回退') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }

    updates.push('status = ?');
    values.push(params.status);
    changes.push({ field: 'status', oldValue: task.status, newValue: params.status });

    // 记录实际开始/结束时间
    if (params.status === 'in_progress' && !task.actual_start) {
      updates.push('actual_start = ?');
      values.push(now);
      
      // 自动锁定版本并设置开始时间（当第一个任务开始时）
      if (task.version_id) {
        const version = versionService.getVersionByIdInternal(task.version_id);
        if (version) {
          // 如果版本还没有开始时间，设置为今天
          if (!version.start_date) {
            const today = now.split('T')[0]; // 只取日期部分 YYYY-MM-DD
            versionService.updateVersionInternal(task.version_id, { start_date: today });
          }
          // 如果版本还没有锁定，锁定它
          if (!version.locked_at) {
            versionService.lockVersion(task.version_id);
          }
        }
      }
    }
    if (params.status === 'done' && !task.actual_end) {
      updates.push('actual_end = ?');
      values.push(now);
    }
  }

  if (params.estimated_days !== undefined && params.estimated_days !== task.estimated_days) {
    updates.push('estimated_days = ?');
    values.push(params.estimated_days);
    changes.push({ field: 'estimated_days', oldValue: task.estimated_days, newValue: params.estimated_days });

    // 自动重新计算 due_date（VAL-CORE-035）
    if (task.start_date) {
      const dueDate = recalculateDueDate(task.start_date, params.estimated_days);
      updates.push('due_date = ?');
      values.push(dueDate);
    }
  }

  if (params.start_date !== undefined && params.start_date !== task.start_date) {
    updates.push('start_date = ?');
    values.push(params.start_date);
    changes.push({ field: 'start_date', oldValue: task.start_date, newValue: params.start_date });
  }

  if (params.due_date !== undefined && params.due_date !== task.due_date) {
    updates.push('due_date = ?');
    values.push(params.due_date);
    changes.push({ field: 'due_date', oldValue: task.due_date, newValue: params.due_date });
  }

  if (params.version_id !== undefined && params.version_id !== task.version_id) {
    updates.push('version_id = ?');
    values.push(params.version_id);
    changes.push({ field: 'version_id', oldValue: task.version_id, newValue: params.version_id });
  }

  if (updates.length === 1) {
    // 只有 updated_at，没有实际变更
    return task;
  }

  values.push(id);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // 记录历史
  for (const change of changes) {
    const action = change.field === 'status' ? 'status_changed' : 'updated';
    addHistory(
      id, 
      action, 
      change.field, 
      String(change.oldValue ?? ''), 
      String(change.newValue ?? ''),
      params.reason || null,
      updatedBy
    );
  }

  // 级联状态处理（简化版：只有 done 状态级联）
  if (params.status === 'done') {
    cascadeStatusToChildren(id, 'done', updatedBy);
  }
  
  if (params.status === 'done' && task.parent_id) {
    checkAndUpdateParentStatus(task.parent_id, updatedBy);
  }

  return getTaskById(id);
}

/**
 * 级联更新子任务状态（父带动子）
 */
function cascadeStatusToChildren(parentId: string, status: 'done', updatedBy?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  
  const children = db.prepare('SELECT id, status FROM tasks WHERE parent_id = ? AND deleted_at IS NULL').all(parentId) as Array<{ id: string; status: string }>;
  
  for (const child of children) {
    if (child.status !== status) {
      const updates = ['status = ?', 'updated_at = ?', 'actual_end = ?'];
      const values: unknown[] = [status, now, now];
      
      values.push(child.id);
      db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      
      addHistory(child.id, 'status_changed', 'status', child.status, status, '父任务状态级联', updatedBy);
    }
    
    cascadeStatusToChildren(child.id, status, updatedBy);
  }
}

/**
 * 检查并更新父任务状态（子带动父）
 */
function checkAndUpdateParentStatus(parentId: string, updatedBy?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  
  const parent = db.prepare('SELECT id, status, parent_id FROM tasks WHERE id = ? AND deleted_at IS NULL').get(parentId) as { id: string; status: string; parent_id: string | null } | undefined;
  if (!parent) return;
  
  const children = db.prepare('SELECT status FROM tasks WHERE parent_id = ? AND deleted_at IS NULL').all(parentId) as Array<{ status: string }>;
  if (children.length === 0) return;
  
  const allDone = children.every(c => c.status === 'done');
  
  if (allDone && parent.status !== 'done') {
    db.prepare('UPDATE tasks SET status = ?, updated_at = ?, actual_end = ? WHERE id = ?').run('done', now, now, parentId);
    
    addHistory(parentId, 'status_changed', 'status', parent.status, 'done', '子任务状态级联', updatedBy);
    
    if (parent.parent_id) {
      checkAndUpdateParentStatus(parent.parent_id, updatedBy);
    }
  }
}

/**
 * 删除任务（软删除，级联标记所有子任务）
 */
export function deleteTask(id: string, userId?: string): boolean {
  const db = getDb();
  const task = getTaskById(id);
  if (!task) return false;

  const now = new Date().toISOString();

  // 递归软删除所有子任务
  const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND deleted_at IS NULL').all(id) as { id: string }[];
  for (const child of children) {
    deleteTask(child.id, userId);
  }

  // 软删除当前任务
  db.prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);

  // 记录历史
  addHistory(id, 'updated', 'deleted_at', null, now, '任务已删除', userId);

  return true;
}

/**
 * 恢复删除的任务
 */
export function restoreTask(id: string, userId?: string): boolean {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
  if (!task || !task.deleted_at) return false;

  const now = new Date().toISOString();

  // 恢复当前任务
  db.prepare('UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ?').run(now, id);

  // 记录历史
  addHistory(id, 'updated', 'deleted_at', task.deleted_at, null, '任务已恢复', userId);

  return true;
}

/**
 * 重新排序任务（验证归属）
 */
export function reorderTasks(taskIds: string[], parentId: string | null = null, userId?: string): void {
  const db = getDb();
  const now = new Date().toISOString();

  // 校验所有 task 属于当前用户的项目
  if (userId) {
    for (const taskId of taskIds) {
      const task = db.prepare(`
        SELECT t.id FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = ? AND p.owner_id = ?
      `).get(taskId, userId);
      if (!task) {
        throw new Error('无权操作该任务');
      }
    }
  }

  taskIds.forEach((taskId, index) => {
    db.prepare(`
      UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?
    `).run(index, now, taskId);
  });
}

/**
 * 添加任务历史记录
 */
function addHistory(
  taskId: string,
  action: string,
  field: string | null,
  oldValue: string | null,
  newValue: string | null,
  reason: string | null,
  changedBy?: string
): void {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_history (id, task_id, action, field, old_value, new_value, reason, changed_by, changed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, taskId, action, field, oldValue, newValue, reason, changedBy || null, now);
}

/**
 * 获取任务历史
 */
export function getTaskHistory(taskId: string): TaskHistory[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM task_history WHERE task_id = ? ORDER BY changed_at DESC'
  ).all(taskId) as TaskHistory[];
}

/**
 * 添加任务备注
 */
export function addTaskNote(taskId: string, note: string, userId?: string): TaskHistory {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO task_history (id, task_id, action, field, old_value, new_value, reason, changed_by, changed_at)
    VALUES (?, ?, 'noted', NULL, NULL, NULL, ?, ?, ?)
  `).run(id, taskId, note, userId || null, now);

  return db.prepare('SELECT * FROM task_history WHERE id = ?').get(id) as TaskHistory;
}

/**
 * 激活任务
 */
export function activateTask(
  taskId: string,
  userId?: string
): TaskWithChildren | null {
  const db = getDb();
  const task = getTaskById(taskId, userId);
  if (!task || task.deleted_at) return null;

  // 已完成的任务不能激活
  if (task.status === 'done') {
    return getTaskWithChildren(taskId, userId);
  }

  const now = new Date().toISOString();
  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const values: unknown[] = ['in_progress', now];

  // 记录实际开始时间
  if (!task.actual_start) {
    updates.push('actual_start = ?');
    values.push(now);
  }

  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  // 记录状态变更历史
  addHistory(taskId, 'status_changed', 'status', task.status, 'in_progress', '任务已激活', userId);

  // 自动锁定版本并设置开始时间
  if (task.version_id) {
    const version = versionService.getVersionByIdInternal(task.version_id);
    if (version) {
      if (!version.start_date) {
        const today = now.split('T')[0];
        versionService.updateVersionInternal(task.version_id, { start_date: today });
      }
      if (!version.locked_at) {
        versionService.lockVersion(task.version_id);
      }
    }
  }

  return getTaskWithChildren(taskId);
}

/**
 * 自动排期：根据 estimated_days 计算 start_date 和 due_date
 */
function autoScheduleTask(taskId: string, estimatedDays: number): void {
  const db = getDb();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // 确定起始日期：如果今天是工作日则从今天开始，否则从下一个工作日开始
  let startDate = new Date(now);
  if (!isWorkdaySync(startDate)) {
    while (!isWorkdaySync(startDate)) {
      startDate.setDate(startDate.getDate() + 1);
    }
  }

  const startDateStr = formatDate(startDate);
  const dueDateStr = recalculateDueDate(startDateStr, estimatedDays);

  db.prepare(`
    UPDATE tasks SET start_date = ?, due_date = ? WHERE id = ?
  `).run(startDateStr, dueDateStr, taskId);
}

/**
 * 重新计算 due_date：从 start_date 开始加上 estimated_days 个工作日
 */
function recalculateDueDate(startDate: string, estimatedDays: number): string {
  const start = parseDate(startDate);
  if (estimatedDays <= 0) {
    return startDate;
  }
  const due = addWorkdaysSync(start, estimatedDays);
  return formatDate(due);
}

/**
 * 完成任务
 */
export function completeTask(taskId: string, userId?: string): TaskWithChildren | null {
  const db = getDb();
  const task = getTaskById(taskId, userId);
  if (!task || task.deleted_at) return null;

  const now = new Date().toISOString();
  
  db.prepare(`
    UPDATE tasks SET status = ?, actual_end = ?, updated_at = ? WHERE id = ?
  `).run('done', now, now, taskId);

  addHistory(taskId, 'status_changed', 'status', task.status, 'done', '任务已完成', userId);

  // 级联完成子任务
  cascadeStatusToChildren(taskId, 'done', userId);

  // 检查父任务状态
  if (task.parent_id) {
    checkAndUpdateParentStatus(task.parent_id, userId);
  }

  return getTaskWithChildren(taskId);
}
