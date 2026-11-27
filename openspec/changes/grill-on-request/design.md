# Design

任务夹在 `openspec/changes/grill-on-request/`。改的是框架文件的正本，就在本仓库。和 `openspec/changes/entry-page-and-guide/` 一起发布。

## Context

**现在怎么启动拷问**（2026-11-27 读文件核实）：

- `.omt/AGENTS.md` 第 10 行：`- 要拷问时：用 grill-with-docs 技能。`
- `.omt/AGENTS.md` 第 32 行：`- 「提需求时有歧义就问人」：由拷问接管，先读已有的，写过的不再问。`
- `.omt/工作流/默认工作流.md` 第 30 行开头：`2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。`
- 这两份文件里没有一处写明技能文件的完整路径。

**不留痕的路径**：`grilling` 的 `SKILL.md` 可以单独用。它的说明里没有 `disable-model-invocation`，AI 能自己调用它；它只有拷问的做法，不带写文档那半截（术语表和决策记录）。

**已有的留痕规矩**（默认工作流里已经写着，这次不新增）：每条需求带出处（规则、强制第 3 条）；术语和长期决策在拷问当时写（「固定新东西」的「谁写」）。

**拷问记录的来历**（2026-11-27 翻归档的任务夹核实）：

- 「出处」是人明确留下的：重新设计那次验收，人问「为啥要有出处」，最后说「OK，保留吧」。出处写进了默认工作流，是规矩。
- 「拷问记录」那一节是重新设计那次 AI 提的一条假设（第 4 条：拷问问答的索引记进 `proposal.md`，卡片详情显示它），人当时答的是「其他的没啥问题」。它写进了看板的需求（`openspec/specs/task-board/spec.md`：有这一节就显示，没有就显示「还没有答复」），没有写进默认工作流。
- 归档的三个任务夹里只有 `redesign-oh-my-task` 记了这一节；`core-expectations-in-sop`、`rename-djtask` 没记。
- 人 2026-11-27 定：不立规矩，以后记不记随任务；已经记的留着。

**三份技能文件**（`.agents/skills/` 下）：

- grill-with-docs 的 `SKILL.md`：说明里有 `disable-model-invocation: true`，正文只有一句，让调用两次 Skill 工具，分别加载 grilling 和 domain-modeling。
- grilling 的 `SKILL.md`：说明里没有这个标记，见知识库「拷问技能的来源」。本地这份落后上游一次提交，没有本地改动。
- domain-modeling 的 `SKILL.md`：有本地改动。

**问题出在哪**：斜杠命令 `/grill-with-docs` 只有认 `.agents/skills/` 这个目录的 AI 工具才有。2026-11-27 搜到的说法是 Codex、Cursor、Gemini CLI、VS Code 会读这个目录，Claude Code 读的是 `.claude/skills/`。这是搜索摘要里的结论，没有逐个到官方文档核实。人的判断是『其他工具不会安装啊。所以/没用啊。』。

**实验**（2026-11-27，一次）：新开一个 AI，要求它不用 Skill 工具、不用斜杠命令、不依赖技能列表，只给它根 `AGENTS.md` 的路径，对它说「我想给网站加一个深色模式的开关。请拷问我。」。它顺着文件找到了三份技能文件，读完提出了第一轮七个问题。交回的原文一字不改，附在本文件最后。

- 它报告：前两跳是文件直接指的路径；第三跳是猜的，没有任何文件写明 `.agents/skills/grill-with-docs/SKILL.md` 这个路径，它是从「`.agents/skills/` 下的三个拷问技能」这句推出目录，再列目录确认的。读 grilling 和 domain-modeling 的路径也是按同样的约定推的。
- 局限：只跑了一次，一个模型（和做这次任务的 AI 同一个），在 ZCode 的子代理里跑的。「没有技能」是靠要求它做到的，不是环境真的没有：ZCode 把带 `disable-model-invocation` 的技能也列了出来。

结论：一句话指令这条路走得通，薄弱处是路径靠猜。把三份文件的路径都写明就补上了。

**人定的前提**：所有 AI 都自动支持读根目录的 `AGENTS.md`。所以指令里不需要写「先读根目录的 AGENTS.md」。

## Decisions

### 1. 人要求了就必须拷问，没要求由 AI 判断

人明确要求拷问的（说法不限，比如「请拷问我」；在认技能的工具里打了 `/grill-with-docs` 也一样），必须拷问。

