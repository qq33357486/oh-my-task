import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

export const deleteTaskTool: Tool = {
  name: 'delete_task',
  description: '软删除任务及子任务',
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

export async function handleDeleteTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const taskId = args.task_id as string;
  const project = await resolveMcpProject(context);
  const version = await requireWorkingVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('删除任务'));
  }

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `版本「${version.name}」中的任务已删除。`,
        relay: '请确认任务删除结果。',
        next: '如果删除影响排期，提醒用户可以重新排期；如果继续执行，列出剩余任务。',
        tool: ['auto_schedule', 'list_tasks'],
        data: `任务ID: ${taskId}`,
      }),
    }],
  };
}
