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
}

export const createVersionTool: Tool = {
  name: 'create_version',
  description: '创建版本。任务是必须关联版本才能显示。版本如 v1.0、Sprint-1。',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '版本名称（如 v1.0、Sprint-1、2024-Q1）',
      },
      description: {
        type: 'string',
        description: '版本描述（可选）',
      },
      start_date: {
        type: 'string',
        description: '计划开始日期，格式 YYYY-MM-DD（可选）',
      },
      due_date: {
        type: 'string',
        description: '目标发布日期，格式 YYYY-MM-DD（可选）',
      },
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
    required: ['name'],
  },
};

function getProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export async function handleCreateVersion(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfig(projectPath);

  const body = {
    project_id: config.project_id,
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
    throw new Error(error.error || 'Failed to create version');
  }

  const result = await response.json() as { data: Version };
  const version = result.data;

  return {
    content: [{
      type: 'text',
      text: `版本创建成功！🏷️
版本名称: ${version.name}
版本ID: ${version.id}
${version.start_date ? `开始日期: ${version.start_date}` : ''}
${version.due_date ? `目标日期: ${version.due_date}` : ''}

后续使用 create_task 创建的任务会自动关联到此版本。`,
    }],
  };
}
