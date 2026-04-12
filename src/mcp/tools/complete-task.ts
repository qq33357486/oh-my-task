import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';

export const completeTaskTool: Tool = {
  name: 'complete_task',
  description: '完成任务（状态变为 done）。如果所有子任务完成，父任务自动完成。',
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

export async function handleCompleteTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = args.task_id as string;

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to complete task');
  }

  const result = await response.json() as { data: Task };
  const task = result.data;

  return {
    content: [{
      type: 'text',
      text: `任务已完成！✅
ID: ${task.id}
标题: ${task.title}
状态: ${task.status}`,
    }],
  };
}
