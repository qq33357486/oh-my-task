import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import { formatAiPrompt } from './utils/ai-prompt.js';
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
    return formatAiPrompt({
      status: '没有找到符合条件的任务。',
      relay: '请告诉用户当前筛选条件下没有任务。',
      next: '可以询问用户是否要调整筛选条件，或新增任务。',
      tool: 'create_task',
    });
  }

  const visibleTasks = tasks.slice(0, limit);
  const lines = visibleTasks.map((task, index) => {
    const typeLabel = task.parent_id ? '[子任务]' : '';
    return `${index + 1}. ${typeLabel} ${task.title}\n   ID: ${task.id} | 状态: ${task.status} | 父任务: ${task.parent_id || '无'}`;
  });

  const suffix = tasks.length > visibleTasks.length ? `\n\n已省略 ${tasks.length - visibleTasks.length} 个任务，可提高 limit 查看。` : '';
  return formatAiPrompt({
    status: `已获取 ${tasks.length} 个任务。`,
    relay: '请把任务列表按用户容易理解的方式转述，并根据用户意图引导选择要开始、查看或调整的任务。',
    next: '如果用户要开始执行某个任务，调用 activate_task；如果要看详情，调用 get_task。',
    tool: ['activate_task', 'get_task'],
    data: `共 ${tasks.length} 个任务（精简列表）：\n\n${lines.join('\n\n')}${suffix}`,
  });
}

function formatOutline(tasks: Task[], depth: number, limit: number): string {
  const roots = buildTaskTree(tasks);
  if (roots.length === 0) {
    return formatAiPrompt({
      status: '没有找到可展示的任务结构。',
      relay: '请告诉用户当前没有可展示的任务结构。',
      next: '可以询问用户是否要新增任务，或调整筛选条件。',
      tool: 'create_task',
    });
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

  return formatAiPrompt({
    status: `已获取 ${tasks.length} 个任务的结构摘要。`,
    relay: '请向用户总结任务结构，并询问下一步要开始哪个任务或是否继续补充任务。',
    next: '如果用户选择任务执行，调用 activate_task；如果继续规划，调用 create_task。',
    tool: ['activate_task', 'create_task'],
    data: lines.join('\n'),
  });
}

function formatFullList(tasks: Task[], limit: number): string {
  if (tasks.length === 0) {
    return formatAiPrompt({
      status: '没有找到符合条件的任务。',
      relay: '请告诉用户当前筛选条件下没有任务。',
      next: '可以询问用户是否要调整筛选条件，或新增任务。',
      tool: 'create_task',
    });
  }

  const data = tasks
    .slice(0, limit)
    .map((task, index) => `${index + 1}. ${formatTaskFull(task, '   ')}`)
    .join('\n\n');
  return formatAiPrompt({
    status: `已获取 ${Math.min(tasks.length, limit)} 个任务详情。`,
    relay: '请按用户关注点转述任务详情，不要一次性展开无关字段。',
    next: '根据用户意图继续查看、开始、完成或调整任务。',
    tool: ['get_task', 'activate_task', 'complete_task'],
    data,
  });
}

export async function handleListTasks(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);
  const workingVersion = await requireWorkingVersionForProject(project.id, context, project.name);
  const view = (args.view as ListTasksView) || 'current';
  const detail = (args.detail as TaskDetail) || 'compact';
  const limit = parsePositiveInteger(args.limit, 50);
  const depth = parsePositiveInteger(args.depth, 3);

  const params = new URLSearchParams();
  params.append('project_id', project.id);
  params.append('version_id', workingVersion.id);

  if (view === 'current') {
    params.append('status', 'in_progress');
    params.append('parent_id', 'null');
    const currentTasks = await fetchTasks(context, params);

    if (currentTasks.length === 0) {
      const allTaskParams = new URLSearchParams();
      allTaskParams.append('project_id', project.id);
      allTaskParams.append('version_id', workingVersion.id);
      const allTasks = await fetchTasks(context, allTaskParams);
      if (allTasks.length === 0) {
        return {
          content: [{
            type: 'text',
            text: formatAiPrompt({
              status: `项目「${project.name}」的版本「${workingVersion.name}」还没有任务。`,
              relay: '请告诉用户版本已存在，但还没有规划任务。',
              next: '请用户描述这个版本要完成的事项，你负责拆成任务并创建。',
              collect: ['任务列表', '每项预估天数'],
              tool: 'create_task',
            }),
          }],
        };
      }
      return {
        content: [{
          type: 'text',
          text: workingVersion.locked_at
            ? formatAiPrompt({
                status: `项目「${project.name}」当前版本暂无进行中的主任务。`,
                relay: '请告诉用户目前没有正在执行的任务。',
                next: '主动询问是否要列出可开始任务，或让用户直接指定要开始的任务。',
                collect: ['要开始的任务，或是否先查看任务列表'],
                tool: ['list_tasks', 'activate_task'],
              })
            : formatAiPrompt({
                status: `项目「${project.name}」的版本「${workingVersion.name}」还没有开始。`,
                relay: '请告诉用户版本还没开始，当前没有正在执行的任务。',
                next: '如果任务已经规划并排期，请询问用户是否开始版本；如果尚未排期，请先收集计划开始日期。',
                collect: ['是否开始版本', '必要时收集计划开始日期'],
                tool: ['auto_schedule', 'start_version'],
              }),
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

  if (tasks.length === 0) {
    return {
      content: [{
        type: 'text',
        text: formatAiPrompt({
          status: `项目「${project.name}」的版本「${workingVersion.name}」还没有任务。`,
          relay: '请告诉用户版本已存在，但还没有规划任务。',
          next: '请用户描述这个版本要完成的事项，你负责拆成任务并创建。',
          collect: ['任务列表', '每项预估天数'],
          tool: 'create_task',
        }),
      }],
    };
  }

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
