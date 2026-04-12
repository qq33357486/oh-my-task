# AGENTS.md - AI Coding Agent Guidelines

This document provides guidelines for AI coding agents working in the oh-my-task repository.

## 规则
- 中文回复

## Project Overview

oh-my-task is a document-driven AI programming collaboration system that manages tasks via MCP tools. It consists of:
- **Backend**: Express.js REST API + MCP Server (TypeScript)
- **Frontend**: React + Vite + TanStack Query (TypeScript)
- **Database**: SQLite with better-sqlite3

## Project Structure

```
oh-my-task/
├── src/                    # Backend source code
│   ├── api/                # REST API (Express routes)
│   │   ├── routes/         # Route handlers (tasks, projects, users, schedule)
│   │   └── middleware/     # Auth middleware
│   ├── mcp/                # MCP Server and tools
│   │   ├── server.ts       # MCP server entry
│   │   └── tools/          # Individual MCP tool handlers
│   ├── services/           # Business logic layer
│   ├── db/                 # Database connection and schema
│   └── types/              # TypeScript type definitions
├── web/                    # Frontend source code (React)
│   └── src/
│       ├── pages/          # Page components
│       ├── api.ts          # API client
│       └── App.tsx         # Root component
├── data/                   # SQLite database files
└── scripts/                # Utility scripts
```

## Quick Start (启动项目)

```powershell
# 1. 启动后端服务 (后台运行)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"D:\06 Trade Git\oh-my-task`" && npm run dev" -WindowStyle Hidden

# 2. 启动前端服务 (后台运行)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"D:\06 Trade Git\oh-my-task\web`" && npm run dev" -WindowStyle Hidden

# 3. 验证服务是否启动成功 (返回 200 表示成功)
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing | Select-Object StatusCode

# 停止服务
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:3000 |
| 前端界面 | http://localhost:5173 |

---

## Build/Lint/Test Commands

### Backend (Root)

```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run MCP server standalone
npm run mcp

# Database commands
npm run db:init          # Initialize/reset database
npm run db:clean         # Clean corrupted data
```

### Frontend (web/)

```bash
cd web

# Install dependencies
npm install

# Development server (port 5173)
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

### Full Stack Development

```bash
# Start both backend and frontend (recommended)
npm run dev:all
```

### Docker

```bash
docker-compose up -d     # Start all services
```

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict mode**: Enabled
- Backend outputs to `dist/`, frontend uses Vite (no emit)

### Import Style

**Backend imports** - Use `.js` extension for local imports:
```typescript
// Correct
import { getDb } from '../db/connection.js';
import type { Task, TaskStatus } from '../../types/index.js';
import * as taskService from '../../services/task.service.js';

// Wrong - missing .js extension
import { getDb } from '../db/connection';
```

**Frontend imports** - No extension needed:
```typescript
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { Task, Project } from '../api'
```

**Import order**:
1. Node.js built-ins (`fs`, `path`, `url`)
2. External packages (`express`, `react`, `uuid`)
3. Internal modules (relative imports)
4. Type-only imports (use `import type`)

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (backend) | kebab-case | `task.service.ts`, `init-project.ts` |
| Files (frontend) | PascalCase for components | `TasksPage.tsx`, `App.tsx` |
| Interfaces/Types | PascalCase | `Task`, `CreateTaskParams`, `ApiResponse` |
| Type aliases | PascalCase | `TaskStatus`, `UserRole` |
| Functions | camelCase | `listTasks`, `getTaskById` |
| Variables | camelCase | `projectPath`, `sortOrder` |
| Constants | UPPER_SNAKE_CASE or camelCase | `DB_PATH`, `STATUS_CONFIG` |
| Database columns | snake_case | `project_id`, `created_at` |

### Type Definitions

Define types in `src/types/index.ts`. Use explicit types:

```typescript
// Type aliases for constrained strings
export type TaskStatus = 'planned' | 'in_progress' | 'done';
export type UserRole = 'admin' | 'member';

// SOP（技能/智能体）
export interface SOP {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  rules: string;        // 规则
  workflow: string;     // 流程
  required: string;     // 强制要求
  forbidden: string;    // 禁止事项
  experience: string;   // 经验
  created_at: string;
  updated_at: string;
}

// Interfaces for data structures
export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  status: TaskStatus;
  sop_id: string | null;  // 关联的 SOP
  deleted_at: string | null;  // 软删除标记
  // ... use explicit types, avoid `any`
}

// Parameter interfaces for functions
export interface CreateTaskParams {
  project_id: string;
  title: string;
  description?: string;  // Optional with ?
}
```

### Error Handling

**API Routes** - Return structured JSON responses:
```typescript
// Success
res.json({ success: true, data: result });

// Error with status code
res.status(404).json({ success: false, error: 'Task not found' });
res.status(400).json({ success: false, error: 'title is required' });

