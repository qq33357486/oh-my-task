# oh-my-task

AI 驱动的任务管理，支持版本生命周期、智能排期、MCP 集成。

## 功能特性

- **版本管理** — 创建 → 启动/锁定 → 完成 → 归档，清晰的生命周期
- **智能排期** — 自动跳过周末和中国法定节假日
- **MCP 集成** — 11 个工具，AI 助手直接管理任务
- **管理后台** — 统计面板、用户管理、系统配置
- **权限体系** — 首位用户自动成为管理员，Session + Bearer Token 双认证
- **Docker 部署** — 零配置一键启动

## 快速开始

### Docker（推荐）

**一键启动**：

```bash
docker run -d --name oh-my-task \
  -p 3000:3000 \
  -v oh-my-task-data:/app/data \
  ghcr.io/qq33357486/oh-my-task:latest
```

**使用 docker-compose**：

```yaml
services:
  oh-my-task:
    image: ghcr.io/qq33357486/oh-my-task:latest
    container_name: oh-my-task
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/data.db
    restart: unless-stopped
```

```bash
docker compose up -d
```

访问 http://localhost:3000，首位注册用户自动成为管理员。

### 本地开发

```bash
# 安装依赖
npm install
cd web && npm install && cd ..

# 启动后端 + 前端
npm run dev:all
```

| 服务 | 地址 |
|------|------|
| 后端 API | http://localhost:3000 |
| 前端界面 | http://localhost:5173 |

## 配置 MCP

**获取 Token**：Web 界面 → 右上角 → 设置 → 创建 Token

oh-my-task 通过**项目名称**来区分不同项目，建议将 MCP 配置在**项目级**（如 `.cursor/mcp.json`、`.claude/mcp.json`），而非全局配置。这样每个项目使用各自的项目名，AI 工具自动定位到正确的任务空间。

**项目级配置（推荐）**：

在项目根目录创建 `.cursor/mcp.json` 或 `.claude/mcp.json`：

```json
{
  "mcpServers": {
    "oh-my-task": {
      "command": "npx",
      "args": ["@qq33357486/oh-my-task"],
      "env": {
        "OMT_SERVER_URL": "http://localhost:3000",
        "OMT_TOKEN": "你的Token",
        "OMT_PROJECT_NAME": "当前项目名称"
      }
    }
  }
}
```

**全局配置**（所有项目共用同一任务空间，不推荐）：

```json
{
  "mcpServers": {
    "oh-my-task": {
      "command": "npx",
      "args": ["@qq33357486/oh-my-task"],
      "env": {
        "OMT_SERVER_URL": "http://localhost:3000",
        "OMT_TOKEN": "你的Token",
        "OMT_PROJECT_NAME": "项目名称"
      }
    }
  }
}
```

### MCP 工具列表

| 工具 | 说明 |
|------|------|
| `init_project` | 初始化项目 |
| `create_task` | 创建任务 |
| `list_tasks` | 列出任务 |
| `get_task` | 获取任务详情 |
| `activate_task` | 开始任务（状态 → 进行中） |
| `complete_task` | 完成任务（状态 → 已完成） |
| `delete_task` | 删除任务 |
| `create_version` | 创建版本 |
| `list_versions` | 列出版本 |
| `get_current_task` | 获取当前进行中的主任务及子任务 |
| `auto_schedule` | 自动排期（跳过节假日） |

## 使用场景

### 1. 创建版本

```
创建版本 v1.0：用户系统
```

### 2. 创建任务

```
在 v1.0 下创建任务：用户登录功能
```

### 3. 批量创建

```
在 v1.0 下批量创建任务：
- 用户登录
  - 登录表单
  - 登录 API
- 商品列表
  - 列表页面
```

### 4. 开始任务

```
开始做「用户登录功能」
```

任务状态变为进行中。

### 5. 完成任务

```
「用户登录功能」做完了
```

### 6. 版本生命周期

```
启动版本 v1.0    → 锁定版本，不能再添加任务
完成版本 v1.0    → 所有任务完成
归档版本 v1.0    → 移入归档
```

### 7. 查看当前任务

```
当前在做什么？
```

返回当前项目正在进行的主任务及其子任务列表。

### 8. 自动排期

```
给 v1.0 的任务自动排期，从下周一开始
```

自动跳过周末和中国法定节假日。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DB_PATH` | SQLite 数据库路径 | `./data/data.db` |
| `OMT_SERVER_URL` | API 地址（MCP 用） | `http://localhost:3000` |
| `OMT_API_KEY` | API 认证密钥 | `omt-admin-key` |

## 更多

- [英文版](README_EN.md)
- [GitHub](https://github.com/qq33357486/oh-my-task)
