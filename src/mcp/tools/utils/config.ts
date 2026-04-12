import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ProjectConfig } from '../../../types/index.js';

export interface McpContext {
  serverUrl: string;
  token: string;
  projectName?: string;
}

/**
 * 从环境变量获取 MCP 上下文
 */
export function getMcpContextFromEnv(): McpContext {
  return {
    serverUrl: process.env.OMT_SERVER_URL || 'http://localhost:3000',
    token: process.env.OMT_TOKEN || '',
    projectName: process.env.OMT_PROJECT_NAME,
  };
}

/**
 * 读取项目配置文件
 */
export function readProjectConfig(projectPath?: string): ProjectConfig | null {
  const configPath = join(projectPath || process.cwd(), '.omt.json');
  
  if (!existsSync(configPath)) {
    return null;
  }
  
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')) as ProjectConfig;
  } catch {
    return null;
  }
}

/**
 * 获取项目的 project_id（兼容新旧格式）
 */
export function getProjectId(config: ProjectConfig, context: McpContext): string | null {
  // 新格式：通过 project_name 查询
  if (config.project_name && !config.project_id) {
    // 需要从 API 查询 project_id
    return null;  // 由调用方处理
  }
  
  // 旧格式或已有 project_id
  return config.project_id || null;
}

/**
 * 获取认证 Token（优先使用配置中的 token，其次使用环境变量）
 */
export function getAuthToken(config: ProjectConfig | null, context: McpContext): string {
  // 优先级：配置文件 token > 环境变量 token > 环境变量 api_key
  return config?.token || context.token;
}

/**
 * 获取项目路径
 */
export function getProjectPath(): string {
  return process.cwd();
}

/**
 * 检查项目是否已初始化
 */
export function isProjectInitialized(projectPath?: string): boolean {
  const configPath = join(projectPath || process.cwd(), '.omt.json');
  return existsSync(configPath);
}

/**
 * 通过项目名称查询项目 ID
 */
export async function resolveProjectId(
  projectName: string,
  context: McpContext
): Promise<string | null> {
  try {
    const response = await fetch(`${context.serverUrl}/api/projects`, {
      headers: {
        'Authorization': `Bearer ${context.token}`,
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const result = await response.json() as { data: Array<{ id: string; name: string }> };
    const project = result.data.find(p => p.name === projectName);
    
    return project?.id || null;
  } catch {
    return null;
  }
}
