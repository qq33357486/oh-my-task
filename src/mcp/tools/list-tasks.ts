import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { ProjectConfig, Task } from '../../types/index.js';

export const listTasksTool: Tool = {
  name: 'list_tasks',
  description: '查询任务列表，支持按状态筛选',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['planned', 'in_progress', 'done'],
        description: '按状态筛选（可选）',
      },
      parent_id: {
        type: 'string',
        description: '父任务ID，查询子任务（可选）',
      },
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
  },
};

function getProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) {
    return '没有找到任务。';
  }

  const statusEmoji: Record<string, string> = {
    planned: '📋',
    in_progress: '🔄',
    done: '✅',
  };

  const lines = tasks.map((task, index) => {
    const emoji = statusEmoji[task.status] || '📌';
    const typeLabel = task.parent_id ? '[子任务]' : '';
    return `${index + 1}. ${emoji} ${typeLabel} ${task.title}
   ID: ${task.id}
   状态: ${task.status}
   ${task.due_date ? `截止: ${task.due_date}` : ''}`;
  });

  return `找到 ${tasks.length} 个任务：\n\n${lines.join('\n\n')}`;
}

export async function handleListTasks(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfig(projectPath);

  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id');
  }

  const params = new URLSearchParams();
  params.append('project_id', config.project_id);

  if (args.status) params.append('status', args.status as string);
  if (args.parent_id !== undefined) params.append('parent_id', args.parent_id as string);

  const response = await fetch(`${context.serverUrl}/api/tasks?${params}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to list tasks');
  }

  const result = await response.json() as { data: Task[] };

  return {
    content: [{
      type: 'text',
      text: formatTaskList(result.data),
    }],
  };
}
