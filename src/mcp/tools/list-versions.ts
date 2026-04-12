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
  description: '列出项目所有版本。',
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
        text: `项目暂无版本。

请使用 create_version 创建第一个版本，例如：
- create_version(name="v1.0")
- create_version(name="Sprint-1", due_date="2024-02-01")`,
      }],
    };
  }

  const versionList = versions.map((v) => {
    // 活跃版本：已开始(locked_at)且未完成(completed_at)且未归档(archived_at)
    const isActive = v.locked_at && !v.completed_at && !v.archived_at;
    const isCompleted = !!v.completed_at;
    const isArchived = !!v.archived_at;

    let statusMark = '';
    if (isArchived) statusMark = ' 📦';
    else if (isCompleted) statusMark = ' ✅';
    else if (isActive) statusMark = ' 🔒';

    const dates = [v.start_date, v.due_date].filter(Boolean).join(' ~ ') || '未设置日期';
    return `  ${v.name}${statusMark} (${dates})\n    ID: ${v.id}`;
  }).join('\n');

  return {
    content: [{
      type: 'text',
      text: `项目版本列表（共 ${versions.length} 个）：

${versionList}

🔒 = 活跃版本  ✅ = 已完成  📦 = 已归档`,
    }],
  };
}
