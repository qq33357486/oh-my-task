import type { Version } from '../../../types/index.js';
import type { McpContext } from './config.js';
import { formatAiPrompt, formatOperationFailed } from './ai-prompt.js';

export async function fetchVersionsForProject(
  projectId: string,
  context: McpContext
): Promise<Version[]> {
  const response = await fetch(`${context.serverUrl}/api/versions?project_id=${projectId}`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || formatOperationFailed('获取版本列表'));
  }

  const result = await response.json() as { data: Version[] };
  return result.data;
}

export async function getActiveVersionForProject(
  projectId: string,
  context: McpContext
): Promise<Version | null> {
  const versions = await fetchVersionsForProject(projectId, context);
  return versions.find((version) => version.locked_at && !version.completed_at && !version.archived_at) || null;
}

export async function getWorkingVersionForProject(
  projectId: string,
  context: McpContext
): Promise<Version | null> {
  const versions = await fetchVersionsForProject(projectId, context);
  return versions.find((version) => version.locked_at && !version.completed_at && !version.archived_at)
    || versions.find((version) => !version.completed_at && !version.archived_at)
    || null;
}

export async function requireWorkingVersionForProject(
  projectId: string,
  context: McpContext,
  projectName?: string
): Promise<Version> {
  const version = await getWorkingVersionForProject(projectId, context);
  if (!version) {
    const label = projectName ? `项目「${projectName}」` : '当前项目';
    throw new Error(formatAiPrompt({
      status: `${label}还没有任何版本。`,
      relay: '请用自然语气告诉用户当前项目还没有版本，并询问这次版本叫什么名称。',
      next: '拿到版本名称后，调用 create_version 创建草稿版本，然后继续引导用户规划任务。',
      collect: ['版本名称'],
      tool: 'create_version',
    }));
  }
  return version;
}

export async function requireStartedVersionForProject(
  projectId: string,
  context: McpContext,
  projectName?: string
): Promise<Version> {
  const workingVersion = await getWorkingVersionForProject(projectId, context);
  const label = projectName ? `项目「${projectName}」` : '当前项目';
  if (!workingVersion) {
    throw new Error(formatAiPrompt({
      status: `${label}还没有任何版本。`,
      relay: '请用自然语气告诉用户当前项目还没有版本，并询问这次版本叫什么名称。',
      next: '拿到版本名称后，调用 create_version 创建草稿版本，然后继续引导用户规划任务。',
      collect: ['版本名称'],
      tool: 'create_version',
    }));
  }
  if (!workingVersion.locked_at || workingVersion.completed_at || workingVersion.archived_at) {
    throw new Error(formatAiPrompt({
      status: `${label}已有版本「${workingVersion.name}」，但版本尚未开始。`,
      relay: '请告诉用户版本还在规划/排期阶段，当前执行类操作需要先开始版本。',
      next: '如果任务已经规划并排期，请询问用户是否开始版本；如果尚未规划完整，请继续收集任务或开始日期。',
      collect: ['是否开始版本', '必要时补充任务或计划开始日期'],
      tool: ['create_task', 'auto_schedule', 'start_version'],
    }));
  }
  return workingVersion;
}
