import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

interface Version {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  locked_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  sort_order: number;
}

export const listVersionsTool: Tool = {
  name: 'list_versions',
  description: '列出版本',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleListVersions(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);

  const response = await fetch(`${context.serverUrl}/api/versions?project_id=${project.id}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('获取版本列表'));
  }

  const result = await response.json() as { data: Version[] };
  const versions = result.data;

  if (versions.length === 0) {
    return {
      content: [{
        type: 'text',
        text: formatAiPrompt({
          status: `项目「${project.name}」还没有任何版本。`,
          relay: '请告诉用户当前项目还没有版本，并询问这次版本叫什么名称。',
          next: '拿到版本名称后，调用 create_version 创建草稿版本。',
          collect: ['版本名称'],
          tool: 'create_version',
        }),
      }],
    };
  }

  const versionList = versions.map((v) => {
    const isActive = v.locked_at && !v.completed_at && !v.archived_at;
    const isCompleted = !!v.completed_at;
    const isArchived = !!v.archived_at;

    let status = '[草稿]';
    if (isArchived) status = '[归档]';
    else if (isCompleted) status = '[完成]';
    else if (isActive) status = '[活跃]';
    else if (v.start_date || v.due_date) status = '[已排期]';

    const dates = [v.start_date, v.due_date].filter(Boolean).join(' ~ ') || '';
    return `  ${v.name}${status ? ' ' + status : ''}${dates ? ' (' + dates + ')' : ''}\n    ID: ${v.id}`;
  }).join('\n');

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `项目「${project.name}」共有 ${versions.length} 个版本。`,
        relay: '请向用户概括版本状态，并根据用户目标引导继续规划、排期、开始或完成版本。',
        next: '如果存在草稿/已排期版本，优先围绕当前工作版本继续；如果用户要创建新版本，需确认没有未完成版本阻塞。',
        tool: ['create_version', 'create_task', 'auto_schedule', 'start_version'],
        data: `共 ${versions.length} 个版本：\n\n${versionList}`,
      }),
    }],
  };
}
