import type { McpContext } from './config.js';
import type { Task, TaskWithChildren } from '../../../types/index.js';
import { formatAiPrompt, formatOperationFailed } from './ai-prompt.js';

export type TaskDetail = 'compact' | 'summary' | 'full';

export interface CurrentTaskOptions {
  includeDoneChildren: boolean;
  maxChildren: number;
  detail: TaskDetail;
}

export function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return defaultValue;
}

export function parsePositiveInteger(value: unknown, defaultValue: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export async function fetchTasks(
  context: McpContext,
  params: URLSearchParams
): Promise<Task[]> {
  const response = await fetch(`${context.serverUrl}/api/tasks?${params}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('获取任务列表'));
  }

  const result = await response.json() as { data: Task[] };
  return result.data;
}

export async function fetchTaskDetail(
  context: McpContext,
  taskId: string
): Promise<TaskWithChildren> {
  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('获取任务详情'));
  }

  const result = await response.json() as { data: TaskWithChildren };
  return result.data;
}

export function formatCurrentTaskSummary(task: TaskWithChildren, options: CurrentTaskOptions): string {
  const children = task.children || [];
  const doneCount = children.filter((child) => child.status === 'done').length;
  const inProgressCount = children.filter((child) => child.status === 'in_progress').length;
  const plannedCount = children.filter((child) => child.status === 'planned').length;
  const progress = children.length > 0
    ? Math.round((doneCount / children.length) * 100)
    : (task.status === 'done' ? 100 : 0);

  const lines = [
    `当前主任务: ${task.title}`,
    `ID: ${task.id}`,
    `状态: ${task.status}`,
    `进度: ${progress}%`,
  ];

  if (task.due_date) {
    lines.push(`截止: ${task.due_date}`);
  }

  if (options.detail === 'full') {
    if (task.description) lines.push(`描述: ${task.description}`);
    if (task.notes) lines.push(`备注: ${task.notes}`);
    if (task.start_date) lines.push(`开始: ${task.start_date}`);
    if (task.estimated_days) lines.push(`预估: ${task.estimated_days} 天`);
  }

  lines.push('');
  lines.push(`子任务进度: 总数: ${children.length} | 完成: ${doneCount} | 进行中: ${inProgressCount} | 待办: ${plannedCount}`);

  const visibleChildren = children
    .filter((child) => options.includeDoneChildren || child.status !== 'done')
    .slice(0, options.maxChildren);

  if (visibleChildren.length > 0) {
    lines.push(`子任务列表 (${visibleChildren.length}/${children.length}):`);
    for (const child of visibleChildren) {
      let line = `- ${child.title} (${child.status}) ID: ${child.id}`;
      if (options.detail === 'full' && child.description) {
        line += ` | 描述: ${child.description}`;
      }
      lines.push(line);
    }
  } else {
    lines.push('子任务列表: 无未完成/进行中子任务');
  }

  if (!options.includeDoneChildren && doneCount > 0) {
    lines.push(`已隐藏 done 子项 ${doneCount} 个，可传 include_done_children=true 查看。`);
  }

  return formatAiPrompt({
    status: `当前进行中的主任务是「${task.title}」。`,
    relay: '请用摘要形式告诉用户当前任务、子任务进度和可继续处理的事项。',
    next: '根据用户意图继续查看任务详情、处理子任务或完成当前任务。',
    tool: ['get_task', 'complete_task'],
    data: lines.join('\n'),
  });
}

export function buildTaskTree(tasks: Task[]): TaskWithChildren[] {
  const taskMap = new Map<string, TaskWithChildren>();
  for (const task of tasks) {
    taskMap.set(task.id, { ...task, children: [] });
  }

  const roots: TaskWithChildren[] = [];
  for (const task of taskMap.values()) {
    if (task.parent_id && taskMap.has(task.parent_id)) {
      taskMap.get(task.parent_id)!.children.push(task);
    } else {
      roots.push(task);
    }
  }

  return roots;
}

export function formatTaskFull(task: Task, prefix: string): string {
  return `${prefix}${task.title}
${prefix}ID: ${task.id}
${prefix}状态: ${task.status}
${prefix}父任务: ${task.parent_id || '无'}
${prefix}描述: ${task.description || ''}
${prefix}备注: ${task.notes || ''}
${prefix}开始: ${task.start_date || ''}
${prefix}截止: ${task.due_date || ''}
${prefix}预估: ${task.estimated_days} 天
${prefix}实际开始: ${task.actual_start || ''}
${prefix}实际结束: ${task.actual_end || ''}
${prefix}插队: ${task.inserted ? '是' : '否'}`;
}
