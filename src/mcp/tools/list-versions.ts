import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';

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
    throw new Error(error.error || 'Failed to list versions');
  }

  const result = await response.json() as { data: Version[] };
  const versions = result.data;

  if (versions.length === 0) {
    return {
      content: [{
        type: 'text',
        text: '暂无版本。',
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
      text: `共 ${versions.length} 个版本：\n\n${versionList}`,
    }],
  };
}
