import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';

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
  const config = getProjectConfigOrThrow(process.cwd());
  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }
  await requireActiveVersionForProject(config.project_id, context);

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
