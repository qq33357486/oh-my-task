import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { resolveMcpProject, type McpContext } from './utils/config.js';
import { requireStartedVersionForProject } from './utils/version.js';
import type { Version } from '../../types/index.js';
import { formatAiPrompt, formatOperationFailed } from './utils/ai-prompt.js';

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
    throw new Error(error.error || formatOperationFailed('完成版本'));
  }

  const result = await response.json() as { data: Version };
  const completedVersion = result.data;

  return {
    content: [{
      type: 'text',
      text: formatAiPrompt({
        status: `版本「${completedVersion.name}」已完成。`,
        relay: '请告诉用户这个版本已经收尾完成。',
        next: '询问是否要创建下一个版本；如果需要，收集新版本名称。',
        collect: ['下一个版本名称（如需继续）'],
        tool: 'create_version',
        data: `版本: ${completedVersion.name}\nID: ${completedVersion.id}`,
      }),
    }],
  };
}
