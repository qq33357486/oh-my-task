import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { requireStartedVersionForProject } from './utils/version.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

export const completeTaskTool: Tool = {
  name: 'complete_task',
  description: '完成任务',
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
  const project = await resolveMcpProject(context);
  const version = await requireStartedVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('完成任务'));
  }

  const result = await response.json() as { data: Task };
  const task = result.data;

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `版本「${version.name}」中的任务「${task.title}」已完成。`,
        relay: '请确认任务完成，并根据版本内剩余任务决定下一步。',
        next: '如果还有未完成任务，引导用户选择下一个任务；如果全部完成，引导确认是否完成版本。',
        tool: ['list_tasks', 'complete_version'],
        data: `ID: ${task.id}\n标题: ${task.title}\n状态: ${task.status}`,
      }),
    }],
  };
}
