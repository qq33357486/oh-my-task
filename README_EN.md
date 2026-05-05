# oh-my-task

AI-driven task management with version lifecycle, smart scheduling, and MCP integration.

## Features

- **Version Management** — Create → Start/Lock → Complete → Archive, a clear lifecycle
- **Smart Scheduling** — Automatically skips weekends and Chinese public holidays
- **MCP Integration** — 11 tools for AI assistants to manage tasks directly
- **Admin Dashboard** — Statistics panel, user management, system configuration
- **Permission System** — First registered user becomes admin automatically, Session + Bearer Token dual authentication
- **Docker Deployment** — Zero-config one-click startup

## Quick Start

### Docker (Recommended)

**One-click start**:

```bash
docker run -d --name oh-my-task \
  -p 17173:17173 \
  -v oh-my-task-data:/app/data \
  ghcr.io/qq33357486/oh-my-task:latest
```

**Using docker-compose**:

```yaml
services:
  oh-my-task:
    image: ghcr.io/qq33357486/oh-my-task:latest
    container_name: oh-my-task
    ports:
      - "17173:17173"
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

For Docker deployment, visit http://localhost:17173 to open the Web UI. The first registered user automatically becomes the admin.

### Local Development

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Start backend + frontend
npm run dev:all
```

| Service | Address |
|---------|---------|
| Backend API | http://localhost:17173 |
| Frontend UI (local dev) | http://localhost:5173 |

## Configure MCP

**Get Token**: Web interface → Top right → Settings → Create Token

**Configure Claude Desktop**:

```json
{
  "mcpServers": {
    "oh-my-task": {
      "command": "npx",
      "args": ["@qq33357486/oh-my-task"],
      "env": {
        "OMT_SERVER_URL": "http://localhost:17173",
        "OMT_TOKEN": "your-token",
        "OMT_PROJECT_NAME": "project-name"
      }
    }
  }
}
```

### MCP Tool List

| Tool | Description |
|------|-------------|
| `init_project` | Initialize project |
| `create_task` | Create task |
| `list_tasks` | List tasks |
| `get_task` | Get task details |
| `activate_task` | Start task (status → in progress) |
| `complete_task` | Complete task (status → done) |
| `delete_task` | Delete task |
| `create_version` | Create version |
| `list_versions` | List versions |
| `auto_schedule` | Auto schedule (skip holidays) |

## Usage Scenarios

### 1. Create Version

```
Create version v1.0: User System
```

### 2. Create Task

```
Create task under v1.0: User login feature
```

### 3. Batch Create

```
Batch create tasks under v1.0:
- User Login
  - Login Form
  - Login API
- Product List
  - List Page
```

### 4. Start Task

```
Start working on "User login feature"
```

Task status changes to in progress.

### 5. Complete Task

```
"User login feature" is done
```

### 6. Version Lifecycle

```
Start version v1.0    → Lock version, no more tasks can be added
Complete version v1.0 → All tasks completed
Archive version v1.0  → Move to archive
```

### 7. Auto Scheduling

```
Auto schedule tasks in v1.0, starting from next Monday
```

Automatically skips weekends and Chinese public holidays.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PATH` | SQLite database path | `./data/data.db` |
| `OMT_SERVER_URL` | API address (for MCP) | `http://localhost:17173` |
| `OMT_API_KEY` | API authentication key | `omt-admin-key` |

## More

- [Chinese Version](README.md)
- [GitHub](https://github.com/qq33357486/oh-my-task)
