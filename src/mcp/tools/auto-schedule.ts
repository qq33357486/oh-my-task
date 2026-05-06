import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

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

  const workingVersion = await requireWorkingVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/schedule/auto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify({ project_id: project.id, version_id: workingVersion.id, start_date: startDate }),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('自动排期'));
  }

  const result = await response.json() as { data: { changes: ScheduleChange[]; version?: { start_date: string; due_date: string } } };
  const changes = result.data.changes;

  if (changes.length === 0) {
    return {
      content: [{ type: 'text', text: formatAiPrompt({
        status: `版本「${workingVersion.name}」目前没有可排期任务。`,
        relay: '请告诉用户当前没有可排期任务，无法生成排期。',
        next: '请用户补充要新增的任务和预估天数，你先创建任务再排期。',
        collect: ['任务列表', '每项预估天数'],
        tool: 'create_task',
      }) }],
    };
  }

  const lines = [
    `排期完成。`,
    `版本: ${workingVersion.name}`,
    result.data.version ? `开始: ${result.data.version.start_date}` : '',
    result.data.version ? `预计截止: ${result.data.version.due_date}` : '',
    `已排期任务: ${changes.length} 个`,
    '',
  ].filter(Boolean);
  for (const change of changes) {
    lines.push(`• ${change.title}: ${change.new_start}${change.new_due ? ` ~ ${change.new_due}` : ''}`);
  }
  const dueDate = result.data.version?.due_date || changes[changes.length - 1]?.new_due || '';

  return {
    content: [{ type: 'text', text: formatAiPrompt({
      status: `版本「${workingVersion.name}」已完成排期${result.data.version ? `，开始日期为 ${result.data.version.start_date}，预计截止日期为 ${result.data.version.due_date}` : ''}。`,
      relay: '请向用户总结排期结果，并询问是否现在开始执行这个版本。',
      next: '如果用户确认开始，则调用 start_version；如果还要调整任务，则继续创建任务或重新排期。',
      collect: ['是否开始版本'],
      tool: ['start_version', 'create_task', 'auto_schedule'],
      data: `${lines.join('\n')}${dueDate ? `\n预计截止: ${dueDate}` : ''}`,
    }) }],
  };
}
