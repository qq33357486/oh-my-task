import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { TaskWithChildren } from '../../types/index.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';
import { fetchTaskDetail, formatTaskFull, parseBoolean, parsePositiveInteger } from './utils/task-query.js';

export const getTaskTool: Tool = {
  name: 'get_task',
  description: '获取任务及子任务',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '任务ID',
      },
      detail: {
        type: 'string',
        enum: ['summary', 'full'],
        description: '详情级别，默认 summary',
      },
      depth: {
        type: 'number',
        description: '返回子任务深度，默认 3',
      },
      include_children: {
        type: 'boolean',
        description: '是否包含子任务，默认 true',
      },
      path: {
        type: 'string',
        description: '项目路径，默认当前目录',
      },
    },
    required: ['task_id'],
  },
};

function formatTaskTree(
  task: TaskWithChildren,
  detail: 'summary' | 'full',
  includeChildren: boolean,
  maxDepth: number,
  indent: number = 0
): string {
  const prefix = '  '.repeat(indent);
  const statusEmoji: Record<string, string> = {
    planned: '📋',
    in_progress: '🔄',
    done: '✅',
  };

  const emoji = statusEmoji[task.status] || '📌';

  let output = `${prefix}${emoji} ${task.title}
${prefix}   ID: ${task.id}
${prefix}   状态: ${task.status}`;

  if (task.due_date) {
    output += `\n${prefix}   截止: ${task.due_date}`;
  }

  if (detail === 'full') {
    output += `\n${formatTaskFull(task, `${prefix}   `)}`;
  }

  if (includeChildren && indent < maxDepth && task.children && task.children.length > 0) {
    output += `\n${prefix}   子任务 (${task.children.length}):\n`;
    for (const child of task.children) {
      output += formatTaskTree(child, detail, includeChildren, maxDepth, indent + 2) + '\n';
    }
  }

  return output;
}

export async function handleGetTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = args.task_id as string;
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfigOrThrow(projectPath);
  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }
  await requireActiveVersionForProject(config.project_id, context);

  const task = await fetchTaskDetail(context, taskId);
  const detail = args.detail === 'full' ? 'full' : 'summary';

  return {
    content: [{
      type: 'text',
      text: formatTaskTree(
        task,
        detail,
        parseBoolean(args.include_children, true),
        parsePositiveInteger(args.depth, 3)
      ),
    }],
  };
}
