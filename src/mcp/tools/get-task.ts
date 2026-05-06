import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { TaskWithChildren } from '../../types/index.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import { fetchTaskDetail, formatTaskFull, parseBoolean, parsePositiveInteger } from './utils/task-query.js';
import { formatAiPrompt } from './utils/ai-prompt.js';

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
  const project = await resolveMcpProject(context);
  const version = await requireWorkingVersionForProject(project.id, context, project.name);

  const task = await fetchTaskDetail(context, taskId);
  const detail = args.detail === 'full' ? 'full' : 'summary';

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `已获取版本「${version.name}」中的任务「${task.title}」。`,
        relay: '请根据用户问题转述任务信息，重点说明状态、截止时间和子任务进度。',
        next: '根据用户意图继续开始、完成、删除或查看子任务。',
        tool: ['activate_task', 'complete_task', 'delete_task'],
        data: formatTaskTree(
          task,
          detail,
          parseBoolean(args.include_children, true),
          parsePositiveInteger(args.depth, 3)
        ),
      }),
    }],
  };
}
