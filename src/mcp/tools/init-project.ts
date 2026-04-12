import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ProjectConfig } from '../../types/index.js';
import type { McpContext } from './utils/config.js';

export const initProjectTool: Tool = {
  name: 'init_project',
  description: '初始化项目。如果项目不存在则自动创建，存在则返回现有项目。',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '项目名称',
      },
      description: {
        type: 'string',
        description: '项目描述（可选）',
      },
      path: {
        type: 'string',
        description: '项目路径（可选，默认当前目录）',
      },
    },
    required: ['name'],
  },
};

const AGENTS_HEADER = `# 项目规则

> ⚠️ **开始任务前，请先阅读以下规则文档：**
> - [oh-my-task 任务管理规则](.omt/rules.md)

---

`;

const RULES_CONTENT = `# oh-my-task 任务管理规则

## 核心概念

- **项目 (Project)**: 顶层容器，一个代码仓库对应一个项目
- **版本 (Version)**: 任务的分组容器（如 v1.0、Sprint-1），任务必须关联版本才能在网页显示
- **任务 (Task)**: 具体的工作项，支持最多 3 级层级子任务

## 完整工作流

### 新项目初始化
\`\`\`
1. init_project(name="项目名")     # 创建项目
2. create_version(name="v1.0")     # 创建版本（必须！）
3. create_task(title="任务1")      # 创建任务（自动关联到最新版本）
\`\`\`

### 日常使用
- \`list_versions\` - 查看项目版本
- \`list_tasks\` - 查看任务列表
- \`create_task\` - 创建任务（自动关联最新版本）
- \`activate_task\` - 开始任务
- \`complete_task\` - 完成任务
- \`auto_schedule\` - 自动排期

## 任务状态
- **planned**: 待办，初始状态
- **in_progress**: 进行中，正在执行
- **done**: 已完成

## 触发词映射

| 用户说 | 调用工具 |
|--------|----------|
| "初始化项目" | \`init_project\` |
| "创建版本" | \`create_version\` |
| "查看版本" | \`list_versions\` |
| "创建任务" | \`create_task\` |
| "任务列表" | \`list_tasks\` |
| "开始任务" | \`activate_task\` |
| "完成了"、"做完了" | \`complete_task\` |
| "排期" | \`auto_schedule\` |

## 常见问题

**Q: 任务在网页中不显示？**
A: 检查任务是否关联了版本。使用 \`list_versions\` 确认项目有版本，没有则先 \`create_version\`。
`;

export async function handleInitProject(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const name = args.name as string;
  const description = args.description as string | undefined;
  const projectPath = (args.path as string) || process.cwd();
  const configPath = join(projectPath, '.omt.json');

  // 检查配置文件是否已存在
  if (existsSync(configPath)) {
    const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as ProjectConfig;
    return {
      content: [{
        type: 'text',
        text: `项目已存在。
项目名称: ${existingConfig.project_name || name}
项目ID: ${existingConfig.project_id}

无需重复初始化。`,
      }],
    };
  }

  // 先查询项目是否已存在（通过名称）
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

  // 项目不存在，创建
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

  // 写入配置文件
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

  const action = isNewProject ? '项目创建成功！' : '已连接到现有项目。';

  return {
    content: [{
      type: 'text',
      text: `${action}
项目名称: ${name}
项目ID: ${projectId}

已创建文件：
- .omt.json (项目配置)
- .omt/rules.md (任务管理规则)
- AGENTS.md (已更新规则索引)

⚠️ 开始任务前，请先阅读 .omt/rules.md`,
    }],
  };
}