人没有明确要求的，由 AI 自己判断：简单的需求不拷问，直接建任务夹；需要问清楚的，AI 直接开始拷问，不先问人要不要拷问。人 2026-11-27 定的，原话是『是否拷问由AI决定，当用户没强制要求拷问的时候』。人的理由：拷问技能是下层，默认工作流是上层决策层。这条规矩写在默认工作流里，不和技能的描述冲突，技能的描述不用改。

不拷问的任务：

- 每条需求仍然要带出处：人那一句话需求，或者标了 AI 假设、在建任务夹时请人答。
- 没有关键验收用例。术语表和决策记录 `0006` 写的是「人在拷问收尾时确认过的」，照字面，没拷问就没有。强制第 9 条（带标签的用例必须通过）和「开发失败」对这类任务不适用。人确认过是这样。
- 验收场景和回做次数照建任务夹那一步办。

下面三条是我顺着人的话补的，人 2026-11-27 答了『可以』（proposal.md「定下的几条」第 11、12 条）：

- 有歧义时，AI 直接问人那一件。`.omt/AGENTS.md` 里「由拷问接管」那一条要补这半句。
- 被独立审查打回、结论是需人信息时，直接问人那一件，不再问一遍要不要拷问。写进默认工作流拷问那一步，分流表不动。
- 「固定新东西」的「谁写」补上「没拷问的任务在这一步写」，否则照字面不拷问的任务永远不写术语和长期决策。「人只出现在」那一条不用改：要不要拷问不再由人定，人没有多出出场的地方。

拷问那一步原有的后半段（问出人想要什么、转成验收用例、收尾时请人确认）只管拷问的任务，要在文字里写明，否则不拷问的任务读不出它还算不算。

### 2. 只走 grill-with-docs

拷问只按 grill-with-docs 做：它带着 grilling 和 domain-modeling，边问边写。留痕按已有的两条规矩：每条需求带出处，术语和长期决策当场写。把关的地方不变：没有出处的需求不进审查（强制第 3 条）。拷问记录不立规矩。

### 3. 给 grilling 加一道硬闸

grilling 的 `SKILL.md` 改两处，都是插入，原有的一个字不动：

- 说明里加一行 `disable-model-invocation: true`。认这个标记的工具里，AI 不能自己调用它。
- 正文最前面加一句，写明它只经 grill-with-docs 用、不单独用。不认标记的工具里，AI 读到这句也知道不能单独用。

这是能做的最硬的一道。做不到更硬的：把 grilling 从框架名单里拿掉、并进 grill-with-docs，会让 grill-with-docs 和上游走样，而且已经初始化过的项目里旧的 grilling 文件删不掉，那条路还在。

### 4. 路径写全三份

`.omt/AGENTS.md` 写明 grill-with-docs、grilling、domain-modeling 三份 `SKILL.md` 的完整路径。grilling 加了标记以后，认标记的工具里 AI 调不了它，只能照路径直接读文件，所以三份路径都要写明。默认工作流里照 `.omt/AGENTS.md` 的说法写「直接读文件」，并写明不管是怎么触发的都这样，因为 grill-with-docs 的正文让 AI 去调 Skill 工具，认标记的工具里那第二次调用可能被拦。另外两份的路径在默认工作流里不重复写，指到 `.omt/AGENTS.md`「要拷问时」那一条：`.omt/AGENTS.md` 是开工前必读的，写两遍以后改一处漏一处。

### 5. 怎么验

- 文字核对用自动测试，读仓库的真实文件。
- 五条由新开的 AI 照场景里的条件跑：「人明确要求就拷问」「简单需求不拷问」「需要问清楚的需求，AI 自己开始拷问」「打了 /grill-with-docs 也走得通」「没有斜杠命令的 AI 也能开始拷问」。
  - 「没有技能」是要求它不用 Skill 工具、斜杠命令和技能列表，并在报告里如实写明有没有做到；环境里做不到真的没有。
  - 「打了 /grill-with-docs 也走得通」在本机验。本机的 ZCode 不认「禁止 AI 自己调用」这个标记（它把带标记的技能也列了出来），所以这一条验的是「加了标记以后，这条路还走得通」。认标记的工具里被拦的那一半，本机验不了，靠「直接读文件」那几句和文字核对。
  - 新开的 AI 问不了人，所以验的是它把第一轮问题写出来。「简单需求不拷问」验的是它不提问、说明为什么不拷问、停在准备建任务夹这一步（试验里它只读，不写文件）。
