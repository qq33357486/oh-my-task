import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { requireStartedVersionForProject } from './utils/version.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

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
  const project = await resolveMcpProject(context);
  const version = await requireStartedVersionForProject(project.id, context, project.name);

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
    throw new Error(error.error || formatOperationFailed('开始任务'));
  }

  const result = await response.json() as { data: Task };
  const task = result.data;

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `版本「${version.name}」中的任务「${task.title}」已开始。`,
        relay: '请告诉用户任务已进入执行中。',
        next: '引导用户继续处理任务；完成后可以调用 complete_task。',
        tool: ['get_current_task', 'complete_task'],
        data: `ID: ${task.id}\n标题: ${task.title}\n状态: ${task.status}`,
      }),
    }],
  };
}
