import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getWorkingVersionForProject } from './utils/version.js';
import {
  fetchTaskDetail,
  fetchTasks,
  formatCurrentTaskSummary,
  parseBoolean,
  parsePositiveInteger,
  type TaskDetail,
} from './utils/task-query.js';

export const getCurrentTaskTool: Tool = {
  name: 'get_current_task',
  description: '获取当前进行中的主任务',
  inputSchema: {
    type: 'object',
    properties: {
      include_done_children: {
        type: 'boolean',
        description: '是否显示已完成子任务，默认 false',
      },
      max_children: {
        type: 'number',
        description: '最多显示的子任务数量，默认 20',
      },
      detail: {
        type: 'string',
        enum: ['compact', 'summary', 'full'],
        description: '详情级别，默认 summary',
      },
    },
  },
};

export async function handleGetCurrentTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);
  const activeVersion = await getWorkingVersionForProject(project.id, context);

  if (!activeVersion) {
    throw new Error(`项目「${project.name}」还没有版本。\n请先使用 create_version 创建一个版本，然后规划任务。`);
  }

  const params = new URLSearchParams();
  params.append('project_id', project.id);
  params.append('version_id', activeVersion.id);

  if (!activeVersion.locked_at || activeVersion.completed_at || activeVersion.archived_at) {
    const allTasks = await fetchTasks(context, params);
    if (allTasks.length === 0) {
      throw new Error(`项目「${project.name}」的版本「${activeVersion.name}」还没有任务。\n请先使用 create_task 规划这个版本的任务，并设置 estimated_days。`);
    }
    throw new Error(`项目「${project.name}」已有版本「${activeVersion.name}」，但尚未开始。\n请先规划任务并排期；准备执行时使用 start_version 开始版本。`);
  }

  params.append('status', 'in_progress');
  params.append('parent_id', 'null');

  const tasks = await fetchTasks(context, params);

  if (!tasks || tasks.length === 0) {
    const allTaskParams = new URLSearchParams();
    allTaskParams.append('project_id', project.id);
    allTaskParams.append('version_id', activeVersion.id);
    const allTasks = await fetchTasks(context, allTaskParams);
    if (allTasks.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `项目「${project.name}」的版本「${activeVersion.name}」还没有任务。\n请先使用 create_task 规划这个版本的任务，并设置 estimated_days。`,
        }],
      };
    }
    return {
      content: [{
        type: 'text',
        text: `项目「${project.name}」当前版本暂无进行中主任务。\n可以使用 list_tasks 查看任务结构，或使用 activate_task 开始一个任务。`,
      }],
    };
  }

  const mainTask = tasks[0] as Task;
  const detail = await fetchTaskDetail(context, mainTask.id);
  const detailLevel = (args.detail as TaskDetail) || 'summary';

  return {
    content: [{
      type: 'text',
      text: formatCurrentTaskSummary(detail, {
        includeDoneChildren: parseBoolean(args.include_done_children, false),
        maxChildren: parsePositiveInteger(args.max_children, 20),
        detail: detailLevel,
      }),
    }],
  };
}
