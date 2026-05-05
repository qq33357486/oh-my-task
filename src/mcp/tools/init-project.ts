import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ProjectConfig } from '../../types/index.js';
import type { McpContext } from './utils/config.js';

export const initProjectTool: Tool = {
  name: 'init_project',
  description: '初始化或连接项目',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '项目名称',
      },
      description: {
        type: 'string',
        description: '项目描述',
      },
      path: {
        type: 'string',
        description: '项目路径，默认当前目录',
      },
    },
    required: ['name'],
  },
};

const AGENTS_HEADER = `# 项目规则

> [oh-my-task 任务管理规则](.omt/rules.md)

---

`;

const RULES_CONTENT = `# oh-my-task 任务管理规则

## 核心概念

- **项目 (Project)**: 顶层容器，一个代码仓库对应一个项目
- **版本 (Version)**: 任务的分组容器（如 v1.0、Sprint-1），任务必须关联版本才能在网页显示
- **任务 (Task)**: 具体的工作项，支持最多 3 级层级子任务

## 任务状态

- **planned**: 待办
- **in_progress**: 进行中
- **done**: 已完成
`;

export async function handleInitProject(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const name = args.name as string;
  const description = args.description as string | undefined;
  const projectPath = (args.path as string) || process.cwd();
  const configPath = join(projectPath, '.omt.json');

  if (existsSync(configPath)) {
    const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as ProjectConfig;
    return {
      content: [{
        type: 'text',
        text: `项目已存在。\n项目名称: ${existingConfig.project_name || name}\n项目ID: ${existingConfig.project_id}`,
      }],
    };
  }

  const listResponse = await fetch(`${context.serverUrl}/api/projects`, {
    headers: {
      'Authorization': `Bearer ${context.token}`,
    },
  });

  let projectId: string | null = null;
  let isNewProject = false;

  if (listResponse.ok) {
    const listResult = await listResponse.json() as { data: Array<{ id: string; name: string }> };
    const existingProject = listResult.data.find(p => p.name === name);
    if (existingProject) {
      projectId = existingProject.id;
    }
  }

  if (!projectId) {
    const createResponse = await fetch(`${context.serverUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${context.token}`,
      },
      body: JSON.stringify({ name, description }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json() as { error?: string };
      throw new Error(error.error || 'Failed to create project');
    }

    const createResult = await createResponse.json() as { data: { id: string; name: string } };
    projectId = createResult.data.id;
    isNewProject = true;
  }

  const config: ProjectConfig = {
    project_id: projectId,
    project_name: name,
    project_path: projectPath,
    server_url: context.serverUrl,
    token: context.token,
    created_at: new Date().toISOString(),
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const omtDir = join(projectPath, '.omt');
  if (!existsSync(omtDir)) {
    mkdirSync(omtDir, { recursive: true });
  }

  const rulesPath = join(omtDir, 'rules.md');
  if (!existsSync(rulesPath)) {
    writeFileSync(rulesPath, RULES_CONTENT);
  }

  const agentsPath = join(projectPath, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, 'utf-8');
    if (!content.includes('.omt/rules.md')) {
      writeFileSync(agentsPath, AGENTS_HEADER + content);
    }
  } else {
    writeFileSync(agentsPath, AGENTS_HEADER);
  }

  const action = isNewProject ? '项目创建成功。' : '已连接现有项目。';

  return {
    content: [{
      type: 'text',
      text: `${action}\n项目名称: ${name}\n项目ID: ${projectId}`,
    }],
  };
}
