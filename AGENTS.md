开始任何工作前，先读 `.omt/AGENTS.md`（任务系统在本项目的说明）。

# 本仓库的项目规则

1. 代码在 `app/`。在 `app/` 下跑 `npm run dev`、`npm test`、`npm run typecheck`、`npm run build`。
2. 提交自动做，不用问。推送到 GitHub、在服务器上换容器，先问人。
3. 本仓库的任务夹暂在 `D:\git\new_task\openspec\`（工程 1）。任务系统按本仓库的 `.omt/` 走。
4. 框架文件（`.omt/AGENTS.md`、`.omt/工作流/默认工作流.md`、`.agents/skills/` 下的三个拷问技能）在业务项目里只读。本仓库是它们的源头：要改，走任务流程，由维护者改。
5. 读写真实目录的行为，单测覆盖不到 Chromium 的限制。这类行为要人在真实浏览器里点过才算数。
