# oh-my-task

A lightweight task management system for individuals, small teams, and AI agents. Manage projects, versions, tasks, schedules, REST APIs, and MCP collaboration from one place.

**Public service**: [https://task.duojie.games](https://task.duojie.games)<br>
**Self-hosting**: start with one Docker command and keep your data in your own SQLite database.

![oh-my-task landing page](web/public/marketing/landing-page.png)

## Why oh-my-task

- **Built for real project delivery**: organize work by project, version, parent task, and subtask.
- **Clear version lifecycle**: create → start/lock → complete → archive.
- **Smart scheduling**: calculate task dates from estimated days while skipping weekends and Chinese public holidays.
- **AI-agent friendly**: REST API and MCP tools let assistants create, query, activate, and complete tasks.
- **Public service or self-hosted**: use `task.duojie.games` directly, or deploy to your own server.
- **Admin-ready**: Session login, Bearer Token access, user management, system configuration, and analytics dashboard.

## Use the Public Service

1. Open [task.duojie.games](https://task.duojie.games).
2. Register an account and create your first project.
3. Create versions and tasks, or create a Token in Settings and connect through MCP.

The public service is best for quick starts, personal projects, and lightweight team collaboration. If you need full data control, use the Docker self-hosting path below.

## Preview

![oh-my-task task workspace](web/public/marketing/app-overview.svg)

![oh-my-task MCP settings](web/public/marketing/mcp-settings.svg)

## Docker Self-hosting

Start with one command:

```bash
docker run -d --name oh-my-task \
  -p 17173:17173 \
  -v oh-my-task-data:/app/data \
  ghcr.io/qq33357486/oh-my-task:latest
```

Using `docker-compose.yml`:

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

Visit `http://localhost:17173` to open the Web UI. On an empty database, the first registered user automatically becomes the admin.

## Local Development

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Build backend and frontend
npm run build
cd web && npm run build && cd ..

# Start the unified service
WEB_DIST_PATH=web/dist API_PORT=17173 npm start
```

PowerShell:

```powershell
$env:WEB_DIST_PATH = "web/dist"; $env:API_PORT = "17173"; npm start
```

For development with hot reload:

```bash
npm run dev
cd web && npm run dev
```

The Vite port `http://localhost:5173` is only for frontend HMR. Production, Docker, and functional QA use the unified `17173` service.

## Configure MCP

Create a Token in the Web UI: top right → Settings → Create Token.

oh-my-task separates task spaces by **project name**, so project-level MCP config is recommended, such as `.cursor/mcp.json` or `.claude/mcp.json`.

```json
{
  "mcpServers": {
    "oh-my-task": {
      "command": "npx",
      "args": ["@qq33357486/oh-my-task"],
      "env": {
        "OMT_SERVER_URL": "https://task.duojie.games",
        "OMT_TOKEN": "your-token",
        "OMT_PROJECT_NAME": "current-project-name"
      }
    }
  }
}
```

For a local Docker service, set `OMT_SERVER_URL` to:

```text
http://localhost:17173
```

### MCP Tools

| Tool | Description |
| --- | --- |
| `init_project` | Initialize project |
| `create_task` | Create task |
| `list_tasks` | List tasks |
| `get_task` | Get task details |
| `activate_task` | Start a task |
| `complete_task` | Complete a task |
| `delete_task` | Delete a task |
| `create_version` | Create version |
| `list_versions` | List versions |
| `get_current_task` | Get current in-progress main task and subtasks |
| `auto_schedule` | Auto schedule tasks while skipping holidays |

## Usage Examples

Create a version:

```text
Create version v1.0: User System
```

Batch create tasks:

```text
Batch create tasks under v1.0:
- User Login
  - Login Form
  - Login API
- Product List
  - List Page
```

Move work forward:

```text
Start working on "User login feature"
"User login feature" is done
What am I working on now?
```

Auto schedule:

```text
Auto schedule tasks in v1.0, starting from next Monday
```

## Environment Variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `API_PORT` | Unified Web/API service port | `17173` |
| `DB_PATH` | SQLite database path | `./data/data.db` |
| `WEB_DIST_PATH` | Frontend build output directory | `web/dist` |
| `FRONTEND_URL` | CORS origin for Vite development | `http://localhost:5173` |
| `SESSION_SECRET` | Session secret | `omt-session-secret-change-in-production` |
| `OMT_SERVER_URL` | MCP/API service URL | `http://localhost:17173` |
| `OMT_TOKEN` | MCP Bearer Token | empty |
| `OMT_PROJECT_NAME` | Default MCP project name | empty |

## Stack

- Backend: Express.js + TypeScript + SQLite
- Frontend: React 19 + Vite + TanStack Query + Tailwind CSS 4
- AI collaboration: REST API + MCP stdio server
- Deployment: Docker / unified Node.js service

## Links

- Public service: [https://task.duojie.games](https://task.duojie.games)
- Chinese README: [README.md](README.md)
- GitHub: [https://github.com/qq33357486/oh-my-task](https://github.com/qq33357486/oh-my-task)
