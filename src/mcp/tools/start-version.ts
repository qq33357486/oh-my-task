import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import type { Task, Version } from '../../types/index.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

export const startVersionTool: Tool = {
  name: 'start_version',
  description: '开始当前版本',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleStartVersion(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);
  const version = await requireWorkingVersionForProject(project.id, context, project.name);

  if (version.locked_at && !version.completed_at && !version.archived_at) {
    return {
      content: [{
        type: 'text',
        text: formatAiPrompt({
          status: `版本「${version.name}」已经处于开始状态。`,
          relay: '请告诉用户版本已经在执行中，不需要重复开始。',
          next: '如果当前没有进行中任务，请引导用户选择要开始的任务。',
          tool: ['get_current_task', 'list_tasks', 'activate_task'],
          data: `版本: ${version.name}\nID: ${version.id}`,
        }),
      }],
    };
  }

  const tasksResponse = await fetch(`${context.serverUrl}/api/tasks?project_id=${project.id}&version_id=${version.id}`, {
    headers: { 'Authorization': `Bearer ${context.token}` },
  });
  if (!tasksResponse.ok) {
    const error = await tasksResponse.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('获取任务列表'));
  }

  const tasksResult = await tasksResponse.json() as { data: Task[] };
  if (tasksResult.data.length === 0) {
    throw new Error(formatAiPrompt({
      status: `版本「${version.name}」没有任务，不能开始。`,
      relay: '请告诉用户还不能开始版本，因为版本里没有任务。',
      next: '询问用户要规划哪些任务，并尽量收集每项任务的预估天数。',
      collect: ['任务列表', '每项预估天数'],
      tool: 'create_task',
    }));
  }

  if (!version.due_date) {
    throw new Error(formatAiPrompt({
      status: `版本「${version.name}」还没有截止日期，不能开始。`,
      relay: '请告诉用户需要先排期来计算截止日期。',
      next: '询问用户计划从哪天开始，然后调用 auto_schedule 自动排期。',
      collect: ['计划开始日期 start_date'],
      tool: 'auto_schedule',
    }));
  }

  const response = await fetch(`${context.serverUrl}/api/versions/${version.id}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${context.token}` },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('开始版本'));
  }

  const result = await response.json() as { data: Version };
  const startedVersion = result.data;

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `版本「${startedVersion.name}」已开始。`,
        relay: '请告诉用户版本已进入执行阶段。',
        next: '如果还没有当前任务，先列出可开始任务让用户选择；如果用户已指定任务，则开始该任务。',
        collect: ['要开始的任务，或是否先查看任务列表'],
        tool: ['list_tasks', 'activate_task'],
        data: `版本: ${startedVersion.name}\nID: ${startedVersion.id}\nDeadline: ${startedVersion.due_date || '未设置'}`,
      }),
    }],
  };
}