- 每条跑两遍，交回的原文写进 tasks.md 末尾「独立验收的记录」一节的普通条目里。重点看它的报告里「哪一行让它去读的」是不是指向写明的路径，而不是推断。带标签的那一条，三份技能文件的路径都要指向 `.omt/AGENTS.md`「要拷问时」那一条；报告里出现「推出目录」「列目录确认」这类字眼，就算没做到。
- 谁来开这些新 AI：独立验收的 AI 是子代理，开不了新的 AI。我的提议是验收的 AI 写好设定和要对它说的话，主会话照着开、原样转交、原文交回，验收的 AI 只管判。人 2026-11-27 答了『可以』（proposal.md「定下的几条」第 14 条）。

## 文字定稿

只改这几处，别的地方不动。

**`.omt/AGENTS.md` 第 10 行**

改前：

```text
- 要拷问时：用 grill-with-docs 技能。
```

改后：

```text
- 要拷问时：只按 grill-with-docs 做。读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它会让你再读 `.agents/skills/grilling/SKILL.md` 和 `.agents/skills/domain-modeling/SKILL.md`，直接读文件。不靠斜杠命令，不单独用 grilling。
```

**`.omt/AGENTS.md` 第 32 行**

改前：

```text
- 「提需求时有歧义就问人」：由拷问接管，先读已有的，写过的不再问。
```

改后：

```text
- 「提需求时有歧义就问人」：拷问时由拷问接管，先读已有的，写过的不再问；没拷问的任务，AI 直接问人那一件。
```

**`.omt/工作流/默认工作流.md` 第 30 行的开头**

改前：

```text
2. **拷问**（人＋AI，主会话）：由人启动 grill-with-docs，照它自带的规矩做。
```

改后：

```text
2. **拷问**（人＋AI，主会话）：人明确要求拷问的（说法不限，比如「请拷问我」；在认技能的工具里打了 `/grill-with-docs` 也算），必须拷问。人没有明确要求的，由 AI 判断：简单的需求不拷问，直接建任务夹，没有关键验收用例；需要问清楚的，直接开始拷问，不先问人要不要。只按 grill-with-docs 做，不管是怎么触发的：AI 读 `.agents/skills/grill-with-docs/SKILL.md`，照它做；它让你再读的 grilling 和 domain-modeling 两份也直接读文件，路径在 `.omt/AGENTS.md`「要拷问时」那一条里。不靠斜杠命令加载，不单独用 grilling。拷问要留痕，每条需求带出处，术语和长期决策当场写。审查说需人信息、回到这一步时：拷问过的接着拷问，没拷问的直接问人那一件。下面从「另外」起到这一步结尾的话只管拷问的任务。
```

这一行从「另外要问出人想要什么」起的后半句不动。独立审查那一步和分流表不动。

**`.omt/工作流/默认工作流.md` 第 78 行**

改前：

```text
**谁写**：AI 写。术语和长期决策在拷问当时写，其余在这一步写。
```

改后：

```text
**谁写**：AI 写。术语和长期决策在拷问当时写（没拷问的任务在这一步写），其余在这一步写。
```

**`.agents/skills/grilling/SKILL.md`**

改前（开头六行，第六行只摘了前半句）：

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: …
```

改后（开头九行）：只插入两处，原有的每一行都不动。

```text
---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
disable-model-invocation: true
---

