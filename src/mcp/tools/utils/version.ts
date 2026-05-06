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

export async function requireActiveVersionForProject(
  projectId: string,
  context: McpContext,
  projectName?: string
): Promise<Version> {
  const activeVersion = await getActiveVersionForProject(projectId, context);
  if (!activeVersion) {
    const label = projectName ? `项目「${projectName}」` : '当前项目';
    throw new Error(`${label}当前没有已开始的版本。\n请先到 Web 端创建版本，并点击“开始版本”后再使用 MCP 管理任务。`);
  }
  return activeVersion;
}
