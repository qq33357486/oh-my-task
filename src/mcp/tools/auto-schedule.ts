import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireActiveVersionForProject } from './utils/version.js';

export const autoScheduleTool: Tool = {
  name: 'auto_schedule',
  description: '自动排期待办任务',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: '排期开始日期，格式 YYYY-MM-DD',
      },
    },
    required: ['start_date'],
  },
};

interface ScheduleChange {
  task_id: string;
  title: string;
  old_start: string | null;
  new_start: string;
  old_due: string | null;
  new_due: string | null;
}

export async function handleAutoSchedule(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);
  const startDate = args.start_date as string;

  await requireActiveVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/schedule/auto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify({ project_id: project.id, start_date: startDate }),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to auto schedule');
  }

  const result = await response.json() as { data: { changes: ScheduleChange[] } };
  const changes = result.data.changes;

  if (changes.length === 0) {
    return {
      content: [{ type: 'text', text: '没有需要排期的任务。' }],
    };
  }

  const lines = [`排期完成，共 ${changes.length} 个任务：\n`];
  for (const change of changes) {
    lines.push(`• ${change.title}: ${change.new_start}${change.new_due ? ` ~ ${change.new_due}` : ''}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
