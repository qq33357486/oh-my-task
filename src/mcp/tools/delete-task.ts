import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireWorkingVersionForProject } from './utils/version.js';

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
  await requireWorkingVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to delete task');
  }

  return {
    content: [{
      type: 'text',
      text: `任务已删除。ID: ${taskId}`,
    }],
  };
}
