import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireStartedVersionForProject } from './utils/version.js';
import type { Version } from '../../types/index.js';

export const completeVersionTool: Tool = {
  name: 'complete_version',
  description: '完成当前版本',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function handleCompleteVersion(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const project = await resolveMcpProject(context);
  const version = await requireStartedVersionForProject(project.id, context, project.name);

  const response = await fetch(`${context.serverUrl}/api/versions/${version.id}/complete`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${context.token}` },
  });

  if (!response.ok) {
    const error = await response.json() as { error?: string };
    throw new Error(error.error || 'Failed to complete version');
  }

  const result = await response.json() as { data: Version };
  const completedVersion = result.data;

  return {
    content: [{
      type: 'text',
      text: `版本已完成。\n版本: ${completedVersion.name}\nID: ${completedVersion.id}\n可以使用 create_version 创建下一个版本。`,
    }],
  };
}
