import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';
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
      path: {
        type: 'string',
        description: '项目路径，默认当前目录',
      },
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
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfigOrThrow(projectPath);

  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }

  const activeVersion = await requireActiveVersionForProject(config.project_id, context);

  const params = new URLSearchParams();
  params.append('project_id', config.project_id);
  params.append('version_id', activeVersion.id);
  params.append('status', 'in_progress');
  params.append('parent_id', 'null');

  const tasks = await fetchTasks(context, params);

  if (!tasks || tasks.length === 0) {
    return {
      content: [{
        type: 'text',
        text: '无进行中主任务。可使用 list_tasks view=outline 查看任务结构。',
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
