export interface McpContext {
  serverUrl: string;
  token: string;
  projectName?: string;
}

export interface McpProject {
  id: string;
  name: string;
}

/**
 * 从环境变量获取 MCP 上下文
 */
export function getMcpContextFromEnv(): McpContext {
  return {
    serverUrl: process.env.OMT_SERVER_URL || 'http://localhost:17173',
    token: process.env.OMT_TOKEN || '',
    projectName: process.env.OMT_PROJECT_NAME,
  };
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

/**
 * 解析当前 MCP 配置绑定的唯一项目
 */
export async function resolveMcpProject(context: McpContext): Promise<McpProject> {
  const projectName = context.projectName?.trim();
  if (!projectName) {
    throw new Error('MCP 未配置项目名称。\n请在 MCP 配置中设置 OMT_PROJECT_NAME，值必须与 Web 端项目名称完全一致。');
  }

  const projectId = await resolveProjectId(projectName, context);
  if (!projectId) {
    throw new Error(`未找到项目：${projectName}。\n请检查 MCP 配置中的 OMT_PROJECT_NAME 是否与 Web 端项目名称完全一致；如果项目还不存在，请先到 Web 端创建项目。`);
  }

  return { id: projectId, name: projectName };
}
