#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { createVersionTool, handleCreateVersion } from './tools/create-version.js';
import { listVersionsTool, handleListVersions } from './tools/list-versions.js';
import { startVersionTool, handleStartVersion } from './tools/start-version.js';
import { completeVersionTool, handleCompleteVersion } from './tools/complete-version.js';
import { createTaskTool, handleCreateTask } from './tools/create-task.js';
import { listTasksTool, handleListTasks } from './tools/list-tasks.js';
import { getTaskTool, handleGetTask } from './tools/get-task.js';
import { activateTaskTool, handleActivateTask } from './tools/activate-task.js';
import { completeTaskTool, handleCompleteTask } from './tools/complete-task.js';
import { deleteTaskTool, handleDeleteTask } from './tools/delete-task.js';
import { autoScheduleTool, handleAutoSchedule } from './tools/auto-schedule.js';
import { getCurrentTaskTool, handleGetCurrentTask } from './tools/get-current-task.js';
import { logger } from '../utils/logger.js';
// 配置工具
import { getMcpContextFromEnv } from './tools/utils/config.js';

// 从环境变量获取 MCP 上下文
const mcpContext = getMcpContextFromEnv();
const packageVersion = getPackageVersion();

// 创建 MCP Server
const server = new Server(
  {
    name: 'oh-my-task',
    version: packageVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

function getPackageVersion(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let depth = 0; depth < 5; depth += 1) {
    const packagePath = join(currentDir, 'package.json');
    if (existsSync(packagePath)) {
      const content = JSON.parse(readFileSync(packagePath, 'utf-8')) as { version?: unknown };
      if (typeof content.version === 'string' && content.version) {
        return content.version;
      }
    }
    currentDir = dirname(currentDir);
  }

  return '0.0.0';
}

// 工具列表
const tools = [
  createVersionTool,
  listVersionsTool,
  startVersionTool,
  completeVersionTool,
  createTaskTool,
  listTasksTool,
  getTaskTool,
  activateTaskTool,
  completeTaskTool,
  deleteTaskTool,
  autoScheduleTool,
  getCurrentTaskTool,
];

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// 处理工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'create_version':
        return await handleCreateVersion(args, mcpContext);
      case 'list_versions':
        return await handleListVersions(args, mcpContext);
      case 'start_version':
        return await handleStartVersion(args, mcpContext);
      case 'complete_version':
        return await handleCompleteVersion(args, mcpContext);
      case 'create_task':
        return await handleCreateTask(args, mcpContext);
      case 'list_tasks':
        return await handleListTasks(args, mcpContext);
      case 'get_task':
        return await handleGetTask(args, mcpContext);
      case 'activate_task':
        return await handleActivateTask(args, mcpContext);
      case 'complete_task':
        return await handleCompleteTask(args, mcpContext);
      case 'delete_task':
        return await handleDeleteTask(args, mcpContext);
      case 'auto_schedule':
        return await handleAutoSchedule(args, mcpContext);
      case 'get_current_task':
        return await handleGetCurrentTask(args, mcpContext);
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('mcp', '工具调用失败', 'MCP 工具调用时发生异常', {
      tool: name,
      error,
    });
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// 启动 MCP Server
export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('mcp', 'MCP 服务启动成功', 'MCP stdio 服务已启动', {
    version: packageVersion,
  });
  console.error(`MCP Server started (v${packageVersion})`);
}

// 如果直接运行此文件
startMcpServer().catch(error => {
  logger.error('mcp', 'MCP 服务启动失败', 'MCP stdio 服务启动失败', { error });
  console.error(error);
});
