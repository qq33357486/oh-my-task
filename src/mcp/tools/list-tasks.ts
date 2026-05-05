import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';
import {
  buildTaskTree,
  fetchTaskDetail,
  fetchTasks,
  formatCurrentTaskSummary,
  formatTaskFull,
  parseBoolean,
  parsePositiveInteger,
  type TaskDetail,
} from './utils/task-query.js';

type ListTasksView = 'current' | 'outline' | 'list' | 'full';

export const listTasksTool: Tool = {
  name: 'list_tasks',
  description: '列出任务',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['planned', 'in_progress', 'done'],
        description: '任务状态',
      },
      parent_id: {
        type: 'string',
        description: '父任务ID',
      },
      path: {
        type: 'string',
        description: '项目路径，默认当前目录',
      },
      view: {
        type: 'string',
        enum: ['current', 'outline', 'list', 'full'],
        description: '查询视图，默认 current',
      },
      detail: {
        type: 'string',
        enum: ['compact', 'summary', 'full'],
        description: '详情级别，默认 compact',
      },
      root_only: {
        type: 'boolean',
        description: '仅返回主任务',
      },
      include_done: {
        type: 'boolean',
        description: '是否包含已完成任务，默认 true',
      },
      limit: {
        type: 'number',
        description: '最多返回任务数，默认 50',
      },
      depth: {
        type: 'number',
        description: '树形视图深度，默认 3',
      },
    },
  },
};

function formatCompactTaskList(tasks: Task[], limit: number): string {
  if (tasks.length === 0) {
    return '没有找到任务。';
  }

  const visibleTasks = tasks.slice(0, limit);
  const lines = visibleTasks.map((task, index) => {
    const typeLabel = task.parent_id ? '[子任务]' : '';
    return `${index + 1}. ${typeLabel} ${task.title}\n   ID: ${task.id} | 状态: ${task.status} | 父任务: ${task.parent_id || '无'}`;
  });

  const suffix = tasks.length > visibleTasks.length ? `\n\n已省略 ${tasks.length - visibleTasks.length} 个任务，可提高 limit 查看。` : '';
  return `共 ${tasks.length} 个任务（精简列表）：\n\n${lines.join('\n\n')}${suffix}`;
}

function formatOutline(tasks: Task[], depth: number, limit: number): string {
  const roots = buildTaskTree(tasks);
  if (roots.length === 0) {
    return '没有找到任务。';
  }

  let count = 0;
  const lines: string[] = ['任务结构摘要:'];

  function visit(task: Task & { children?: Array<Task & { children?: Task[] }> }, level: number): void {
    if (count >= limit || level > depth) return;
    const prefix = '  '.repeat(level);
    lines.push(`${prefix}- ${task.title} (${task.status}) ID: ${task.id}`);
    count += 1;
    for (const child of task.children || []) {
      visit(child, level + 1);
    }
  }

  for (const root of roots) {
    visit(root, 0);
  }

  if (tasks.length > count) {
    lines.push(`已省略 ${tasks.length - count} 个任务，可提高 limit/depth 查看。`);
  }

  return lines.join('\n');
}

function formatFullList(tasks: Task[], limit: number): string {
  if (tasks.length === 0) {
    return '没有找到任务。';
  }

  return tasks
    .slice(0, limit)
    .map((task, index) => `${index + 1}. ${formatTaskFull(task, '   ')}`)
    .join('\n\n');
}

export async function handleListTasks(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfigOrThrow(projectPath);

  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }

  const activeVersion = await requireActiveVersionForProject(config.project_id, context);
  const view = (args.view as ListTasksView) || 'current';
  const detail = (args.detail as TaskDetail) || 'compact';
  const limit = parsePositiveInteger(args.limit, 50);
  const depth = parsePositiveInteger(args.depth, 3);

  const params = new URLSearchParams();
  params.append('project_id', config.project_id);
  params.append('version_id', activeVersion.id);

  if (view === 'current') {
    params.append('status', 'in_progress');
    params.append('parent_id', 'null');
    const currentTasks = await fetchTasks(context, params);

    if (currentTasks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '无进行中主任务。可使用 list_tasks view=outline 查看任务结构。',
        }],
      };
    }

    const currentTask = await fetchTaskDetail(context, currentTasks[0].id);
    return {
      content: [{
        type: 'text',
        text: formatCurrentTaskSummary(currentTask, {
          includeDoneChildren: false,
          maxChildren: limit,
          detail: detail === 'full' ? 'full' : 'summary',
        }),
      }],
    };
  }

  if (args.status) params.append('status', args.status as string);
  if (args.parent_id !== undefined) params.append('parent_id', args.parent_id as string);

  let tasks = await fetchTasks(context, params);

  if (!parseBoolean(args.include_done, true)) {
    tasks = tasks.filter((task) => task.status !== 'done');
  }

  if (parseBoolean(args.root_only, false)) {
    tasks = tasks.filter((task) => task.parent_id === null);
  }

  const text = view === 'outline'
    ? formatOutline(tasks, depth, limit)
    : (view === 'full' && detail === 'full'
        ? formatFullList(tasks, limit)
        : formatCompactTaskList(tasks, limit));

  return {
    content: [{
      type: 'text',
      text,
    }],
  };
}
