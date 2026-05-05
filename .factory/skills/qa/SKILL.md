---
name: qa
description: >
  Run functional QA tests for oh-my-task. Analyzes git diff to determine affected areas,
  runs configured browser/API/MCP flows with admin and member personas, and writes a concise QA report.
  Use when testing PRs, releases, or smoke testing local environments.
---

# QA Orchestrator

SCOPE: This skill performs manual/functional QA only -- verifying that the application actually works by interacting with it as a real user would through a browser, HTTP API calls, or MCP stdio. Do NOT run or report on linting, typecheck, Vitest, or static analysis.

## Step 1: Load Configuration

Read `.factory/skills/qa/config.yaml` for environment URLs, credentials, personas, and app definitions.

## Step 2: Determine Target Environment

Use `default_target` unless the user specifies a different target. For this project, the default is local:

- Unified Web/API: `http://localhost:17173`

No Vercel/Netlify preview deployments were detected. For PR/branch testing, start one local unified server from the checked-out branch. Never fall back to a remote URL for PR verification because it may run different code.

## Step 2.1: Zero-start Unified Environment

QA must start from zero and must not reuse the developer database.

1. Generate `RUN_ID`.
2. Create an empty temp directory such as `./temp/qa-$RUN_ID/`.
3. Set `DB_PATH` to `./temp/qa-$RUN_ID/data.db`.
4. Build backend and frontend:
   - `npm run build`
   - `npm run build --prefix web`
5. Start exactly one HTTP server on port `17173`:
   - PowerShell: `$env:DB_PATH = '<repo>\\temp\\qa-$RUN_ID\\data.db'; $env:API_PORT = '17173'; $env:WEB_DIST_PATH = '<repo>\\web\\dist'; node dist/index.js`
   - Bash: `DB_PATH=\"$PWD/temp/qa-$RUN_ID/data.db\" API_PORT=17173 WEB_DIST_PATH=\"$PWD/web/dist\" node dist/index.js`
6. Browser, API, and MCP must all target `http://localhost:17173`.

This guarantees the first registered QA user becomes admin and the browser sees the same origin as the API. Do not use Vite port `5173` for functional QA.

## Step 3: Analyze Git Diff

Run `git diff` and map changed files to apps using `apps.*.path_patterns` in `config.yaml`.

- `web/**` -> `qa-web`
- `src/api/**`, `src/services/**`, `src/db/**` -> `qa-backend`
- `src/mcp/**` plus related service/API changes -> `qa-mcp`

Files that do not match any app, such as `.factory/skills/**`, docs, or CI-only changes, are not associated with app QA. If no app code changed, report INCONCLUSIVE: "No app code changed -- QA not applicable for this diff." Do not run app flows.

## Step 4: Pre-flight Checks

Run pre-flight checks only for affected apps:

1. Create `qa-results/$RUN_ID/`.
2. Start the zero-start unified environment from Step 2.1.
3. Poll `http://localhost:17173/api/health` until it returns success.
4. Poll `http://localhost:17173/login` until the page loads when web is affected.
5. If an affected app cannot start, report that app as BLOCKED and continue with other affected apps.

Setup commands are prerequisites, not QA test rows.

## Step 5: Execute Diff-Relevant Flows

For each affected app, read the matching sub-skill:

- `.factory/skills/qa-web/SKILL.md`
- `.factory/skills/qa-backend/SKILL.md`
- `.factory/skills/qa-mcp/SKILL.md`

Run only flows relevant to the diff plus adjacent integration flows. If no existing flow covers the change, create an ad-hoc functional test that directly verifies the changed behavior. Include at least one negative test around the changed behavior.

## Step 6: Evidence Capture

Use text evidence as the primary evidence.

For web flows, use agent-browser snapshots and save screenshots to `./qa-results/$RUN_ID/`. Reference screenshot filenames only; do not embed broken image links.

For API/MCP flows, save request/response summaries and MCP JSON-RPC transcripts as fenced text in the report evidence block.

Each evidence snapshot must show something different and relevant.

## Step 7: Test Quality Gate

1. Prioritize change-specific tests first.
2. Integration tests that verify changed code connects to adjacent flows are valid.
3. Do not run unrelated flows.
4. Do not run automated test suites.
5. Include at least one related negative test.
6. Interact with the app as a real user would.
7. If unsure what changed, mark INCONCLUSIVE instead of PASS.

## Step 8: Handle Failures

Never silently skip a flow. If a flow cannot complete, report it as BLOCKED with what was tried and how the user can fix it. Continue to the next flow.

## Step 9: Generate Report

Write `./qa-results/report.md` using `.factory/skills/qa/REPORT-TEMPLATE.md`.

Rules:

- Start with `## QA Report`.
- Use result values exactly: `:white_check_mark: PASS`, `:x: FAIL`, `:no_entry: BLOCKED`, `:warning: FLAKY`, `:grey_question: INCONCLUSIVE`.
- Keep it concise: table, short Action Required section if needed, one collapsed evidence block.
- Do not report startup/build/preflight as test rows.
- Put all evidence in the single collapsed evidence block.

## Step 10: Failure Learning

Read `failure_learning` from config. Current value: `suggest_in_report`.

If a BLOCKED or FAIL result reveals a new testing-environment insight, append a `## Suggested Skill Updates (N issues found)` section with copyable prompts. Do not suggest updates for bad selectors, skill bugs, or expected behavior changes.
