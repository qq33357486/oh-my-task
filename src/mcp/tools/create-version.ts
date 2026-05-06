import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

interface Version {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
}

export const createVersionTool: Tool = {
  name: 'create_version',
  description: '创建草稿版本',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '版本名称',
      },
      description: {
        type: 'string',
        description: '版本描述',
      },
      start_date: {
        type: 'string',
        description: '计划开始日期，格式 YYYY-MM-DD',
      },
      due_date: {
        type: 'string',
        description: 'Deadline，格式 YYYY-MM-DD；可稍后通过 auto_schedule 自动计算',
      },
    },
    required: ['name'],
  },
};

export async function handleCreateVersion(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);

  const body = {
    project_id: project.id,
    name: args.name,
    description: args.description,
    start_date: args.start_date,
    due_date: args.due_date,
  };

  const response = await fetch(`${context.serverUrl}/api/versions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('创建版本'));
  }

  const result = await response.json() as { data: Version };
  const version = result.data;

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `已创建草稿版本「${version.name}」。`,
        relay: '请告诉用户版本已创建，接下来可以开始规划这个版本要完成的任务。',
        next: '询问用户这个版本要做哪些任务，并尽量收集每个任务的预估天数。',
        collect: ['任务标题', '任务说明', 'estimated_days'],
        tool: 'create_task',
        data: `版本: ${version.name}\nID: ${version.id}${version.start_date ? `\n开始: ${version.start_date}` : ''}${version.due_date ? `\n截止: ${version.due_date}` : ''}`,
      }),
    }],
  };
}
