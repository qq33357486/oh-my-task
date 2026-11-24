# Tasks

## 1. 网页 UI 与文案（用例①）

- [x] 1.1 `app/index.html` 标题、`EntryPage.tsx` 大标题、`Header.tsx` 改为「DJ Task」；实际显示留给人亲手验（Chromium 目录授权/文件读写限制单测测不到，见项目规则第 5 条）
- [x] 1.2 `install.ts`、`pages.tsx` 及 App.test/App.install.test/App.fix.test 的旧版文案改为「这个目录装的是旧版 DJ Task」（只替换品牌词，不顺手统一成 spec 句式）；`npm test` 对应用例通过

## 2. 代码标识（用例②④⑤）

- [x] 2.1 `app/package.json` name 改 `djtask-app`；`npm install` 后确认 `package-lock.json` 已刷新（name 字段无 oh-my-task-app 残留）；`npm run typecheck`、`npm run build` 过
- [x] 2.2 `store.ts`、`errors.ts` 日志前缀改 `[djtask]`；`agentsMd.ts` 注释自称改 DJTASK；`fsAccess.ts` 库名保留并加「保留旧名原因」注释；`npm test` 全绿

## 3. 文档与框架文本（用例③）

- [x] 3.1 README 标题正文改 DJTASK／多杰任务系统，注明镜像名跟仓库名不改；`grep -ri "oh my task\|oh-my-task" README.md app/src app/index.html app/package.json` 仅剩库名、镜像名和注释里的说明
- [x] 3.2 `.omt/AGENTS.md`、工作流、术语表、ADR 正文、知识库里的产品自称改 DJTASK／多杰任务系统；排除归档任务夹名（如 redesign-oh-my-task）、ADR 文件名、指仓库的「oh-my-task 仓库」；`grep -rn "oh my task" .omt/` 核对剩余均为排除项

## 4. 全量验证（用例④）

- [x] 4.1 全量验证：`npm test`、`npm run typecheck`、`npm run build` 全过；全仓库 `grep -ri "oh my task\|oh-my-task"`（排除 node_modules/.git/openspec）复查无漏网自称

## 5. 固定新东西

- [x] 5.1 术语登记 DJTASK／多杰任务系统进 `.omt/术语/GLOSSARY.md`
- [x] 5.2 写改名定案 ADR `.omt/术语/ADR/0007-renamed-to-djtask.md`（库名/镜像名/仓库名不改及理由）
- [x] 5.3 固定新东西并填核对单（对照 proposal.md 末尾核对单逐项确认）


## Workflow follow-up

- 独立验收（新开的 AI，对照任务夹和项目规则核）。
- 人类验收：目检网页标题/引导页/旧版提示（用例①的目检部分）；确认项目规则、`.omt/工作流/` 流程两样。
- 归档：三个 delta 并回 `openspec/specs/`，任务夹进归档；归档后去掉 specs 出处行，并手动同步 delivery 与 project-switching 的 Purpose 行（delta 机制带不动，见 design 风险第三条）。
- 部署推送前问人。