Use this only through grill-with-docs, never on its own: a grilling must leave a record (the glossary, the decision records, a source on every requirement).

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: …
```

- 第一处：在 `description:` 那一行后面插入 `disable-model-invocation: true`。
- 第二处：在说明头（第二道 `---`）后面的空行和 `Interview the user relentlessly` 之间，插入上面那一句英文，再跟一个空行。

这份文件用英文写，加的两处也用英文，和它保持一致。

**`.omt/术语/GLOSSARY.md` 的「拷问」一条**（拷问当时已经改好，记在这里备查）

改前：

```text
**拷问**:
需求阶段里 AI 向人逐轮提问、问到双方理解一致为止的做法，用 grill-with-docs 技能做。
```

改后：

```text
**拷问**:
需求阶段里 AI 向人逐轮提问、问到双方理解一致为止的做法，人要求了就必须，没要求由 AI 判断，只按 grill-with-docs 做，必须留痕。
```

## 要同步改的旧句子（整理时改）

这次改完，有两处照老样子写着的句子不对了。整理时改掉：

- 业务工作流 `.omt/工作流/工具开发.md`：「grilling 直接用上游的；domain-modeling 有本地改动」改成两份都有本地改动，写明 grilling 多了哪两处。这一处是流程，人类验收时由人确认。
- 知识库「拷问技能的来源」：表格里 grilling 一行「SKILL.md 差 2 行…不是本地改的」后面补上这次的本地改动；「更新时注意」里「grilling 直接用上游的」改成要合并。

## Risks / Trade-offs

- **硬闸不是处处管用。** `disable-model-invocation` 只有认它的工具才拦；ZCode 这次就把带这个标记的 grill-with-docs 也列了出来。正文里那句限制是给不认标记的工具准备的，靠 AI 读了照做。真正把关的还是已有的规矩：没有出处的需求不进审查。
- **硬闸可能拦到正路。** 认标记的工具里，grill-with-docs 让 AI 调的那第二次 Skill 可能被拦。靠 `.omt/AGENTS.md` 和默认工作流里的「直接读文件」兜着。本机的 ZCode 不认这个标记，这一半在本机验不了，只能验「加了标记以后 /grill-with-docs 还走得通」。
- **新开的 AI 问不了人，也开不了新的 AI。** 所以带标签的用例验的是它把第一轮问题写出来；独立验收要跑的五条试验，得由主会话替验收的 AI 去开（见「怎么验」，人答了『可以』）。
- **别的 AI 未必照做。** 实验只跑了一个模型。所以独立验收时每条跑两遍，并且把「哪一行让它去读的」写进报告里。
- **「环境里真的没有技能」这个条件造不出来。** 带标签的用例只能靠要求新开的 AI 不用，并让它报告有没有做到。这一点写进了场景的条件里。
- **「所有 AI 都自动支持读根目录的 AGENTS.md」是人定的前提，没有核实。** 要是某个工具不读，那句「请拷问我」它就不知道按什么规矩问。按人的决定办，这一条记在这里备查。
- **由 AI 判断要不要拷问，就可能判错。** 简单的需求被判成要拷问，人多答几轮；该问的没问，需求可能带着误解往下走。人可以一句话定下来：说「请拷问我」或「不用拷问」。
- **不拷问的任务没有关键验收用例。** 人确认过。这类任务做完了只看需求逐条对不对，没有「最关心的那几条必须通过」这道保险。
- **改的是所有业务项目都要遵守的规矩。** 所以单独一个任务夹、单独审查；人类验收时由人确认默认工作流的改动。
- **grilling 从此有本地改动。** 见上面「要同步改的旧句子（整理时改）」。
- **框架文件是内置在网页里的。** 改完要重新构建、重新部署，各业务项目再点一次「有更新」才拿到。和网页那个任务一起发布，只部署一次。
- **网页的使用说明里已经写了「请拷问我」。** 所以两个任务要一起发布，不能网页先上、规矩后到。

## 附：实验的原始报告

新开的 AI「试验指令能否触发拷问」，2026-11-27。给它的设定：没有技能、没有斜杠命令，只读；只给它根 `AGENTS.md` 的路径；人的第一句话是「我想给网站加一个深色模式的开关。请拷问我。」下面是它交回的原文，一字没改。

```text
停在了「可以向人提出第一轮问题」这一步，没有建任务夹，没有写文件，没有提交。

## 1. 读了哪些文件，按顺序

1. `D:\git\oh-my-task\AGENTS.md`（全文）
2. `D:\git\oh-my-task\.omt\AGENTS.md`（全文）
3. `D:\git\oh-my-task\.omt\工作流\默认工作流.md`（全文）
4. `D:\git\oh-my-task\.agents\skills\grill-with-docs\SKILL.md`（全文，只有一行正文）
5. `D:\git\oh-my-task\.agents\skills\grilling\SKILL.md`（全文）
6. `D:\git\oh-my-task\.agents\skills\domain-modeling\SKILL.md`（全文）
7. `D:\git\oh-my-task\.omt\术语\GLOSSARY.md`（全文）
8. `D:\git\oh-my-task\.omt\工作流\工具开发.md`（全文）

只列了目录、没有读内容的：`openspec/specs/` 下 7 份 spec、`.omt/知识库/` 下 7 份、`.omt/术语/ADR/` 下 7 份。我对它们和 `app/src` 做了一次关键词搜索（深色、暗色、dark、主题、theme、配色、夜间），没有一处提到深色模式。唯一沾边的是 `D:\git\oh-my-task\app\src\main.tsx` 第 13 行，antd 的 `ConfigProvider` 只设了 `colorPrimary: '#2f54eb'`。

