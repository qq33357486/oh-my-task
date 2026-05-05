import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ProjectConfig, Version } from '../../../types/index.js';
import type { McpContext } from './config.js';

export function getProjectConfigOrThrow(projectPath: string): ProjectConfig {
  const configPath = join(projectPath, '.omt.json');
  if (!existsSync(configPath)) {
    throw new Error('项目未初始化。请先运行 init_project');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8')) as ProjectConfig;
}

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
  context: McpContext
): Promise<Version> {
  const activeVersion = await getActiveVersionForProject(projectId, context);
  if (!activeVersion) {
    throw new Error('当前没有激活版本，请先创建并开始一个版本');
  }
  return activeVersion;
}
