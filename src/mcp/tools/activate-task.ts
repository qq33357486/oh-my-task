import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';

export const activateTaskTool: Tool = {
  name: 'activate_task',
  description: '激活任务（状态变为 in_progress）。',
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

export async function handleActivateTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = args.task_id as string;

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to activate task');
  }

  const result = await response.json() as { data: Task };
  const task = result.data;

  return {
    content: [{
      type: 'text',
      text: `任务已激活！🔄
ID: ${task.id}
标题: ${task.title}
状态: ${task.status}`,
    }],
  };
}