所以默认工作流第 29 行「读已有的」我只做了一半：确认了没有写过深色模式，但没逐份通读。

## 2. 怎么知道要去读「拷问」那份技能文件

靠文件指示，共三跳：

- `D:\git\oh-my-task\AGENTS.md` 第 1 行：
  > 开始任何工作前，先读 `.omt/AGENTS.md`（任务系统在本项目的说明）。
- `D:\git\oh-my-task\.omt\AGENTS.md` 第 10 行：
  > - 要拷问时：用 grill-with-docs 技能。
- `D:\git\oh-my-task\.agents\skills\grill-with-docs\SKILL.md` 第 7 行：
  > Call the Skill tool twice, for "grilling" and "domain-modeling".

前两跳是文件直接指的路径。第三跳有猜的成分：没有任何文件写出 `.agents/skills/grill-with-docs/SKILL.md` 这个路径。我是从 `.omt/AGENTS.md` 第 18 行「`.agents/skills/` 下的三个拷问技能（grill-with-docs、grilling、domain-modeling）」得知目录，再假设文件名是 `SKILL.md` 并用列目录确认的。

## 3. grill-with-docs 让做什么，没有 Skill 工具时怎么办

它只让调用两次 Skill 工具，分别加载 grilling 和 domain-modeling，自己不含任何拷问方法。

我按同样的目录约定推算出这两份的路径，直接读文件，代替了 Skill 工具。读到的要求是：

- **grilling**：
  - 把设计画成一棵决策树，按轮提问，每轮把前置条件都已定下的问题一次问完。
  - 每题编号，带推荐答案，措辞让「是」就等于接受推荐。
  - 事实自己查，不问人；决策交给人。
  - 问到没有遗留假设为止，人确认前不动手。
- **domain-modeling**：
  - 术语和术语表冲突、用词含糊时要当场指出。
  - 术语定了当场写进 `GLOSSARY.md`；长期决策记录只在三个条件都满足时才提。

和默认工作流叠加后，此刻该做的是：先读已有的，再提第一轮问题，并问出人想要什么，之后才转成验收用例。

没做到的两点：
- grilling 要求把找事实派给子代理，我没有子代理，只做了搜索。
- domain-modeling 要求术语定了当场写入文件，这次试验是只读，没有写。

## 4. 第一轮问题

格式按 grilling 的样子，去掉了表情符号。

**Q1 - 「网站」和「开关」指什么**：你说的「网站」是 DJTASK 这个网页工具本身，还是它初始化出去的业务项目？「开关」是页面右上角的一个切换按钮，还是只要支持深色、不一定要有按钮？术语表里这个工具叫 DJTASK，不叫 oh my task，我后面都按 DJTASK 问。
推荐：是 DJTASK 自己，右上角放一个切换按钮。

**Q2 - 你要它解决什么**：加了深色模式之后，你在什么场景下会觉得「有用」？是晚上看着刺眼、截图文案看不清，还是别人有而我们没有？这决定哪些页面必须做、哪些可以不做。
推荐：主要是长时间盯着看板时眼睛舒服，所以看板和任务夹详情页优先。

**Q3 - 有几档**：是「浅色 / 深色」两档，还是「跟随系统 / 浅色 / 深色」三档？
推荐：三档，默认跟随系统。

**Q4 - 默认是什么**：第一次打开、你没选过的时候，用哪一档？
推荐：跟随系统。

**Q5 - 记不记住**：你选了深色，关掉浏览器再打开，还是深色吗？如果记住，是只记在这台电脑的这个浏览器里，还是要跟着项目走？说明：这个工具有一个规则是「除了初始化和更新，页面不碰业务项目」，所以要是跟着项目走，就得改这条规则。
推荐：记住，只记在浏览器本地，不写进业务项目。

**Q6 - 范围**：DJTASK 现在有入口页、看板、任务夹详情抽屉，还有各种提示和弹窗。是全部都要有深色，还是先做一部分？另外，业务项目里的内容（比如任务夹里的文字）在别的编辑器里看是什么样，不在这次范围内，对吗？
推荐：全部都要有深色，包括提示和弹窗；别的编辑器里的样子不在范围内。

**Q7 - 怎么算做完**：做完之后，你怎么验收？是我截浅色和深色两张图给你看，还是你自己点一遍？另外，有没有你不在意、可以不做的角落？
推荐：你自己在真实浏览器里点一遍切换，我看不了真实浏览器里的效果。
```
