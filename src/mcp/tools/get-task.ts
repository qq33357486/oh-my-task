import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { TaskWithChildren } from '../../types/index.js';

export const getTaskTool: Tool = {
  name: 'get_task',
  description: '获取任务详情，包含子任务树',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: '任务ID',
      },
    },
    required: ['task_id'],
  },
};

function formatTaskTree(task: TaskWithChildren, indent: number = 0): string {
  const prefix = '  '.repeat(indent);
  const statusEmoji: Record<string, string> = {
    planned: '📋',
    in_progress: '🔄',
    done: '✅',
  };

  const emoji = statusEmoji[task.status] || '📌';

  let output = `${prefix}${emoji} ${task.title}
${prefix}   ID: ${task.id}
${prefix}   状态: ${task.status}
${prefix}   ${task.description ? `描述: ${task.description}` : ''}
${prefix}   ${task.start_date ? `开始: ${task.start_date}` : ''} ${task.due_date ? `截止: ${task.due_date}` : ''}
${prefix}   ${task.estimated_days ? `预估: ${task.estimated_days} 天` : ''}`;

  if (task.children && task.children.length > 0) {
    output += `\n${prefix}   子任务 (${task.children.length}):\n`;
    for (const child of task.children) {
      output += formatTaskTree(child, indent + 2) + '\n';
    }
  }

  return output;
}

export async function handleGetTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = args.task_id as string;

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to get task');
  }

  const result = await response.json() as { data: TaskWithChildren };

  return {
    content: [{
      type: 'text',
      text: formatTaskTree(result.data),
    }],
  };
}
