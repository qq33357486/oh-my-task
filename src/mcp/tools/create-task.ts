import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { getProjectConfigOrThrow, requireActiveVersionForProject } from './utils/version.js';

export const createTaskTool: Tool = {
  name: 'create_task',
  description: '创建任务或子任务',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '任务标题',
      },
      description: {
        type: 'string',
        description: '任务描述',
      },
      parent_id: {
        type: 'string',
        description: '父任务ID',
      },
      parent_title: {
        type: 'string',
        description: '父任务标题，精确匹配',
      },
      version_id: {
        type: 'string',
        description: '版本ID',
      },
      estimated_days: {
        type: 'number',
        description: '预估天数',
      },
      start_date: {
        type: 'string',
        description: '计划开始日期，格式 YYYY-MM-DD',
      },
      due_date: {
        type: 'string',
        description: '计划截止日期，格式 YYYY-MM-DD',
      },
      path: {
        type: 'string',
        description: '项目路径，默认当前目录',
      },
    },
    required: ['title'],
  },
};

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

async function findParentTaskByTitle(
  parentTitle: string,
  projectId: string,
  versionId: string,
  context: McpContext
): Promise<string | null> {
  const response = await fetch(`${context.serverUrl}/api/tasks?project_id=${projectId}&version_id=${versionId}`, {
    headers: { 'Authorization': `Bearer ${context.token}` },
  });

  if (!response.ok) {
    return null;
  }

  const result = await response.json() as { data: Task[] };
  const exactMatch = result.data.find(t => t.title === parentTitle);
  return exactMatch ? exactMatch.id : null;
}

export async function handleCreateTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const projectPath = (args.path as string) || process.cwd();
  const config = getProjectConfigOrThrow(projectPath);

  if (!config.project_id) {
    throw new Error('项目配置缺少 project_id，请重新初始化项目');
  }

  const activeVersion = await requireActiveVersionForProject(config.project_id, context);

  let parentId: string | undefined = args.parent_id as string | undefined;

  if (!parentId && args.parent_title) {
    const foundId = await findParentTaskByTitle(
      args.parent_title as string,
      config.project_id,
      activeVersion.id,
      context
    );
    if (!foundId) {
      throw new Error(`找不到父任务：「${args.parent_title}」`);
    }
    parentId = foundId;
  }

  if (args.version_id && args.version_id !== activeVersion.id) {
    throw new Error('请使用当前激活版本创建任务');
  }

  if (parentId) {
    const parentResponse = await fetch(`${context.serverUrl}/api/tasks/${parentId}`, {
      headers: { 'Authorization': `Bearer ${context.token}` },
    });

    if (!parentResponse.ok) {
      const error = await parentResponse.json() as { error?: string };
      throw new Error(error.error || 'Failed to get parent task');
    }

    const parentResult = await parentResponse.json() as { data: Task };
    if (parentResult.data.version_id && parentResult.data.version_id !== activeVersion.id) {
      throw new Error('父任务不属于当前激活版本');
    }
  }

  const versionId = activeVersion.id;
  const versionName = activeVersion.name;

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
  const insertedLabel = task.inserted === 1 ? ' [插队]' : '';
  const versionInfo = versionName
    ? `\n版本: ${versionName}`
    : (task.version_id ? `\n版本ID: ${task.version_id}` : '\n未关联版本');

  return {
    content: [{
      type: 'text',
      text: `${typeLabel}已创建。${insertedLabel}\nID: ${task.id}\n标题: ${task.title}\n状态: ${task.status}${versionInfo}${task.start_date ? `\n开始: ${task.start_date}` : ''}${task.due_date ? `\n截止: ${task.due_date}` : ''}`,
    }],
  };
}