// Early return pattern for validation
if (!title) {
  res.status(400).json({ success: false, error: 'title is required' });
  return;
}
```

**MCP Tools** - Throw errors with descriptive messages:
```typescript
if (!existsSync(configPath)) {
  throw new Error('Project not initialized. Please run init_project first');
}

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Failed to create task');
}
```

### Function Documentation

Use JSDoc comments for exported functions:
```typescript
/**
 * Get task list with optional filters
 */
export function listTasks(params: ListTasksParams): Task[] {
  // ...
}
```

### React Components

**Functional components with TypeScript**:
```typescript
// Props interface when needed
function TaskTreeItem({ task }: { task: Task }) {
  // ...
}

// Default export for page components
export default function TasksPage() {
  // ...
}
```

**Hooks usage**:
```typescript
const [view, setView] = useState<ViewType>('tree')
const { data: tasks, isLoading, error } = useQuery({
  queryKey: ['tasks', selectedProject],
  queryFn: () => api.getTasks(params),
})
```

### Database Patterns

**Use prepared statements**:
```typescript
const db = getDb();
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
return task || null;
```

**Dynamic query building**:
```typescript
const conditions: string[] = [];
const values: unknown[] = [];

if (params.project_id) {
  conditions.push('project_id = ?');
  values.push(params.project_id);
}

const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
const sql = `SELECT * FROM tasks ${whereClause} ORDER BY sort_order ASC`;
return db.prepare(sql).all(...values) as Task[];
```

### MCP Tool Structure

Each tool has two parts in `src/mcp/tools/`:
1. Tool definition with JSON schema
2. Handler function

```typescript
export const createTaskTool: Tool = {
  name: 'create_task',
  description: 'Create a task or subtask',
  inputSchema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['title'],
  },
};

export async function handleCreateTask(
  args: Record<string, unknown>,
  context: McpContext
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Implementation
}
```

## ESLint Configuration

Frontend uses flat config (`web/eslint.config.js`):
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `eslint-plugin-react-hooks` recommended
- `eslint-plugin-react-refresh` for Vite

## Key Patterns

### API Response Format
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

### Service Layer Pattern
Services in `src/services/` handle business logic, routes in `src/api/routes/` handle HTTP.

### UUID Generation
Use `uuid` package for IDs:
```typescript
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();
```

### Date Handling
Use ISO strings for dates:
```typescript
const now = new Date().toISOString();
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | SQLite database path | `./data/data.db` |
| `OMT_SERVER_URL` | API server URL (MCP) | `http://localhost:3000` |
| `OMT_API_KEY` | API authentication key | `omt-admin-key` |

## Common Gotchas

1. **Backend imports require `.js` extension** even for `.ts` files
2. **Database uses SQLite** - no async/await needed for queries
3. **Frontend uses React 19** with new patterns
4. **MCP tools read `.omt.json`** from project directory for config
5. **Auth middleware** adds `req.auth.user` to authenticated requests

## Windows Environment Notes

When running on Windows (PowerShell), be aware of the following:

### Shell Command Syntax Differences

| Bash/Unix | PowerShell | Notes |
|-----------|------------|-------|
| `cmd1 && cmd2` | `cmd1; cmd2` | Chain commands with `;` not `&&` |
| `sleep 5` | `Start-Sleep -Seconds 5` | Use PowerShell cmdlet |
| `cat file` | `Get-Content file` | Use `Get-Content` or `type` |
| `ls` | `Get-ChildItem` or `dir` | Use PowerShell cmdlets |
| `timeout 5` | `Start-Sleep -Seconds 5` | `timeout` has different syntax |

### Common Pitfalls

1. **`&&` operator fails in PowerShell** - Use `;` to chain commands or run them separately
2. **Temp file paths may not exist immediately** - When using `fireAndForget`, the output file may take time to be created
3. **Character encoding issues** - Error messages may show garbled text due to encoding differences
4. **Path separators** - Use `\` or `/` (PowerShell accepts both), but prefer absolute paths

### Recommended Practices

```powershell
# ✅ Correct - Use semicolon to chain commands
Start-Sleep -Seconds 5; Get-Content "file.txt"

# ❌ Wrong - && doesn't work in PowerShell
timeout /t 5 && type "file.txt"

# ✅ Correct - Check process status
Get-Process -Name node -ErrorAction SilentlyContinue

# ✅ Correct - Use absolute paths
cd "D:\06 Trade Git\oh-my-task"; npm run dev:all
```

### Starting Background Services

The `fireAndForget` option may fail on Windows. Use `Start-Process` with `cmd.exe` instead:

```powershell
# ✅ Correct - Start backend service in background
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"D:\06 Trade Git\oh-my-task`" && npm run dev" -WindowStyle Hidden

# ✅ Correct - Start frontend service in background  
Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d `"D:\06 Trade Git\oh-my-task\web`" && npm run dev" -WindowStyle Hidden

# ✅ Verify service is running
Start-Sleep -Seconds 5
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing | Select-Object StatusCode
```

**Note**: When starting long-running dev servers, avoid using the Execute tool directly as it will timeout. Use `Start-Process` to run them in the background.
