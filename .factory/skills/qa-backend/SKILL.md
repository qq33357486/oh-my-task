---
name: qa-backend
description: >
  API-level functional QA for the oh-my-task Express backend. Tests auth, projects, versions,
  tasks, tokens, admin permissions, and scheduling through real HTTP calls.
---

# qa-backend

Use this skill for backend/API changes. Interact through HTTP requests, not unit tests.

## Testing Target

Default API URL: `http://localhost:17173`.

Start the backend from the checked-out branch as the same unified server used by browser QA, then poll `GET /api/health` until it returns `{ success: true }`.

Zero-start is mandatory:

1. Create a fresh temp DB path: `./temp/qa-{RUN_ID}/data.db`.
2. Build backend and frontend: `npm run build`; `npm run build --prefix web`.
3. Start one server on port `17173` with `DB_PATH`, `API_PORT=17173`, and `WEB_DIST_PATH=<repo>/web/dist`.
4. Browser and API must both use `http://localhost:17173`.

Do not use `npm run dev:all` or Vite port `5173` for functional QA.

## Authentication Method

The API supports:

- Session cookie via `/api/auth/register` and `/api/auth/login`.
- Bearer token via `/api/tokens` generated while authenticated.

## Flow Menu

### API-AUTH-001: Register, login, logout, and protected route

1. Start from a fresh temporary DB and login with the bootstrap admin credentials defined by `src/db/connection.ts`.
2. Call `/api/auth/me` with session cookie and verify user role is `admin`.
3. Logout and verify `/api/projects` returns 401 without auth.
4. Login again and verify protected routes work.
5. Negative: login with wrong password returns 401.

### API-TOKEN-001: Bearer token authentication

1. Create API token via `POST /api/tokens` with session cookie.
2. Call `GET /api/projects` with `Authorization: Bearer <token>`.
3. Negative: invalid token returns 401.
4. Delete the token and verify it no longer authenticates.

### API-PROJECT-001: Project CRUD

1. Create `qa-e2e-project-{RUN_ID}`.
2. List projects and verify it appears.
3. Get and update it.
4. Negative: missing name returns 400.
5. Delete it and verify it is gone.

### API-VERSION-001: Version lifecycle rules

1. Create project.
2. Create version with name and due date.
3. Start version.
4. Negative: create a second version while the first is active should fail.
5. Create task, complete task, complete version.
6. Archive or delete version and verify list behavior.

### API-TASK-001: Task CRUD and lifecycle

1. Create project and active version.
2. Create parent task and child task.
3. List tasks and get detail tree.
4. Activate task then complete task.
5. Negative: create fourth-level nested task should return 400.
6. Delete parent and verify soft-delete/cascade behavior.

### API-SCHEDULE-001: Auto schedule

1. Create multiple tasks with estimated days.
2. Call `/api/schedule/auto`.
3. Verify start/due dates are populated in task order.
4. Negative: invalid project/version identifiers return structured errors.

### API-ADMIN-001: Admin-only boundaries

1. As admin, call `/api/admin/stats`, `/api/users`, and `/api/config`.
2. As member, call the same endpoints.
3. Verify member receives 403.

## Evidence

Record concise request/response summaries, status codes, and response fields. Do not include passwords or full tokens in evidence; mask tokens after the first 8 characters.

## Known Failure Modes

1. If using the default `data/data.db`, the run is invalid because existing data changes bootstrap behavior. Always use a temporary `DB_PATH`.
2. Schedule endpoints may attempt to load holiday data from the network. If external holiday service is unavailable, report schedule flow as BLOCKED unless the changed code is unrelated.
3. Expected validation errors may be logged by Express global error handling; do not treat stderr logs as failures when HTTP status/body are correct.
