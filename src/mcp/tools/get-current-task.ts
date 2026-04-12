import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { ProjectConfig, Task, TaskWithChildren } from '../../types/index.js';

export const getCurrentTaskTool: Tool = {
  name: 'get_current_task',
  description: '获取当前进行中的主任务及其子任务',
  inputSchema: {
    type: 'object',
    properties: {
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

function formatCurrentTask(task: TaskWithChildren): string {
  let output = `当前任务: ${task.title}\n   ID: ${task.id}\n   状态: ${task.status}`;

  if (task.start_date || task.due_date) {
    output += `\n   ${task.start_date ? `开始: ${task.start_date}` : ''} ${task.due_date ? `截止: ${task.due_date}` : ''}`.trimEnd();
  }

  if (task.estimated_days) {
    output += `\n   预估: ${task.estimated_days} 天`;
  }

  if (task.children && task.children.length > 0) {
    output += `\n\n子任务 (${task.children.length}):`;
    for (const child of task.children) {
      output += `\n  ${child.title}\n     ID: ${child.id} | 状态: ${child.status}`;
    }
  }

  return output;
}

export async function handleGetCurrentTask(
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
  params.append('status', 'in_progress');
  params.append('parent_id', 'null');

  const listResponse = await fetch(`${context.serverUrl}/api/tasks?${params}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!listResponse.ok) {
    const error = await listResponse.json() as { error?: string };
    throw new Error(error.error || 'Failed to list tasks');
  }

  const listResult = await listResponse.json() as { data: Task[] };

  if (!listResult.data || listResult.data.length === 0) {
    return {
      content: [{
        type: 'text',
        text: '无进行中任务。',
      }],
    };
  }

  const mainTask = listResult.data[0];
  const detailResponse = await fetch(`${context.serverUrl}/api/tasks/${mainTask.id}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!detailResponse.ok) {
    const error = await detailResponse.json() as { error?: string };
    throw new Error(error.error || 'Failed to get task detail');
  }

  const detailResult = await detailResponse.json() as { data: TaskWithChildren };

  return {
    content: [{
      type: 'text',
      text: formatCurrentTask(detailResult.data),
    }],
  };
}
