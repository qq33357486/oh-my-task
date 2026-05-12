# 项目规则

> [oh-my-task 任务管理规则](.omt/rules.md)

---

# AGENTS.md - AI Coding Agent Guidelines

本文档是 AI Coding Agent 在 oh-my-task 仓库内工作的项目约定。

## 规则

- 中文回复。
- Git 提交说明使用中文。
- 当用户要求“提交 git / 提高 tag / 推送”或类似发布动作时，必须同时完成版本号提升、提交、创建对应 `vX.Y.Z` tag，并推送分支和 tag；不要只提交代码而遗漏 tag。
- 修改代码前先了解现有结构、脚本和代码风格；不要凭空引入未安装依赖。
- 除非用户明确要求，不要新增或更新 README/文档类文件；本文件例外仅在用户要求时修改。
- 验证范围按改动范围最小化：小型 UI/文案/单文件修复优先只跑对应单测或最相关检查，必要时再补 lint；不要为了简单改动默认执行全量测试、全量构建或无关后端验证，除非改动跨模块、影响构建产物，或用户明确要求。

## 项目概览

oh-my-task 是一个面向个人和小团队的任务管理与 AI 协作系统，通过 Web、REST API 和 MCP 工具统一管理项目、版本、任务和排期。

- **后端**：Express.js REST API + TypeScript，入口为 `src/index.ts` / `src/api/server.ts`。
- **MCP**：基于 `@modelcontextprotocol/sdk` 的 stdio MCP Server，入口为 `src/mcp/server.ts`。
- **前端**：React 19 + Vite + TanStack Query + Tailwind CSS 4，源码在 `web/src`。
- **数据库**：SQLite + better-sqlite3，schema 在 `src/db/schema.sql`。
- **生产部署**：后端可直接托管 `web/dist`，统一入口默认 `http://localhost:17173`。

## 项目结构

```text
oh-my-task/
├── src/
│   ├── api/
│   │   ├── middleware/     # authMiddleware / adminOnly
│   │   └── routes/         # auth, tokens, users, projects, versions, tasks, schedule, config, admin
│   ├── db/                 # connection.ts, init.ts, schema.sql
│   ├── mcp/
│   │   ├── server.ts       # MCP server 入口
│   │   └── tools/          # init_project, list_tasks, create_task, versions, schedule 等工具
│   ├── services/           # 业务逻辑层
│   ├── types/              # 共享 TypeScript 类型
│   ├── utils/              # 工具函数
│   └── __tests__/          # 后端 Vitest 测试
├── web/
│   └── src/
│       ├── components/     # UI 组件
│       ├── hooks/          # 前端 hooks
│       ├── lib/            # 前端工具
│       ├── pages/          # 页面组件
│       ├── __tests__/      # 前端 Vitest 测试
│       ├── api.ts          # API client 与前端类型
│       └── App.tsx
├── test/                   # CJS 功能流脚本（API/MCP/生命周期）
├── scripts/                # 构建、复制 schema、开发启动脚本
├── data/                   # 本地 SQLite 数据
├── qa-results/             # QA 输出
├── Dockerfile
└── docker-compose.yml
```

## 启动方式

### 统一端口启动（推荐）

```powershell
npm run build
Set-Location "D:\1 git\oh-my-task\web"; npm run build
Set-Location "D:\1 git\oh-my-task"; $env:WEB_DIST_PATH = "web/dist"; $env:API_PORT = "17173"; npm start
```

Web、REST API、MCP/API 入口统一使用 `http://localhost:17173`。

### Windows 后台启动

