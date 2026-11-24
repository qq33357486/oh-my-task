# Proposal

## Why

> 出处：人类的原话『给这个项目起个名字，叫多杰任务系统。 DJTASK』

项目定名「多杰任务系统」，英文 DJTASK。现在代码、界面和文档里的自称还是 oh my task，需要对齐。

## 关键验收用例

人类确认过（2026-11-24 对话确认）：

| 用例 | 内容 | 出处 | 标签 |
|---|---|---|---|
| ①界面品牌 | 网页标题、引导页大标题、菜单栏显示 DJ Task；中文文案处用「多杰任务系统」（由 3.1/3.2 验）；旧版提示写「这个目录装的是旧版 DJ Task」 | 人类原话『全小写不合理，也不好看。优化下。DJ Task 视觉上要好看点』＋人类原话『叫多杰任务系统。 DJTASK』＋人类回答『全按建议定（推荐）』 | [关键] |
| ②包名 | `app/package.json` name 为 `djtask-app` | 人类回答『全按建议定（推荐）』 | [关键] |
| ③文本自称 | README 和 `.omt/` 框架文本的产品自称改为 DJTASK／多杰任务系统 | 人类回答『品牌+代码全改（推荐）』 | [关键] |
| ④质量闸 | `npm test`、`npm run typecheck`、`npm run build` 全过 | 人类回答『确认以上五条（推荐）』 | [关键] |
| ⑤旧数据不动 | IndexedDB 库名仍为 `oh-my-task-fs` | 人类原话回答『库名保留 oh-my-task-fs（推荐）』 | [关键] |

留给人亲手验：①的目检部分（标题/引导页/旧版提示的实际显示）。为什么转不了：Chromium 对目录授权和文件读写的限制单测覆盖不到（项目规则第 5 条），h1/标题文本也无现成断言。

不在范围（人已定）：GitHub 仓库名、本地目录名、镜像名 `ghcr.io/qq33357486/oh-my-task`（人类回答『品牌+代码全改』未含仓库层）、openspec 归档任务夹。

## What Changes

- 网页品牌改（用例①）：`app/index.html` 标题、`EntryPage.tsx` 大标题、`Header.tsx`；旧版提示文案改（`install.ts`、`pages.tsx` 及三个测试文件的断言）。
- 包名 `oh-my-task-app` → `djtask-app`（用例②），`package-lock.json` 随 `npm install` 刷新。
- 日志前缀 `[oh-my-task]` → `[djtask]`（`store.ts`、`errors.ts`），代码注释自称改（`agentsMd.ts`）——出处：人类回答『全按建议定（推荐）』。
- README、`.omt/` 框架文本（AGENTS.md、工作流、术语表、ADR 正文、知识库）的产品自称改（用例③）。排除：归档任务夹名（如 redesign-oh-my-task）、ADR 文件名、指仓库的「oh-my-task 仓库」。
- `openspec/specs/` 里指产品（非仓库）的旧称一并改（人定：『一并改（推荐）』）：delta 改 task-system-sop 两条需求、framework-init 的「旧版 oh my task」需求名；delivery 与 project-switching 的 Purpose 行归档并回时同步。
- 术语登记 DJTASK／多杰任务系统；写改名定案 ADR（库名/镜像名/仓库名不改）。
- **不改**：IndexedDB 库名 `oh-my-task-fs`（用例⑤）；归档任务夹；仓库名/目录名/镜像名。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `project-switching`: 旧版目录提示文案改为「这个目录装的是旧版 DJ Task」，需求原文里的文案同步更新。
- `task-system-sop`: 两条需求里的产品自称（向 oh my task 提需求／由 oh my task 的初始化置入）改为 DJTASK。
- `framework-init`: 需求「旧版 oh my task」改名「旧版 DJ Task」（行为不变）。

## Impact

- `app/`：index.html、package.json、package-lock.json、src 下约 8 个源文件及其测试。
- `.omt/`：框架文本自称，随框架包进入业务项目（网页置入的文件内容会变；已置入的旧项目等下次更新覆盖）。
- README.md、`openspec/specs/`（project-switching、task-system-sop、framework-init 归档并回时更新）。
- 不影响部署：镜像名、容器、GitHub Actions 均不动。

回做次数：3

## 核对单

```text
需求：有 → 本文件 What Changes + specs/project-switching、specs/task-system-sop、specs/framework-init delta
术语：有 → .omt/术语/GLOSSARY.md（登记 DJTASK／多杰任务系统）
长期决策：有 → .omt/术语/ADR/0007-renamed-to-djtask.md（改名定案：库名/镜像名/仓库名不改）
踩过的坑：无
项目规则：无
流程缺步骤或新类型：无
知识：无
```
