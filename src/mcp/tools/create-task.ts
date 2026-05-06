import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import type { Task } from '../../types/index.js';
import { requireWorkingVersionForProject } from './utils/version.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

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
  const project = await resolveMcpProject(context);
  const workingVersion = await requireWorkingVersionForProject(project.id, context, project.name);

  let parentId: string | undefined = args.parent_id as string | undefined;

  if (!parentId && args.parent_title) {
    const foundId = await findParentTaskByTitle(
      args.parent_title as string,
      project.id,
      workingVersion.id,
      context
    );
    if (!foundId) {
      throw new Error(formatAiPrompt({
        status: `找不到父任务「${args.parent_title}」。`,
        relay: '请告诉用户没有找到这个父任务，当前子任务还没有创建。',
        next: '请用户确认父任务标题，或先列出当前版本的任务供用户选择父任务。',
        collect: ['正确的父任务标题或父任务 ID'],
        tool: 'list_tasks',
      }));
    }
    parentId = foundId;
  }

  if (args.version_id && args.version_id !== workingVersion.id) {
    throw new Error(formatAiPrompt({
      status: `当前正在处理版本「${workingVersion.name}」，但请求指定了其它版本。`,
      relay: '请告诉用户当前任务应先放到正在处理的版本中；不要静默切换版本。',
      next: '如果用户确认要在当前版本创建任务，请继续使用当前版本；如果要切换版本，请先让用户说明目标版本。',
      collect: ['是否使用当前版本', '必要时收集目标版本'],
      tool: ['create_task', 'list_versions'],
    }));
  }

  if (parentId) {
    const parentResponse = await fetch(`${context.serverUrl}/api/tasks/${parentId}`, {
      headers: { 'Authorization': `Bearer ${context.token}` },
    });

    if (!parentResponse.ok) {
      const error = await parentResponse.json() as { error?: string };
      throw new Error(error.error || formatOperationFailed('获取父任务'));
    }

    const parentResult = await parentResponse.json() as { data: Task };
    if (parentResult.data.version_id && parentResult.data.version_id !== workingVersion.id) {
      throw new Error(formatAiPrompt({
        status: `指定的父任务不属于当前版本「${workingVersion.name}」。`,
        relay: '请告诉用户父任务和新任务必须在同一个版本内。',
        next: '建议先列出当前版本任务，让用户选择正确的父任务。',
        collect: ['当前版本中的父任务'],
        tool: 'list_tasks',
      }));
    }
  }

  const versionId = workingVersion.id;
  const versionName = workingVersion.name;

  const body: Record<string, unknown> = {
    project_id: project.id,
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
    throw new Error(error.error || formatOperationFailed('创建任务'));
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
      text: formatAiPrompt({
        status: `${typeLabel}「${task.title}」已创建到版本「${versionName}」。${insertedLabel ? '这是一个插队任务。' : ''}`,
        relay: '请简要确认任务已记录。',
        next: '继续询问是否还有其它任务；如果用户表示任务已经完整，则引导提供计划开始日期用于自动排期。',
        collect: ['更多任务，或计划开始日期'],
        tool: ['create_task', 'auto_schedule'],
        data: `ID: ${task.id}\n标题: ${task.title}\n状态: ${task.status}${versionInfo}${task.start_date ? `\n开始: ${task.start_date}` : ''}${task.due_date ? `\n截止: ${task.due_date}` : ''}`,
      }),
    }],
  };
}
