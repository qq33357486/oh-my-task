# Tasks

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。在 `app/` 下跑命令。本地提交自动做；推送和换容器先问人。和 `openspec/changes/entry-page-and-guide/` 一起发布。

这个任务没有对应的业务工作流，照默认工作流走。改前改后的整行见 design.md「文字定稿」。

## 1. 改文字

- [ ] 1.1 改 `.omt/AGENTS.md` 里「要拷问时」那一条，换成 design.md「文字定稿」里的那句。验证：读这一条，一个没有斜杠命令的 AI 知道该去读哪三个文件、读完还要读什么、拷问要留哪三样痕迹。
- [ ] 1.2 改 `.omt/工作流/默认工作流.md` 第 30 行的开头，从「另外要问出人想要什么」起的后半句不动。验证：读这一步，知道人要求了才开始、说法不限、没要求时怎么办、只按什么做、三样痕迹是什么。记下改前改后的字数（`wc -m .omt/工作流/默认工作流.md`）。
- [ ] 1.3 改默认工作流第 32 行里的一处和第 34 行，照 design.md「文字定稿」。验证：读独立审查那一步和分流表，知道拷问留的三样痕迹在审查范围内、拷问没留痕算 AI 错误。
- [ ] 1.4 改 `.agents/skills/grilling/SKILL.md` 两处，照 design.md「文字定稿」。验证：`git diff` 里这份文件只多了两处；说明头仍是三道线包着、能被解析；框架名单的测试过。
- [ ] 1.5 写 `app/src/framework/grillTrigger.test.ts`，读仓库的真实文件：`.omt/AGENTS.md` 里有三份技能文件的完整路径和「不单独用 grilling」；默认工作流里有「说法不限」「只按 grill-with-docs 做」「拷问记录」，找不到「由人启动 grill-with-docs」，分流表「AI 错误」那一行里有「拷问没留痕」；grilling 的说明里有 `disable-model-invocation: true`，正文第一句写着只经 grill-with-docs 用。验证：临时删掉其中任何一处，测试会红，再恢复；逐处撤。
- [ ] 1.6 核对 grill-with-docs 和 domain-modeling 没被动过。验证：`git status --short` 和 `git diff --stat` 里没有这两份文件。
- [ ] 1.7 `npm test`、`npm run typecheck`、`npm run build`、`npm run check:bundle` 都过（grilling 的说明是内置的，内容变了要确认生产包里是新的）。
- [ ] 1.8 提交第 1 组。

## 2. 固定新东西

- [ ] 2.1 固定新东西并填核对单（对照 proposal.md 末尾核对单逐项确认）。知识库「拷问技能的来源」里把 grilling 一行改成有本地改动，写明是哪两处、更新时怎么合并。

## Workflow follow-up

- 独立验收（新开的 AI，对照任务夹和项目规则核）。其中三条由新开的 AI 照场景里的条件跑：「换个说法也能启动」「人没要求时不动」「没有斜杠命令的 AI 也能开始拷问」。做法：新开一个 AI，不用 Skill 工具、不用斜杠命令、没有技能列表，只给根 `AGENTS.md` 的路径，按场景里的话对它说。每条跑两遍，交回的原文一字不改地留在本任务夹里；记录不用以「- [」或「数字. [」开头的行，免得被数成待办。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径。
- 人类验收：由人确认默认工作流的改动。
- 和 `entry-page-and-guide` 一起：先问人，再推送；服务器换容器（先问人）；各业务项目点一次「有更新」。
- 以上做完后，用 OpenSpec 归档本任务夹；归档后把并进 `openspec/specs/` 的出处行去掉。
