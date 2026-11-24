# OpenSpec 2.1.1 实跑记录

> 查于 2026-11-23、24，本机装的 OpenSpec 2.1.1。做法是在临时目录里实跑，跑完删掉。OpenSpec 升级后这里可能过期，用之前抽查一条。

## 命令

| 命令 | 做什么 |
|---|---|
| `openspec init --tools <工具> --scope project .` | 在项目里装 OpenSpec |
| `openspec new change <名>` | 建一个变更，只建 `openspec/changes/<名>/.openspec.yaml` |
| `openspec list --json` | 列出变更：名字、已勾和总待办数、最后修改时间、状态 |
| `openspec status --change <名> --json` | 四件产物各到哪一步（被阻塞、可以写、已完成、跳过） |
| `openspec instructions <产物> --change <名> --json` | 写某件产物的说明 |
| `openspec validate <名>`，加 `--strict` 更严 | 校验一个变更 |
| `openspec archive <名> -y` | 归档：校验、把规格增量并进 `openspec/specs/`、任务夹挪进归档 |

## `init` 生成了什么

`--tools zcode --scope project` 生成：

- `openspec/config.yaml`（`schema: spec-driven`）
- `openspec/specs/`、`openspec/changes/archive/`，各放一个 `.gitkeep`
- 6 个技能，`.agents/skills/` 和 `.zcode/skills/` 各一份：propose、apply-change、update-change、archive-change、sync-specs、explore
- `.agents/skills/.openspec-target`

它不碰根 `AGENTS.md`。技能数取决于配置，默认才是 6 个。

## 一个变更有哪几样

- `proposal.md`：为什么、改什么、涉及哪些能力、影响哪里。
- `specs/<能力>/spec.md`：需求。`## Purpose` 在前，`## ADDED Requirements` 里每条是 `### Requirement: 名字`，下面至少一个 `#### Scenario:`，场景用 WHEN、THEN。
- `design.md`：可缺。
- `tasks.md`：待办清单。

## 待办的数法

原始规则在安装目录的 `dist/utils/task-progress.js`：

```js
/^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/
```

待办文件默认只有 `tasks.md` 一个。schema 可以把它配成通配符，那时 OpenSpec 会数多个文件；oh my task 只读顶层的 `tasks.md`，默认 schema 下一样。

换成人话：

- 以列表符号或数字编号开头的行，后面跟着方括号，方括号里是空的或只有一个字符，并且右方括号后面不是紧跟圆括号，就算一条待办。缩进的子项也算。
- 方括号里多于一个字符的不算，如 `[WIP]`、`[TODO]`。
- 右方括号后面紧跟圆括号的，只有方括号里是空白时才算：`[说明](./a.md)` 和 `[](./a.md)` 不算，`[ ](./b.md)` 算。
- 方括号里那一个字符是 `x` 或 `X` 才算勾完。`[~]`、`[-]`、`[]` 都算没勾。
- 代码围栏里的行照算。

实跑核对过的四组（每组「已勾／总数」）：各种写法混在一起 3／9；链接和多字符标记 0／1；代码围栏里 1／2；方括号里带空格 3／4。

## 状态

`openspec list --json` 里的 `status` 只有三种，按待办算：`no-tasks`、`in-progress`、`complete`。它不知道任务系统的三个阶段，也不知道在不在等人。

## 归档

- 归档后的目录是 `openspec/changes/archive/YYYY-MM-DD-<名>/`。
- 归档会把规格增量并进 `openspec/specs/`。需求标题下紧跟着的那一行会跟着并进去。
- 没有规格增量时要先在 `.openspec.yaml` 里写 `skip_specs: true`，否则校验不过。
- `Why` 一节不到 50 个字，校验会警告。

## 其它

- 需求名可以用中文，需求标题下加一行引用（`> 出处：…`）能通过校验，严格模式也过。
- `openspec status` 在 `tasks.md` 一写好就提示 `Next: apply`。这不等于可以开工，独立审查通过才算。
- 它在用户级留两份文件：`~/AppData/Roaming/openspec/config.json`（里面有遥测的匿名编号）和 `~/AppData/Local/openspec/projects.json`。第一次用时写入；之后跑命令不再改它们（2026-11-24 实测，跑一次 `openspec list` 前后没有变化）。
- 技能目录里的两份拷贝：`.agents/skills/` 进 git，`.zcode/skills/` 在工程 1 里被 `.gitignore` 忽略。
