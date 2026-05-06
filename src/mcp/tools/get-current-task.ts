import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getWorkingVersionForProject } from './utils/version.js';
import { formatAiPrompt } from './utils/ai-prompt.js';
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
    throw new Error(formatAiPrompt({
      status: `项目「${project.name}」还没有任何版本。`,
      relay: '请用自然语气告诉用户当前项目还没有版本，并询问这次版本叫什么名称。',
      next: '拿到版本名称后，调用 create_version 创建草稿版本，然后继续引导用户规划任务。',
      collect: ['版本名称'],
      tool: 'create_version',
    }));
  }

  const params = new URLSearchParams();
  params.append('project_id', project.id);
  params.append('version_id', activeVersion.id);

  if (!activeVersion.locked_at || activeVersion.completed_at || activeVersion.archived_at) {
    const allTasks = await fetchTasks(context, params);
    if (allTasks.length === 0) {
      throw new Error(formatAiPrompt({
        status: `项目「${project.name}」的版本「${activeVersion.name}」还没有任务。`,
        relay: '请告诉用户版本已存在，但还没有规划任务。',
        next: '请用户描述这个版本要完成的事项，你负责拆成任务并创建。',
        collect: ['任务列表', '每项预估天数'],
        tool: 'create_task',
      }));
    }
    throw new Error(formatAiPrompt({
      status: `项目「${project.name}」已有版本「${activeVersion.name}」，但版本尚未开始。`,
      relay: '请告诉用户版本还没开始，当前不能查询进行中的任务。',
      next: '如果任务已经规划并排期，请询问用户是否开始版本；如果尚未排期，请先收集计划开始日期。',
      collect: ['是否开始版本', '必要时收集计划开始日期'],
      tool: ['auto_schedule', 'start_version'],
    }));
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
          text: formatAiPrompt({
            status: `项目「${project.name}」的版本「${activeVersion.name}」还没有任务。`,
            relay: '请告诉用户版本已开始，但还没有任务，这通常需要先补齐规划。',
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
        text: formatAiPrompt({
          status: `项目「${project.name}」当前版本暂无进行中的主任务。`,
          relay: '请告诉用户目前没有正在执行的任务。',
          next: '主动询问是否要列出可开始任务，或让用户直接指定要开始的任务。',
          collect: ['要开始的任务，或是否先查看任务列表'],
          tool: ['list_tasks', 'activate_task'],
        }),
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
