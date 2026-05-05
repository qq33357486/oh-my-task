---
name: qa-web
description: >
  Browser-based functional QA for the oh-my-task React web app. Tests auth, project/version/task workflows,
  settings, admin pages, and permission boundaries with agent-browser.
---

# qa-web

Use this skill for browser QA of `web/` changes and UI-facing API changes.

## Testing Target

No preview deployments were detected. Test branch code by running a single local unified server from zero:

1. Create a fresh temp DB path: `./temp/qa-{RUN_ID}/data.db`.
2. Build backend and frontend: `npm run build`; `npm run build --prefix web`.
3. Start one server on port `17173` with `DB_PATH`, `API_PORT=17173`, and `WEB_DIST_PATH=<repo>/web/dist`.
4. Use `http://localhost:17173` as the only base URL for browser and API calls.
5. Poll `http://localhost:17173/api/health` and `http://localhost:17173/login` before testing.

Never use Vite port `5173` for functional QA. Never fall back to a remote environment when testing a PR branch.

## Authentication Method

The app uses custom email/password auth with `omt_session_id` session cookie. In zero-start local QA, `initDb()` creates a bootstrap admin account when the temporary database is empty. Read the bootstrap credentials from `src/db/connection.ts` at runtime; do not use a developer database.

Suggested generated credentials per run:

- Admin: bootstrap admin from the fresh DB initialization path.
- Member: `qa-member-{RUN_ID}@example.test` / generated strong password

QA must always use an empty temporary `DB_PATH`, so do not use existing admin credentials or the developer database.

## Flow Menu

The orchestrator chooses relevant flows from this menu.

### WEB-AUTH-001: Zero-start bootstrap admin login

1. Start from a fresh temporary DB and open `/login`.
2. Login with the bootstrap admin credentials defined by the current source.
3. Verify the protected app shell appears.
4. Log out and log back in from `/login`.
5. Negative: login with an incorrect password and verify an error is shown.

Success criteria: the admin can authenticate and see the task workspace; invalid credentials are rejected.

### WEB-AUTH-002: Protected route behavior

1. Clear cookies or open a fresh context.
2. Visit `/`, `/settings`, `/members`, `/dashboard`, and `/config`.
3. Verify unauthenticated users are redirected to `/login`.

Success criteria: protected pages cannot be accessed anonymously.

### WEB-TASK-001: Project and version lifecycle

1. Create project named `qa-e2e-project-{RUN_ID}`.
2. Create version `qa-e2e-v1` with a deadline.
3. Start the version.
4. Verify version statistics card updates and version state controls change.
5. Negative: attempt to complete the version with no completed tasks or unfinished tasks and verify a validation error.

Success criteria: project/version CRUD works and lifecycle rules are enforced.

### WEB-TASK-002: Task lifecycle in tree, kanban, and flow views

1. Create a task named `qa-e2e-task-{RUN_ID}`.
2. Verify it appears in tree view.
3. Switch to kanban and verify it appears in the planned column.
4. Move or update status to in progress/done if UI controls support it.
5. Switch to flow view and verify the task is represented.
6. Delete the task and confirm the confirmation dialog.

Success criteria: task appears consistently across views and deletion requires confirmation.

### WEB-TASK-003: Version completion happy path

1. Create/start a version.
2. Create at least one task.
3. Complete the task.
4. Complete the version.
5. Verify completed state and statistics.

Success criteria: a version with all tasks done can be completed.

### WEB-SETTINGS-001: Token and MCP configuration

1. Open `/settings`.
2. Create a Token named `qa-e2e-token-{RUN_ID}`.
3. Verify the plaintext token is shown once.
4. Verify MCP config contains `OMT_SERVER_URL`, `OMT_TOKEN`, and `OMT_PROJECT_NAME`.
5. Copy config if clipboard is available.
6. Delete the token.

Success criteria: users can create a token and obtain usable MCP configuration.

### WEB-ADMIN-001: Admin pages and member management

Run as admin.

1. Open `/members`, `/dashboard`, and `/config`.
2. Verify pages render.
3. Toggle or edit a safe config field only if running on a disposable DB.
4. Verify SMTP/hCaptcha/server config sections are visible.

Success criteria: admin-only pages are accessible and render expected controls.

### WEB-PERM-001: Member cannot access admin pages

Run as member.

1. Login as member.
2. Attempt `/members`, `/dashboard`, and `/config`.
3. Verify admin navigation is absent and direct access does not expose admin controls.

Success criteria: member cannot perform admin-only operations.

### WEB-SEC-001: XSS rendering check

1. Create a task with title `<script>alert("qa")</script>`.
2. Verify the literal text is displayed and no alert executes.

Success criteria: user-provided task titles are escaped.

## Evidence

Capture agent-browser accessibility snapshots after each major step and save screenshots under `qa-results/$RUN_ID/`.

## Known Failure Modes

1. If registration is disabled and users already exist, the QA run is not truly zero-start. Stop the server, delete `./temp/qa-{RUN_ID}`, restart with a fresh `DB_PATH`, and retry.
2. The registration UI may use a two-step send-code form. In local non-production mode, completion can proceed without a real email code unless the UI requires entry.
3. DnD components may emit DOM nesting warnings around tables; report only if user-visible behavior fails.
4. Clipboard APIs may be unavailable in headless browsers. If copying fails but config text is visible, mark clipboard-specific assertion BLOCKED rather than failing the whole token flow.
