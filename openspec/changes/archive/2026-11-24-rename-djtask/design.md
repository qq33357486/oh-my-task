# Design

## Context

品牌名是纯文本替换，但有三处牵连需要定：IndexedDB 库名、部署链路里的镜像名、specs 正文里的自称。

## Goals / Non-Goals

- Goal：用户看到的和代码里写的自称统一为 DJTASK／多杰任务系统，`openspec/specs/` 里指产品的旧称一并清。
- Non-Goal：不改仓库名、目录名、镜像名、容器；不做数据迁移。

## Decisions

1. **IndexedDB 库名保留 `oh-my-task-fs`**：改库名等于丢老用户已存的目录授权记录，收益只是代码好看。人类原话回答『库名保留 oh-my-task-fs（推荐）』（2026-11-24）。在 `fsAccess.ts` 库名旁留一句注释说明为什么不改。
2. **镜像名保留 `ghcr.io/qq33357486/oh-my-task`**：镜像名跟 GitHub 仓库名走，仓库名不改（人在范围问题里未选『连仓库一起改』）；改镜像名会牵动 Actions、服务器拉取脚本，纯风险无收益。README 里注明镜像名不改的原因。
3. **specs 里指产品的旧称一并改**（人定：『一并改（推荐）』）：delta 覆盖 task-system-sop 两条需求、framework-init 需求名「旧版 oh my task」→「旧版 DJ Task」、project-switching 旧版提示文案。真正指仓库的 `framework-bundle/spec.md:5,11` 不动。delivery 与 project-switching 的 Purpose 行不是需求，delta 带不动，归档并回时手动同步。排除两类历史名：归档任务夹名（如 redesign-oh-my-task）、ADR 文件名（0001/0002-oh-my-task-…）。
4. **显示名规则**（四细节经人类回答『全按建议定（推荐）』确认）：界面大标题写「DJ Task」，带蓝色渐变方块标记和副标题「多杰任务系统」（人否了全小写，原话『全小写不合理，也不好看。优化下。DJ Task 视觉上要好看点』，提交 22df138）；浏览器标签页标题 `DJ Task`；日志、包名用 `djtask`；中文文案里写「多杰任务系统」；旧版提示写「旧版 DJ Task」。
5. **`.omt/` 框架文本直接改源头**：manifest.ts 用 `?raw` 在构建时读入，改 `.omt/` 即随下次构建生效，无第二步。
6. **测试断言跟随文案改**：App.test / App.install.test / App.fix.test 里的旧版文案断言同步改，属于「文案改了测试跟着改」，不是为让测试过而改测试。

## Risks / Trade-offs

- [业务项目里已置入的旧框架文本仍是 oh my task 自称] → 框架文本由网页更新机制管理，下次更新即覆盖；不在本任务做迁移。
- [旧版提示改词后，用户手上旧构建仍显示旧文案] → 可接受，部署后自然收敛。
- [specs 的 Purpose 行（delivery、project-switching）delta 机制带不动] → 在 tasks.md 归档 follow-up 里写明手动同步，防止漏。

## Migration Plan

一次提交内改完代码+框架文本；`npm test`、`typecheck`、`build` 全绿后按现有流程部署（推送前问人）。

## Open Questions

无。
