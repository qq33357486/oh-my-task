import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { ProjectConfig, Task } from '../../types/index.js';

export const createTaskTool: Tool = {
  name: 'create_task',
  description: '创建任务或子任务。自动关联最新版本。子任务用 parent_title 指定父任务。',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '任务标题',
      },
      description: {
        type: 'string',
        description: '任务描述（可选）',
      },
      parent_id: {
        type: 'string',
        description: '父任务ID（可选）。子任务会自动继承父任务的 version_id',
      },
      parent_title: {
        type: 'string',
        description: '父任务标题（可选）。通过标题精确匹配查找父任务，比 parent_id 更方便',
      },
      version_id: {
        type: 'string',
        description: '版本ID（可选）。不指定时自动使用项目最新版本',
      },
      estimated_days: {
        type: 'number',
        description: '预估工时（天）（可选）',
      },
      start_date: {
        type: 'string',
        description: '计划开始日期，格式 YYYY-MM-DD（可选）',
      },
      due_date: {
        type: 'string',
        description: '计划截止日期，格式 YYYY-MM-DD（可选）',
      },
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
    required: ['title'],
  },
};

function getProjectConfig(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

interface Version {
  id: string;
  name: string;
}

interface TaskResult {
  id: string;
  title: string;
  status: string;
  version_id?: string;
  start_date?: string;
  due_date?: string;
  parent_id?: string;
  inserted?: number;
}

/**
 * 通过标题精确匹配查找父任务
 */
async function findParentTaskByTitle(
  parentTitle: string,
  projectId: string,
  context: McpContext
): Promise<string | null> {
  const response = await fetch(`${context.serverUrl}/api/tasks?project_id=${projectId}`, {
    headers: { 'Authorization': `Bearer ${context.token}` },
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json() as { data: Task[] };
  const tasks = result.data;

  // 精确匹配优先
  const exactMatch = tasks.find(t => t.title === parentTitle);
  if (exactMatch) {
    return exactMatch.id;
  }

  // 未找到精确匹配，返回 null
  return null;
}

export async function handleCreateTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfig(projectPath);

  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id，请重新初始化项目');
  }

  // 解析 parent_id
  let parentId: string | undefined = args.parent_id as string | undefined;

  if (!parentId && args.parent_title) {
    const foundId = await findParentTaskByTitle(
      args.parent_title as string,
      config.project_id,
      context
    );
    if (!foundId) {
      throw new Error(`找不到父任务：「${args.parent_title}」`);
    }
    parentId = foundId;
  }

  // 自动关联最新版本
  let versionId = args.version_id as string | undefined;
  let versionName = '';

  if (!versionId && !parentId) {
    const versionsRes = await fetch(`${context.serverUrl}/api/versions?project_id=${config.project_id}`, {
      headers: { 'Authorization': `Bearer ${context.token}` },
    });

    if (versionsRes.ok) {
      const versionsData = await versionsRes.json() as { data: Version[] };
      const versions = versionsData.data;
      if (versions && versions.length > 0) {
        const latestVersion = versions[versions.length - 1];
        versionId = latestVersion.id;
        versionName = latestVersion.name;
      }
    }
  }

  const body: Record<string, unknown> = {
    project_id: config.project_id,
    version_id: versionId,
    title: args.title,
    description: args.description,
    parent_id: parentId,
    estimated_days: args.estimated_days,
    start_date: args.start_date,
    due_date: args.due_date,
  };

  const response = await fetch(`${context.serverUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${context.token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to create task');
  }

  const result = await response.json() as { data: TaskResult };
  const task = result.data;

  const typeLabel = task.parent_id ? '子任务' : '任务';
  const insertedLabel = task.inserted === 1 ? ' ⚡插队任务' : '';
  const versionInfo = versionName
    ? `\n版本: ${versionName}`
    : (task.version_id ? `\n版本ID: ${task.version_id}` : '\n⚠️ 未关联版本（请先创建版本）');

  return {
    content: [{
      type: 'text',
      text: `${typeLabel}创建成功！${insertedLabel}
ID: ${task.id}
标题: ${task.title}
状态: ${task.status}${versionInfo}
${task.start_date ? `开始日期: ${task.start_date}` : ''}
${task.due_date ? `截止日期: ${task.due_date}` : ''}`,
    }],
  };
}
