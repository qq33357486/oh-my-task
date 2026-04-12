import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { ProjectConfig } from '../../types/index.js';

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
  description: '列出项目所有版本',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
    required: [],
  },
};

function getProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export async function handleListVersions(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfig(projectPath);

  const response = await fetch(`${context.serverUrl}/api/versions?project_id=${config.project_id}`, {
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

    let status = '';
    if (isArchived) status = '[归档]';
    else if (isCompleted) status = '[完成]';
    else if (isActive) status = '[活跃]';

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
