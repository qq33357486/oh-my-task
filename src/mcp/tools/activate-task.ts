import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';

export const activateTaskTool: Tool = {
  name: 'activate_task',
  description: '开始任务',
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
  const config = getProjectConfigOrThrow(process.cwd());
  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }
  await requireActiveVersionForProject(config.project_id, context);

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
      text: `任务已激活。\nID: ${task.id}\n标题: ${task.title}\n状态: ${task.status}`,
    }],
  };
}
