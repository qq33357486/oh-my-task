import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { ProjectConfig } from '../../types/index.js';

export const autoScheduleTool: Tool = {
  name: 'auto_schedule',
  description: '自动排期。为当前活跃版本中 planned 状态的任务按 sort_order 顺序自动分配日期。',
  inputSchema: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: '排期开始日期，格式 YYYY-MM-DD',
      },
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
    required: ['start_date'],
  },
};

function getProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

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
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfig(projectPath);
  const startDate = args.start_date as string;

  const response = await fetch(`${context.serverUrl}/api/schedule/auto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify({ project_id: config.project_id, start_date: startDate }),
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

  const lines = [`自动排期完成！共排期 ${changes.length} 个任务：\n`];
  for (const change of changes) {
    lines.push(`• ${change.title}`);
    lines.push(`  开始: ${change.new_start}${change.new_due ? ` | 截止: ${change.new_due}` : ''}`);
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
