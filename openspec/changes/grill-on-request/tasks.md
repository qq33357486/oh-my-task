# Tasks

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。在 `app/` 下跑命令。本地提交自动做；推送和换容器先问人。和 `openspec/changes/entry-page-and-guide/` 一起发布。

这个任务没有对应的业务工作流，照默认工作流走。改前改后的整行见 design.md「文字定稿」。

## 1. 改两处文字

- [ ] 1.1 改 `.omt/AGENTS.md` 里「要拷问时」那一条，换成 design.md「文字定稿」里的那句。验证：读这一条，一个没有斜杠命令的 AI 知道该去读哪个文件、读完还要读什么。
- [ ] 1.2 改 `.omt/工作流/默认工作流.md` 里「拷问」那一步的开头，从「另外要问出人想要什么」起的后半句不动。验证：读这一步，知道人说了什么才开始、两种说法都算、没说时怎么办、去读哪个文件。记下改前改后的字数（`wc -m .omt/工作流/默认工作流.md`）。
- [ ] 1.3 写 `app/src/framework/grillTrigger.test.ts`，读仓库的真实文件：两份文件里有触发语和完整路径 `.agents/skills/grill-with-docs/SKILL.md`；找不到「由人启动 grill-with-docs」。验证：临时把路径删掉，测试会红，再恢复。
- [ ] 1.4 核对三份技能文件没被动过。验证：`git status --short` 和 `git diff --stat` 里没有 `.agents/skills/` 下的文件。
- [ ] 1.5 框架名单的测试、`npm run build` 后的 `npm run check:bundle`、`npm test`、`npm run typecheck` 都过。
- [ ] 1.6 提交第 1 组。

## 2. 固定新东西

- [ ] 2.1 固定新东西并填核对单（对照 proposal.md 末尾核对单逐项确认）

## Workflow follow-up

- 独立验收（新开的 AI，对照任务夹和项目规则核）。其中「没有斜杠命令的 AI 也能开始拷问」照场景里的条件跑：新开一个 AI，不用 Skill 工具、不用斜杠命令、没有技能列表，只给根 `AGENTS.md` 的路径，对它说「我想做某件事。请拷问我。」。跑两遍，交回的原文一字不改地留在本任务夹里；记录不用以「- [」或「数字. [」开头的行，免得被数成待办。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径。
- 人类验收：由人确认默认工作流的改动。
- 和 `entry-page-and-guide` 一起：先问人，再推送；服务器换容器（先问人）；各业务项目点一次「有更新」。
- 以上做完后，用 OpenSpec 归档本任务夹；归档后把并进 `openspec/specs/` 的出处行去掉。
