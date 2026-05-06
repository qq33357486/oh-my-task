import type { Version } from '../../../types/index.js';
import type { McpContext } from './config.js';

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
    throw new Error(error.error || 'Failed to list versions');
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
    throw new Error(`${label}还没有版本。\n请先使用 create_version 创建一个版本，然后规划任务。`);
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
    throw new Error(`${label}还没有版本。\n请先使用 create_version 创建一个版本，然后规划任务。`);
  }
  if (!workingVersion.locked_at || workingVersion.completed_at || workingVersion.archived_at) {
    throw new Error(`${label}已有版本「${workingVersion.name}」，但尚未开始。\n请先规划任务并排期；准备执行时使用 start_version 开始版本。`);
  }
  return workingVersion;
}