PowerShell 5.1 不支持 `&&`，但传给 `cmd.exe /c` 的命令可以使用 `&&`。

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"D:\1 git\oh-my-task`" && set WEB_DIST_PATH=web/dist && set API_PORT=17173 && npm start" -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "http://localhost:17173/api/health" -UseBasicParsing | Select-Object StatusCode
```

### 前端单独调试（可选）

```powershell
npm run dev          # 后端 API，http://localhost:17173
Set-Location "D:\1 git\oh-my-task\web"; npm run dev
```

`web/vite.config.ts` 的 `5173` 仅用于 Vite 热更新调试，并通过 proxy 转发 `/api` 到 `17173`；它不是正式业务入口，功能 QA 与部署都不要使用 `5173`。

## 脚本命令

### 根目录

```powershell
npm install
npm run dev          # tsx watch src/index.ts，仅启动后端 API
npm run dev:all      # 启动后端 + Vite 调试端口 5173，仅用于前端热更新
npm run build        # clean dist + tsc + copy schema
npm start            # node dist/index.js
npm run mcp          # tsx src/mcp/server.ts
npm run db:init      # 初始化数据库
npx vitest run       # 后端测试，匹配 src/__tests__/**/*.test.ts
```

根目录没有 `test`、`lint`、`db:clean` 脚本，不要直接调用不存在的 npm script。

### 前端 `web/`

```powershell
npm install
npm run dev
npm run build
npm run lint
npm run preview
npx vitest run       # 使用 web/vitest.config.ts，jsdom 环境
```

## 验证与 QA

- 代码改动后优先运行与改动相关的快速检查，再在提交前运行必要的完整检查。
- 后端类型/构建：`npm run build`。
- 后端单测：`npx vitest run`。
- 前端 lint：在 `web/` 下运行 `npm run lint`。
- 前端构建：在 `web/` 下运行 `npm run build`。
- 前端单测：在 `web/` 下运行 `npx vitest run`。
- 功能 QA 使用 `.factory/skills/qa*`，要求临时 `DB_PATH`、构建后端和前端，并用统一端口 `http://localhost:17173`；不要用 Vite `5173` 做正式功能 QA。
- GitHub Actions 的功能 QA 在 `.github/workflows/qa.yml`，触发于 PR 到 `master` 或手动运行。

## 架构与业务边界

### REST API

- 路由位于 `src/api/routes/`。
- 公开路由：`/api/health`、`/api/auth`。
- 受保护路由：`/api/tokens`、`/api/users`、`/api/projects`、`/api/versions`、`/api/tasks`、`/api/schedule`、`/api/config`、`/api/admin`。
- 路由层负责 HTTP 参数校验与响应，复杂业务放在 `src/services/`。

### 认证与权限

- Web 使用 Session Cookie，cookie 名为 `omt_session_id`。
- API/MCP 使用 `Authorization: Bearer <token>`，Token 存储在 `user_tokens` 表。
- `authMiddleware` 会写入 `req.auth.user`。
- 管理员权限使用 `adminOnly`。
- 默认管理员仅在空库初始化时创建：`admin@admin.com / admin`。

### MCP

- MCP 工具位于 `src/mcp/tools/`，每个工具通常包含 Tool 定义和 handler。
- MCP 上下文来自 `src/mcp/tools/utils/config.ts`：
  - `OMT_SERVER_URL` 默认 `http://localhost:17173`
  - `OMT_TOKEN`
  - `OMT_PROJECT_NAME`
- 项目初始化读取/写入 `.omt.json`，新格式优先使用 `project_name`，仍兼容 `project_id`。
- API 调用应统一带 Bearer Token；不要使用旧的 `OMT_API_KEY` 作为当前主路径。

### 数据库

当前 schema v2 的核心表：

- `users`
- `user_tokens`
- `user_activity`
- `projects`
- `versions`
- `tasks`
- `task_history`
- `holidays`
- `system_config`
- `sessions`

数据库连接规则：

- `DB_PATH` 默认 `./data/data.db`。
- `getDb()` 是单例连接，切换 `DB_PATH` 时会关闭旧连接并重建。
- 初始化会执行 `schema.sql`、修复 session 表结构，并在空库创建默认管理员。
- SQLite 查询同步执行，不要无意义地包装 `async/await`。

## 当前数据模型重点

类型统一定义在 `src/types/index.ts`。

```typescript
export type UserRole = 'admin' | 'member';
export type TaskStatus = 'planned' | 'in_progress' | 'done';
export type TaskAction = 'created' | 'updated' | 'status_changed' | 'noted';

export interface Task {
  id: string;
  project_id: string;
  version_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  estimated_days: number;
  start_date: string | null;
  due_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  sort_order: number;
  inserted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
```

