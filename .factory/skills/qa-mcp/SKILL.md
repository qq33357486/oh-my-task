---
name: qa-mcp
description: >
  Functional QA for the oh-my-task MCP server and tool workflows. Tests real MCP stdio tool calls
  plus API token setup against the local backend.
---

# qa-mcp

Use this skill for `src/mcp/**` changes and API/service changes that affect MCP behavior.

## Testing Target

MCP tools require a running backend and these environment variables:

- `OMT_SERVER_URL=http://localhost:17173`
- `OMT_TOKEN=<api token created during QA>`
- `OMT_PROJECT_NAME=qa-e2e-mcp-{RUN_ID}`

Start the zero-start unified server on `http://localhost:17173`, create/register a QA admin user through that server, create an API token via `/api/tokens`, then launch MCP with `npm run mcp` or `node dist/mcp/server.js` after build.

The MCP QA backend must use the same fresh temp `DB_PATH` as browser/API QA. Do not point MCP at a developer database or a second HTTP port.

## MCP Protocol Requirement

Prefer real MCP stdio JSON-RPC calls. If a helper client is not available, use a small Node script that:

1. Spawns `npm run mcp` with the environment above.
2. Sends `initialize` JSON-RPC.
3. Sends `tools/list`.
4. Sends `tools/call` for each relevant tool.
5. Captures stdout/stderr transcript as evidence.

Do not rely only on HTTP API simulation when the changed files are in `src/mcp/**`.

## Flow Menu

### MCP-STDIO-001: Server starts and lists tools

1. Launch MCP stdio server.
2. Send initialize request.
3. Send tools/list.
4. Verify tools include: `init_project`, `create_version`, `list_versions`, `create_task`, `list_tasks`, `get_task`, `get_current_task`, `activate_task`, `complete_task`, `delete_task`, `auto_schedule`.

### MCP-FLOW-001: Full project/version/task workflow

1. `init_project` with `OMT_PROJECT_NAME`.
2. `create_version` with name and due date.
3. `list_versions` and verify created version.
4. `create_task` for parent and child task.
5. `list_tasks` and `get_task`.
6. `activate_task` then `complete_task`.
7. `get_current_task` after completion.
8. `delete_task` for cleanup.

### MCP-SCHEDULE-001: Auto schedule via MCP

1. Create an active version and multiple tasks with estimated days.
2. Call `auto_schedule`.
3. Verify returned schedule and updated task dates.

### MCP-AUTH-001: Token validation boundaries

1. Launch MCP without `OMT_TOKEN` or with invalid token.
2. Call a protected tool and verify a clear auth failure.
3. Relaunch with valid token and verify success.

### MCP-ACTIVE-VERSION-001: Active version constraints

1. Initialize project without an active version.
2. Call task operation requiring active version.
3. Verify it fails with a clear active-version error.
4. Create/start version and retry successfully.

## Evidence

Save the MCP JSON-RPC transcript with request IDs, tool names, result summaries, and masked token values. Include stderr startup line `MCP Server started` if present.

## Known Failure Modes

1. The MCP server uses stdio; any normal logs on stdout can break JSON-RPC. Current startup log uses stderr, which is acceptable.
2. Missing `OMT_TOKEN` should block protected tool calls. Treat this as expected only for MCP-AUTH negative tests.
3. If backend is not reachable at `OMT_SERVER_URL`, all MCP tool calls are BLOCKED; verify `/api/health` first.
4. `OMT_PROJECT_NAME` must be set for project-oriented flows or passed through tool args when supported.
