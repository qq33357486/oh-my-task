import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import type { Task, Version } from '../../types/index.js';

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
        text: `版本已经开始。\n版本: ${version.name}\nID: ${version.id}`,
      }],
    };
  }

  const tasksResponse = await fetch(`${context.serverUrl}/api/tasks?project_id=${project.id}&version_id=${version.id}`, {
    headers: { 'Authorization': `Bearer ${context.token}` },
  });
  if (!tasksResponse.ok) {
    const error = await tasksResponse.json() as { error?: string };
    throw new Error(error.error || 'Failed to list tasks');
  }

  const tasksResult = await tasksResponse.json() as { data: Task[] };
  if (tasksResult.data.length === 0) {
    throw new Error(`版本「${version.name}」还没有任务。\n请先使用 create_task 规划这个版本的任务。`);
  }

  if (!version.due_date) {
    throw new Error(`版本「${version.name}」还没有 Deadline。\n请先使用 auto_schedule 排期并自动计算 Deadline 后，再开始版本。`);
  }

  const response = await fetch(`${context.serverUrl}/api/versions/${version.id}/start`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${context.token}` },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to start version');
  }

  const result = await response.json() as { data: Version };
  const startedVersion = result.data;

  return {
    content: [{
      type: 'text',
      text: `版本已开始。\n版本: ${startedVersion.name}\nID: ${startedVersion.id}\nDeadline: ${startedVersion.due_date || '未设置'}\n现在可以使用 get_current_task、activate_task、complete_task 管理当前任务。`,
    }],
  };
}