注意：SOP、assignee、阶段性文档等旧功能已从 schema v2 移除，不要在新代码里恢复 `SOP` 或 `sop_id`。

## 代码风格

### TypeScript

- Target：ES2022。
- Module：ESNext，moduleResolution 为 bundler。
- Strict mode 开启。
- 后端本地相对导入必须写 `.js` 后缀，即使源文件是 `.ts`。

```typescript
import { getDb } from '../db/connection.js';
import type { Task, TaskStatus } from '../../types/index.js';
```

- 前端导入不需要扩展名。
- 新增导出函数建议写简短 JSDoc。
- 避免 `any`，优先使用 `unknown`、显式接口或类型守卫。

### 命名约定

| 元素 | 约定 | 示例 |
| --- | --- | --- |
| 后端文件 | kebab-case | `task.service.ts` |
| 前端页面/组件文件 | PascalCase | `TasksPage.tsx` |
| 类型/接口 | PascalCase | `CreateTaskParams` |
| 函数/变量 | camelCase | `listTasks` |
| 数据库列 | snake_case | `project_id` |
| 环境变量 | UPPER_SNAKE_CASE | `DB_PATH` |

### API 响应

```typescript
res.json({ success: true, data: result });
res.status(400).json({ success: false, error: 'title is required' });
```

尽量使用早返回处理校验失败。

### 数据库查询

```typescript
const db = getDb();
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
return task || null;
```

动态 SQL 使用条件数组和值数组，始终使用 prepared statements，不拼接用户输入。

### 前端

- React 19 函数组件。
- 数据请求使用 TanStack Query。
- API client 集中在 `web/src/api.ts`。
- 页面组件在 `web/src/pages/`，通用组件在 `web/src/components/`。
- 样式使用 Tailwind CSS 4 和已有组件模式，新增 UI 前先复用现有组件。

## 环境变量

| 变量 | 用途 | 默认值 |
| --- | --- | --- |
| `API_PORT` | API/生产 Web 端口 | `17173` |
| `DB_PATH` | SQLite 数据库路径 | `./data/data.db` |
| `WEB_DIST_PATH` | 后端托管的前端构建目录 | `../../web/dist` 或 Docker 中 `/app/web/dist` |
| `FRONTEND_URL` | 仅 Vite 调试模式的 CORS origin | `http://localhost:5173` |
| `SESSION_SECRET` | Session 密钥 | `omt-session-secret-change-in-production` |
| `OMT_SERVER_URL` | MCP/API 服务地址 | `http://localhost:17173` |
| `OMT_TOKEN` | MCP Bearer Token | 空 |
| `OMT_PROJECT_NAME` | MCP 默认项目名 | 空 |

系统配置表还包含 SMTP、注册开关和 hCaptcha 配置，对应 Web 设置页与相关 API。

## 常见坑

1. 后端相对导入必须带 `.js` 后缀。
2. 根目录不存在 `npm test`、`npm run lint`、`npm run db:clean`。
3. 前端测试脚本未写入 `package.json`，需在 `web/` 下用 `npx vitest run`。
4. Web/API/MCP 的正式入口统一是 `17173`；`5173` 只是 Vite 热更新调试端口。
5. MCP 主认证变量是 `OMT_TOKEN`，不是旧的 `OMT_API_KEY`。
6. schema v2 已移除 SOP/assignee/阶段性文档旧模型。
7. `src/services/schedule.service.ts` 会调用外部节假日 API，外部失败时应允许回退默认工作日逻辑。
8. 修改版本号时检查 `package.json` 与 MCP server 硬编码版本是否一致。

## Windows / PowerShell 注意事项

- 当前环境是 Windows PowerShell 5.1，不支持 `&&` / `||`。
- PowerShell 内命令串联用 `;`，条件回退用 `$LASTEXITCODE`。
- 包含空格的路径必须加引号，例如 `"D:\1 git\oh-my-task"`。
- 优先使用绝对路径。
- 长时间运行的 dev server 不要直接用普通前台命令等待完成，必要时用 `Start-Process` 后台启动。

```powershell
Set-Location "D:\1 git\oh-my-task"; npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```
